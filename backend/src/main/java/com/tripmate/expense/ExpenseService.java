package com.tripmate.expense;

import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.audit.AuditLogService;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    // 1. GET /api/v1/trips/{tripId}/expenses
    @Transactional(readOnly = true)
    public List<ExpenseResponse> getExpenses(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        return expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(tripId)
                .stream()
                .map(ExpenseResponse::from)
                .toList();
    }

    // 2. GET /api/v1/trips/{tripId}/expenses/{expenseId}
    @Transactional(readOnly = true)
    public ExpenseResponse getExpenseById(Long tripId, Long expenseId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Expense expense = expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense not found"));

        return ExpenseResponse.from(expense);
    }

    // 3. POST /api/v1/trips/{tripId}/expenses
    @Transactional
    public ExpenseResponse createExpense(Long tripId, Long userId, CreateExpenseRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Long payerId = request.paidById() != null ? request.paidById() : userId;
        User paidBy = userRepository.findById(payerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Payer user not found"));

        SplitType splitType = request.splitType() != null ? request.splitType() : SplitType.EQUAL;

        Expense expense = Expense.builder()
                .trip(trip)
                .paidBy(paidBy)
                .title(request.title().trim())
                .amount(request.amount().setScale(2, RoundingMode.HALF_UP))
                .category(request.category())
                .expenseDate(request.expenseDate())
                .splitType(splitType)
                .notes(request.notes())
                .build();

        Expense savedExpense = expenseRepository.save(expense);
        List<ExpenseSplit> splits = generateSplits(savedExpense, trip, request.amount(), splitType, request.splits());
        savedExpense.setSplits(splits);

        auditLogService.log(userId, tripId, com.tripmate.audit.AuditAction.EXPENSE_CREATED, "EXPENSE", savedExpense.getId(), "Created expense: " + savedExpense.getTitle() + " (" + savedExpense.getAmount() + ")");

        return ExpenseResponse.from(savedExpense);
    }

    // 4. PUT /api/v1/trips/{tripId}/expenses/{expenseId}
    @Transactional
    public ExpenseResponse updateExpense(Long tripId, Long expenseId, Long userId, UpdateExpenseRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Expense expense = expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense not found"));

        Long payerId = request.paidById() != null ? request.paidById() : expense.getPaidBy().getId();
        User paidBy = userRepository.findById(payerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Payer user not found"));

        SplitType splitType = request.splitType() != null ? request.splitType() : expense.getSplitType();

        expense.setPaidBy(paidBy);
        expense.setTitle(request.title().trim());
        expense.setAmount(request.amount().setScale(2, RoundingMode.HALF_UP));
        expense.setCategory(request.category());
        expense.setExpenseDate(request.expenseDate());
        expense.setSplitType(splitType);
        expense.setNotes(request.notes());

        expense.getSplits().clear();
        expenseRepository.flush();

        List<ExpenseSplit> splits = generateSplits(expense, trip, request.amount(), splitType, request.splits());
        expense.getSplits().addAll(splits);

        Expense updatedExpense = expenseRepository.save(expense);

        auditLogService.log(userId, tripId, com.tripmate.audit.AuditAction.EXPENSE_UPDATED, "EXPENSE", updatedExpense.getId(), "Updated expense: " + updatedExpense.getTitle() + " (" + updatedExpense.getAmount() + ")");

        return ExpenseResponse.from(updatedExpense);
    }

    // 5. DELETE /api/v1/trips/{tripId}/expenses/{expenseId}
    @Transactional
    public void deleteExpense(Long tripId, Long expenseId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Expense expense = expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense not found"));

        expenseRepository.delete(expense);
    }

    // 6. POST /api/v1/trips/{tripId}/expenses/{expenseId}/splits
    @Transactional
    public List<ExpenseSplitResponse> createExpenseSplits(Long tripId, Long expenseId, Long userId, CreateCustomSplitRequest request) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Expense expense = expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense not found"));

        expense.setSplitType(request.splitType());
        expense.getSplits().clear();
        expenseRepository.flush();

        List<CreateExpenseRequest.SplitDetail> details = request.splits().stream()
                .map(s -> new CreateExpenseRequest.SplitDetail(s.userId(), s.shareAmount(), s.percentage()))
                .toList();

        List<ExpenseSplit> splits = generateSplits(expense, trip, expense.getAmount(), request.splitType(), details);
        expense.getSplits().addAll(splits);
        expenseRepository.save(expense);

        return splits.stream().map(ExpenseSplitResponse::from).toList();
    }

    // 7. GET /api/v1/trips/{tripId}/expenses/{expenseId}/splits
    @Transactional(readOnly = true)
    public List<ExpenseSplitResponse> getExpenseSplits(Long tripId, Long expenseId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Expense expense = expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense not found"));

        return expense.getSplits().stream()
                .map(ExpenseSplitResponse::from)
                .toList();
    }

    // 8. PATCH /api/v1/trips/{tripId}/expenses/{expenseId}/splits/{splitId}/settle
    @Transactional
    public ExpenseSplitResponse settleExpenseSplit(Long tripId, Long expenseId, Long splitId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        ExpenseSplit split = expenseSplitRepository.findByIdAndExpenseIdAndExpenseTripId(splitId, expenseId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Expense split not found"));

        split.setSettlementStatus(SettlementStatus.SETTLED);
        ExpenseSplit updated = expenseSplitRepository.save(split);
        return ExpenseSplitResponse.from(updated);
    }

    // 9. GET /api/v1/trips/{tripId}/expenses/summary
    @Transactional(readOnly = true)
    public ExpenseSummaryResponse getExpenseSummary(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        List<Expense> expenses = expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(tripId);

        BigDecimal totalBudget = trip.getBudget() != null ? trip.getBudget() : BigDecimal.ZERO;
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remainingBudget = totalBudget.subtract(totalExpenses);

        Double budgetUtilizationPercentage = totalBudget.compareTo(BigDecimal.ZERO) > 0
                ? totalExpenses.divide(totalBudget, 4, RoundingMode.HALF_UP).doubleValue() * 100
                : 0.0;

        Map<ExpenseCategory, BigDecimal> categoryBreakdown = new EnumMap<>(ExpenseCategory.class);
        for (ExpenseCategory cat : ExpenseCategory.values()) {
            categoryBreakdown.put(cat, BigDecimal.ZERO);
        }
        for (Expense exp : expenses) {
            categoryBreakdown.merge(exp.getCategory(), exp.getAmount(), BigDecimal::add);
        }

        List<User> allMembers = getAllTripUsers(trip);
        Map<Long, BigDecimal> paidMap = new HashMap<>();
        Map<Long, BigDecimal> owedMap = new HashMap<>();

        for (User u : allMembers) {
            paidMap.put(u.getId(), BigDecimal.ZERO);
            owedMap.put(u.getId(), BigDecimal.ZERO);
        }

        for (Expense exp : expenses) {
            paidMap.merge(exp.getPaidBy().getId(), exp.getAmount(), BigDecimal::add);
            if (exp.getSplits() != null) {
                for (ExpenseSplit split : exp.getSplits()) {
                    if (split.getSettlementStatus() == SettlementStatus.PENDING) {
                        owedMap.merge(split.getUser().getId(), split.getShareAmount(), BigDecimal::add);
                    }
                }
            }
        }

        List<ExpenseSummaryResponse.MemberBalance> memberBalances = new ArrayList<>();
        Map<User, BigDecimal> netBalances = new LinkedHashMap<>();

        for (User u : allMembers) {
            BigDecimal totalPaid = paidMap.getOrDefault(u.getId(), BigDecimal.ZERO);
            BigDecimal totalOwed = owedMap.getOrDefault(u.getId(), BigDecimal.ZERO);
            BigDecimal netBalance = totalPaid.subtract(totalOwed).setScale(2, RoundingMode.HALF_UP);

            memberBalances.add(new ExpenseSummaryResponse.MemberBalance(
                    u.getId(),
                    u.getName(),
                    totalPaid.setScale(2, RoundingMode.HALF_UP),
                    totalOwed.setScale(2, RoundingMode.HALF_UP),
                    netBalance
            ));

            netBalances.put(u, netBalance);
        }

        List<ExpenseSummaryResponse.SuggestedSettlement> suggestedSettlements =
                calculateSuggestedSettlements(netBalances);

        return new ExpenseSummaryResponse(
                tripId,
                totalBudget,
                totalExpenses,
                remainingBudget,
                budgetUtilizationPercentage,
                categoryBreakdown,
                memberBalances,
                suggestedSettlements
        );
    }

    private List<ExpenseSplit> generateSplits(
            Expense expense,
            Trip trip,
            BigDecimal totalAmount,
            SplitType splitType,
            List<CreateExpenseRequest.SplitDetail> splitDetails
    ) {
        List<ExpenseSplit> splits = new ArrayList<>();
        List<User> targetUsers;

        if (splitDetails != null && !splitDetails.isEmpty()) {
            Map<Long, CreateExpenseRequest.SplitDetail> detailMap = splitDetails.stream()
                    .collect(Collectors.toMap(CreateExpenseRequest.SplitDetail::userId, d -> d));

            targetUsers = userRepository.findAllById(detailMap.keySet());
            if (targetUsers.size() != detailMap.size()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "One or more split users do not exist");
            }
        } else {
            targetUsers = getAllTripUsers(trip);
        }

        if (targetUsers.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "No members found to split expense");
        }

        int count = targetUsers.size();

        switch (splitType) {
            case EQUAL -> {
                BigDecimal baseShare = totalAmount.divide(
                        BigDecimal.valueOf(count), 2, RoundingMode.FLOOR);
                BigDecimal remainder = totalAmount.subtract(
                        baseShare.multiply(BigDecimal.valueOf(count)));
                BigDecimal percentage = BigDecimal.valueOf(100.0 / count)
                        .setScale(2, RoundingMode.HALF_UP);

                for (int i = 0; i < count; i++) {
                    User u = targetUsers.get(i);
                    BigDecimal share = (i == 0) ? baseShare.add(remainder) : baseShare;

                    splits.add(ExpenseSplit.builder()
                            .expense(expense)
                            .user(u)
                            .shareAmount(share)
                            .percentage(percentage)
                            .settlementStatus(SettlementStatus.PENDING)
                            .build());
                }
            }
            case EXACT -> {
                if (splitDetails == null || splitDetails.isEmpty()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Split details are required for EXACT split type");
                }
                BigDecimal sumExact = BigDecimal.ZERO;
                Map<Long, CreateExpenseRequest.SplitDetail> map = splitDetails.stream()
                        .collect(Collectors.toMap(CreateExpenseRequest.SplitDetail::userId, d -> d));

                for (User u : targetUsers) {
                    CreateExpenseRequest.SplitDetail detail = map.get(u.getId());
                    if (detail == null || detail.amount() == null) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST, "Exact amount missing for user ID: " + u.getId());
                    }
                    BigDecimal amt = detail.amount().setScale(2, RoundingMode.HALF_UP);
                    sumExact = sumExact.add(amt);
                    BigDecimal pct = amt.divide(totalAmount, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .setScale(2, RoundingMode.HALF_UP);

                    splits.add(ExpenseSplit.builder()
                            .expense(expense)
                            .user(u)
                            .shareAmount(amt)
                            .percentage(pct)
                            .settlementStatus(SettlementStatus.PENDING)
                            .build());
                }
                if (sumExact.compareTo(totalAmount) != 0) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Sum of split amounts (" + sumExact + ") does not equal total amount (" + totalAmount + ")");
                }
            }
            case PERCENTAGE -> {
                if (splitDetails == null || splitDetails.isEmpty()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Split details are required for PERCENTAGE split type");
                }
                BigDecimal sumPercent = BigDecimal.ZERO;
                Map<Long, CreateExpenseRequest.SplitDetail> map = splitDetails.stream()
                        .collect(Collectors.toMap(CreateExpenseRequest.SplitDetail::userId, d -> d));

                for (User u : targetUsers) {
                    CreateExpenseRequest.SplitDetail detail = map.get(u.getId());
                    if (detail == null || detail.percentage() == null) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST, "Percentage missing for user ID: " + u.getId());
                    }
                    BigDecimal pct = detail.percentage().setScale(2, RoundingMode.HALF_UP);
                    sumPercent = sumPercent.add(pct);
                    BigDecimal amt = totalAmount.multiply(pct)
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                    splits.add(ExpenseSplit.builder()
                            .expense(expense)
                            .user(u)
                            .shareAmount(amt)
                            .percentage(pct)
                            .settlementStatus(SettlementStatus.PENDING)
                            .build());
                }
                if (sumPercent.compareTo(BigDecimal.valueOf(100.00)) != 0) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "Sum of percentages (" + sumPercent + ") must equal 100%");
                }
            }
        }

        return splits;
    }

    private List<ExpenseSummaryResponse.SuggestedSettlement> calculateSuggestedSettlements(
            Map<User, BigDecimal> netBalances
    ) {
        List<ExpenseSummaryResponse.SuggestedSettlement> settlements = new ArrayList<>();

        PriorityQueue<Map.Entry<User, BigDecimal>> debtors = new PriorityQueue<>(
                Comparator.comparing(Map.Entry::getValue)
        );
        PriorityQueue<Map.Entry<User, BigDecimal>> creditors = new PriorityQueue<>(
                (a, b) -> b.getValue().compareTo(a.getValue())
        );

        for (Map.Entry<User, BigDecimal> entry : netBalances.entrySet()) {
            if (entry.getValue().compareTo(BigDecimal.ZERO) < 0) {
                debtors.add(new AbstractMap.SimpleEntry<>(entry.getKey(), entry.getValue().abs()));
            } else if (entry.getValue().compareTo(BigDecimal.ZERO) > 0) {
                creditors.add(new AbstractMap.SimpleEntry<>(entry.getKey(), entry.getValue()));
            }
        }

        while (!debtors.isEmpty() && !creditors.isEmpty()) {
            Map.Entry<User, BigDecimal> debtor = debtors.poll();
            Map.Entry<User, BigDecimal> creditor = creditors.poll();

            BigDecimal settleAmount = debtor.getValue().min(creditor.getValue()).setScale(2, RoundingMode.HALF_UP);

            if (settleAmount.compareTo(BigDecimal.ZERO) > 0) {
                settlements.add(new ExpenseSummaryResponse.SuggestedSettlement(
                        debtor.getKey().getId(),
                        debtor.getKey().getName(),
                        creditor.getKey().getId(),
                        creditor.getKey().getName(),
                        settleAmount
                ));
            }

            BigDecimal debtorRemaining = debtor.getValue().subtract(settleAmount);
            BigDecimal creditorRemaining = creditor.getValue().subtract(settleAmount);

            if (debtorRemaining.compareTo(BigDecimal.valueOf(0.01)) >= 0) {
                debtors.add(new AbstractMap.SimpleEntry<>(debtor.getKey(), debtorRemaining));
            }
            if (creditorRemaining.compareTo(BigDecimal.valueOf(0.01)) >= 0) {
                creditors.add(new AbstractMap.SimpleEntry<>(creditor.getKey(), creditorRemaining));
            }
        }

        return settlements;
    }

    private List<User> getAllTripUsers(Trip trip) {
        Map<Long, User> userMap = new LinkedHashMap<>();
        userMap.put(trip.getOwner().getId(), trip.getOwner());

        List<TripMember> members = tripMemberRepository.findByTripIdAndMemberStatus(
                trip.getId(), MemberStatus.ACTIVE);

        for (TripMember m : members) {
            userMap.putIfAbsent(m.getUser().getId(), m.getUser());
        }

        return new ArrayList<>(userMap.values());
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private void verifyCanView(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        boolean isMember = tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);
        if (!isMember) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have access to this trip");
        }
    }

    private void verifyCanEdit(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        var memberOpt = tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);

        if (memberOpt.isEmpty() || memberOpt.get().getRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have permission to edit expenses for this trip");
        }
    }
}
