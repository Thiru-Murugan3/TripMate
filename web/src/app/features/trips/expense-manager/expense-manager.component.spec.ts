import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ExpenseManagerComponent } from './expense-manager.component';
import { ExpenseService } from '../../../core/services/expense.service';
import { Expense } from '../../../core/models/expense.model';
import { Trip } from '../../../core/models/trip.model';

describe('Expense currency entry', () => {
  let component: ExpenseManagerComponent;
  let service: jasmine.SpyObj<ExpenseService>;
  beforeEach(() => {
    service = jasmine.createSpyObj('ExpenseService', ['createExpense', 'updateExpense', 'getExpenses', 'getExpenseSummary']);
    TestBed.configureTestingModule({ providers: [{ provide: ExpenseService, useValue: service }] });
    component = TestBed.runInInjectionContext(() => new ExpenseManagerComponent());
    component.tripId = 10;
    component.canEdit = true;
    component.trip = { ownerId: 1, ownerName: 'Owner', startDate: '2026-10-01', endDate: '2026-10-31' } as Trip;
    component.openCreateExpense();
  });

  it('requires a fresh manual rate when currency changes', () => {
    component.expenseForm.patchValue({ originalCurrency: 'USD', originalAmount: 10 });
    component.currencyChanged();
    expect(component.expenseForm.value.exchangeRate).toBeNull();
    expect(component.canSubmitExpense).toBeFalse();
    component.expenseForm.patchValue({ exchangeRate: 83.5 });
    component.updateConversion();
    expect(component.expenseForm.value.amount).toBe(835);
    component.expenseForm.patchValue({ originalCurrency: 'INR' });
    component.currencyChanged();
    expect(component.expenseForm.value.exchangeRate).toBe(1);
    expect(component.expenseForm.value.amount).toBe(10);
  });

  it('submits original currency metadata and preserves the form after an error', () => {
    component.expenseForm.patchValue({ title: 'Tickets', expenseDate: '2026-10-12', originalCurrency: 'USD', originalAmount: 10.25, exchangeRate: 83.12345678 });
    component.updateConversion();
    service.createExpense.and.returnValue(throwError(() => ({ error: { message: 'Please retry' } })));
    component.saveExpense();
    expect(service.createExpense).toHaveBeenCalledWith(10, jasmine.objectContaining({ amount: 852.02, originalCurrency: 'USD', originalAmount: 10.25, exchangeRate: 83.12345678 }));
    expect(component.showExpenseModal).toBeTrue();
    expect(component.expenseForm.value.originalAmount).toBe(10.25);
    expect(component.formError).toBe('Please retry');
  });

  it('round trips recorded values when editing and supports legacy INR expenses', () => {
    const expense = { id: 1, title: 'Tickets', amount: 835, originalCurrency: 'USD', originalAmount: 10, exchangeRate: 83.5, category: 'TICKETS', expenseDate: '2026-10-12', paidById: 1, splitType: 'EQUAL', splits: [] } as unknown as Expense;
    component.openEditExpense(expense);
    expect(component.expenseForm.value.originalAmount).toBe(10);
    expect(component.expenseForm.value.exchangeRate).toBe(83.5);
    component.openEditExpense({ ...expense, originalCurrency: undefined, originalAmount: undefined, exchangeRate: undefined });
    expect(component.expenseForm.value.originalCurrency).toBe('INR');
    expect(component.expenseForm.value.originalAmount).toBe(835);
  });

  it('does not submit when edit permission has been removed', () => {
    component.canEdit = false;
    component.saveExpense();
    expect(service.createExpense).not.toHaveBeenCalled();
  });
});
