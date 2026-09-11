package com.tripmate.expense;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {

    List<ExpenseSplit> findByExpenseId(Long expenseId);

    Optional<ExpenseSplit> findByIdAndExpenseId(Long id, Long expenseId);

    Optional<ExpenseSplit> findByIdAndExpenseIdAndExpenseTripId(Long id, Long expenseId, Long tripId);

    List<ExpenseSplit> findByExpenseTripId(Long tripId);

    List<ExpenseSplit> findByUserIdAndExpenseTripId(Long userId, Long tripId);
}
