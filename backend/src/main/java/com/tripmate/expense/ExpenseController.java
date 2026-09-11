package com.tripmate.expense;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    // 1. POST /api/v1/trips/{tripId}/expenses
    @PostMapping
    public ResponseEntity<ExpenseResponse> createExpense(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateExpenseRequest request
    ) {
        ExpenseResponse response = expenseService.createExpense(
                tripId, userPrincipal.getId(), request
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 2. GET /api/v1/trips/{tripId}/expenses
    @GetMapping
    public ResponseEntity<List<ExpenseResponse>> getExpenses(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                expenseService.getExpenses(tripId, userPrincipal.getId())
        );
    }

    // 3. GET /api/v1/trips/{tripId}/expenses/summary
    @GetMapping("/summary")
    public ResponseEntity<ExpenseSummaryResponse> getExpenseSummary(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                expenseService.getExpenseSummary(tripId, userPrincipal.getId())
        );
    }

    // 4. GET /api/v1/trips/{tripId}/expenses/{expenseId}
    @GetMapping("/{expenseId}")
    public ResponseEntity<ExpenseResponse> getExpenseById(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                expenseService.getExpenseById(tripId, expenseId, userPrincipal.getId())
        );
    }

    // 5. PUT /api/v1/trips/{tripId}/expenses/{expenseId}
    @PutMapping("/{expenseId}")
    public ResponseEntity<ExpenseResponse> updateExpense(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateExpenseRequest request
    ) {
        return ResponseEntity.ok(
                expenseService.updateExpense(tripId, expenseId, userPrincipal.getId(), request)
        );
    }

    // 6. DELETE /api/v1/trips/{tripId}/expenses/{expenseId}
    @DeleteMapping("/{expenseId}")
    public ResponseEntity<Map<String, String>> deleteExpense(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        expenseService.deleteExpense(tripId, expenseId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Expense deleted successfully"));
    }

    // 7. POST /api/v1/trips/{tripId}/expenses/{expenseId}/splits
    @PostMapping("/{expenseId}/splits")
    public ResponseEntity<List<ExpenseSplitResponse>> createExpenseSplits(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateCustomSplitRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(expenseService.createExpenseSplits(tripId, expenseId, userPrincipal.getId(), request));
    }

    // 8. GET /api/v1/trips/{tripId}/expenses/{expenseId}/splits
    @GetMapping("/{expenseId}/splits")
    public ResponseEntity<List<ExpenseSplitResponse>> getExpenseSplits(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                expenseService.getExpenseSplits(tripId, expenseId, userPrincipal.getId())
        );
    }

    // 9. PATCH /api/v1/trips/{tripId}/expenses/{expenseId}/splits/{splitId}/settle
    @PatchMapping("/{expenseId}/splits/{splitId}/settle")
    public ResponseEntity<ExpenseSplitResponse> settleExpenseSplit(
            @PathVariable Long tripId,
            @PathVariable Long expenseId,
            @PathVariable Long splitId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                expenseService.settleExpenseSplit(tripId, expenseId, splitId, userPrincipal.getId())
        );
    }
}
