import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateCustomSplitRequest,
  CreateExpenseRequest,
  Expense,
  ExpenseSplit,
  ExpenseSummary,
  UpdateExpenseRequest
} from '../models/expense.model';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getExpenses(tripId: number): Observable<Expense[]> {
    return this.http.get<Expense[]>(
      `${this.baseUrl}/${tripId}/expenses`
    );
  }

  getExpenseSummary(tripId: number): Observable<ExpenseSummary> {
    return this.http.get<ExpenseSummary>(
      `${this.baseUrl}/${tripId}/expenses/summary`
    );
  }

  getExpenseById(tripId: number, expenseId: number): Observable<Expense> {
    return this.http.get<Expense>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}`
    );
  }

  createExpense(
    tripId: number,
    request: CreateExpenseRequest
  ): Observable<Expense> {
    return this.http.post<Expense>(
      `${this.baseUrl}/${tripId}/expenses`,
      request
    );
  }

  updateExpense(
    tripId: number,
    expenseId: number,
    request: UpdateExpenseRequest
  ): Observable<Expense> {
    return this.http.put<Expense>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}`,
      request
    );
  }

  deleteExpense(
    tripId: number,
    expenseId: number
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}`
    );
  }

  createCustomSplits(
    tripId: number,
    expenseId: number,
    request: CreateCustomSplitRequest
  ): Observable<ExpenseSplit[]> {
    return this.http.post<ExpenseSplit[]>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}/splits`,
      request
    );
  }

  getExpenseSplits(
    tripId: number,
    expenseId: number
  ): Observable<ExpenseSplit[]> {
    return this.http.get<ExpenseSplit[]>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}/splits`
    );
  }

  settleSplit(
    tripId: number,
    expenseId: number,
    splitId: number
  ): Observable<ExpenseSplit> {
    return this.http.patch<ExpenseSplit>(
      `${this.baseUrl}/${tripId}/expenses/${expenseId}/splits/${splitId}/settle`,
      {}
    );
  }
}
