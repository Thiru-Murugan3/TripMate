package com.tripmate.expense;

import com.tripmate.audit.AuditLogService;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMember;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private ExpenseSplitRepository expenseSplitRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private ExpenseService expenseService;

    private User owner;
    private User memberUser;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner User")
                .email("owner@example.com")
                .build();

        memberUser = User.builder()
                .id(2L)
                .name("Member User")
                .email("member@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Dinner Trip")
                .budget(new BigDecimal("10000.00"))
                .build();
    }

    @Test
    @DisplayName("createExpense: Equal split auto-divides amount between members")
    void createExpense_EqualSplit_Success() {
        CreateExpenseRequest request = new CreateExpenseRequest(
                "Group Dinner",
                new BigDecimal("100.00"),
                ExpenseCategory.FOOD,
                LocalDate.now(),
                1L,
                SplitType.EQUAL,
                null,
                "Delicious food"
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(tripMemberRepository.findByTripIdAndMemberStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(TripMember.builder().user(memberUser).role(TripRole.EDITOR).build()));
        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> {
            Expense e = invocation.getArgument(0);
            e.setId(50L);
            return e;
        });

        ExpenseResponse response = expenseService.createExpense(10L, 1L, request);

        assertNotNull(response);
        assertEquals(50L, response.id());
        assertEquals("Group Dinner", response.title());
        assertEquals(new BigDecimal("100.00"), response.amount());
        assertEquals(2, response.splits().size());
        assertEquals(new BigDecimal("50.00"), response.splits().get(0).shareAmount());
    }

    @Test
    @DisplayName("createExpense: Exact split with mismatched sum throws 400 BAD REQUEST")
    void createExpense_ExactSplitMismatch_ThrowsBadRequest() {
        CreateExpenseRequest.SplitDetail detail1 = new CreateExpenseRequest.SplitDetail(1L, new BigDecimal("40.00"), null);
        CreateExpenseRequest.SplitDetail detail2 = new CreateExpenseRequest.SplitDetail(2L, new BigDecimal("40.00"), null);

        CreateExpenseRequest request = new CreateExpenseRequest(
                "Group Dinner",
                new BigDecimal("100.00"),
                ExpenseCategory.FOOD,
                LocalDate.now(),
                1L,
                SplitType.EXACT,
                List.of(detail1, detail2),
                null
        );

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(userRepository.findAllById(anySet())).thenReturn(List.of(owner, memberUser));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> expenseService.createExpense(10L, 1L, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("does not equal total amount"));
    }

    @Test
    @DisplayName("getExpenseSummary: Calculates budget remaining and category breakdown")
    void getExpenseSummary_Success() {
        Expense exp1 = Expense.builder()
                .id(1L)
                .trip(trip)
                .paidBy(owner)
                .title("Hotel")
                .amount(new BigDecimal("3000.00"))
                .category(ExpenseCategory.HOTEL)
                .splits(List.of())
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(expenseRepository.findByTripIdOrderByExpenseDateDescIdDesc(10L)).thenReturn(List.of(exp1));

        ExpenseSummaryResponse summary = expenseService.getExpenseSummary(10L, 1L);

        assertNotNull(summary);
        assertEquals(new BigDecimal("10000.00"), summary.totalTripBudget());
        assertEquals(new BigDecimal("3000.00"), summary.totalExpenses());
        assertEquals(new BigDecimal("7000.00"), summary.remainingBudget());
        assertEquals(30.0, summary.budgetUtilizationPercentage());
        assertEquals(new BigDecimal("3000.00"), summary.categoryBreakdown().get(ExpenseCategory.HOTEL));
    }
}
