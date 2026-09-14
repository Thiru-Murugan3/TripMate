import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import {
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  ExpenseSplit,
  ExpenseSplitDetailRequest,
  ExpenseSummary,
  SplitType,
  UpdateExpenseRequest
} from '../../../core/models/expense.model';
import { Trip, TripMember } from '../../../core/models/trip.model';
import { ExpenseService } from '../../../core/services/expense.service';

interface ExpenseUserOption {
  userId: number;
  userName: string;
  role: string;
}

interface SplitDraft {
  userId: number;
  userName: string;
  selected: boolean;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <section class="expense-page">
      <div class="expense-toolbar">
        <div>
          <span class="eyebrow">EXPENSES</span>
          <h2>Trip Expenses & Splitting</h2>
          <p>Track spending, split costs with members and settle pending shares.</p>
        </div>

        <button *ngIf="canEdit" type="button" class="btn primary" (click)="openCreateExpense()">
          <span class="material-symbols-outlined">add</span>
          Add Expense
        </button>
      </div>

      <div *ngIf="isLoading" class="state-card">
        <div class="spinner"></div>
        <span>Loading expenses...</span>
      </div>

      <div *ngIf="!isLoading && loadError" class="state-card error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Unable to load expenses</strong>
          <p>{{ loadError }}</p>
        </div>
        <button type="button" class="btn secondary" (click)="loadAll()">Retry</button>
      </div>

      <ng-container *ngIf="!isLoading && !loadError">
        <div class="budget-summary">
          <article>
            <span>Total Budget</span>
            <strong>{{ formatCurrency(summary?.totalTripBudget || trip.budget || 0) }}</strong>
          </article>
          <article>
            <span>Total Spent</span>
            <strong class="spent">{{ formatCurrency(summary?.totalExpenses || 0) }}</strong>
          </article>
          <article>
            <span>Remaining</span>
            <strong [class.negative]="(summary?.remainingBudget || 0) < 0">
              {{ formatCurrency(summary?.remainingBudget || 0) }}
            </strong>
          </article>
          <article>
            <span>Budget Used</span>
            <strong>{{ formatPercent(summary?.budgetUtilizationPercentage || 0) }}</strong>
          </article>
        </div>

        <div class="budget-progress">
          <div
            class="budget-progress-fill"
            [class.over-budget]="(summary?.budgetUtilizationPercentage || 0) > 100"
            [style.width.%]="progressWidth"
          ></div>
        </div>

        <div class="expense-controls">
          <label class="search-box">
            <span class="material-symbols-outlined">search</span>
            <input
              [(ngModel)]="searchTerm"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Search expenses..."
            />
          </label>

          <select
            [(ngModel)]="categoryFilter"
            [ngModelOptions]="{ standalone: true }"
            aria-label="Filter expense category"
          >
            <option value="ALL">All Categories</option>
            <option *ngFor="let category of categories" [value]="category">
              {{ formatCategory(category) }}
            </option>
          </select>

          <button
            *ngIf="searchTerm || categoryFilter !== 'ALL'"
            type="button"
            class="clear-filter"
            (click)="clearFilters()"
          >
            Clear
          </button>
        </div>

        <div class="expense-layout">
          <div class="expense-list-column">
            <div *ngIf="expenses.length === 0" class="empty-state">
              <span class="material-symbols-outlined">receipt_long</span>
              <h3>No expenses yet</h3>
              <p>Add your first trip expense to start tracking the budget.</p>
              <button *ngIf="canEdit" type="button" class="btn primary" (click)="openCreateExpense()">
                Add First Expense
              </button>
            </div>

            <div *ngIf="expenses.length > 0 && filteredExpenses.length === 0" class="empty-state">
              <span class="material-symbols-outlined">search_off</span>
              <h3>No expenses match</h3>
              <p>Try a different search or category.</p>
              <button type="button" class="btn secondary" (click)="clearFilters()">Reset Filters</button>
            </div>

            <div *ngIf="filteredExpenses.length > 0" class="expense-list">
              <article *ngFor="let expense of filteredExpenses" class="expense-card">
                <div class="expense-card-main">
                  <div class="category-icon" [attr.data-category]="expense.category">
                    <span class="material-symbols-outlined">{{ categoryIcon(expense.category) }}</span>
                  </div>

                  <div class="expense-info">
                    <div class="title-line">
                      <h3>{{ expense.title }}</h3>
                      <span class="category-pill">{{ formatCategory(expense.category) }}</span>
                    </div>
                    <p>
                      {{ formatDate(expense.expenseDate) }}
                      · Paid by {{ expense.paidByName }}
                      · {{ formatSplitType(expense.splitType) }}
                    </p>
                    <p *ngIf="expense.notes" class="notes">{{ expense.notes }}</p>
                  </div>

                  <div class="expense-amount">
                    <strong>{{ formatCurrency(expense.amount) }}</strong>
                    <small>{{ expense.splits.length }} split{{ expense.splits.length === 1 ? '' : 's' }}</small>
                  </div>
                </div>

                <div class="expense-card-actions">
                  <button type="button" class="text-action" (click)="toggleExpense(expense.id)">
                    <span class="material-symbols-outlined">
                      {{ isExpanded(expense.id) ? 'expand_less' : 'splitscreen' }}
                    </span>
                    {{ isExpanded(expense.id) ? 'Hide Split' : 'View Split' }}
                  </button>

                  <div *ngIf="canEdit" class="edit-actions">
                    <button type="button" class="icon-btn" title="Edit expense" (click)="openEditExpense(expense)">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Delete expense"
                      [disabled]="deletingExpenseId === expense.id"
                      (click)="deleteExpense(expense)"
                    >
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>

                <div *ngIf="isExpanded(expense.id)" class="split-panel">
                  <div class="split-heading">
                    <strong>Expense Split</strong>
                    <span>
                      {{ pendingSplitCount(expense) }} pending ·
                      {{ settledSplitCount(expense) }} settled
                    </span>
                  </div>

                  <div *ngFor="let split of expense.splits" class="split-row">
                    <div class="split-person">
                      <span class="avatar">{{ initials(split.userName) }}</span>
                      <div>
                        <strong>{{ split.userName }}</strong>
                        <small *ngIf="split.userId === expense.paidById">Paid this expense</small>
                      </div>
                    </div>

                    <div class="split-value">
                      <strong>{{ formatCurrency(split.shareAmount) }}</strong>
                      <small *ngIf="split.percentage !== undefined && split.percentage !== null">
                        {{ formatPercent(split.percentage) }}
                      </small>
                    </div>

                    <span class="settlement-pill" [attr.data-status]="split.settlementStatus">
                      {{ split.settlementStatus }}
                    </span>

                    <button
                      *ngIf="
                        canEdit &&
                        split.settlementStatus === 'PENDING' &&
                        split.userId !== expense.paidById
                      "
                      type="button"
                      class="settle-btn"
                      [disabled]="settlingSplitId === split.id"
                      (click)="settleSplit(expense, split)"
                    >
                      {{ settlingSplitId === split.id ? 'Saving...' : 'Mark Settled' }}
                    </button>

                    <span
                      *ngIf="split.userId === expense.paidById"
                      class="own-share"
                    >
                      Own share
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <aside class="expense-sidebar">
            <article class="sidebar-card">
              <div class="sidebar-title">
                <h3>Member Balances</h3>
                <span>{{ summary?.memberBalances?.length || 0 }}</span>
              </div>

              <div *ngIf="!summary?.memberBalances?.length" class="sidebar-empty">
                No balances yet.
              </div>

              <div *ngFor="let balance of summary?.memberBalances" class="balance-row">
                <div class="balance-person">
                  <span class="avatar">{{ initials(balance.userName) }}</span>
                  <div>
                    <strong>{{ balance.userName }}</strong>
                    <small>
                      Paid {{ formatCurrency(balance.totalPaid) }} ·
                      Owes {{ formatCurrency(balance.totalOwed) }}
                    </small>
                  </div>
                </div>
                <strong
                  class="net-value"
                  [class.positive]="balance.netBalance > 0"
                  [class.negative]="balance.netBalance < 0"
                >
                  {{ signedCurrency(balance.netBalance) }}
                </strong>
              </div>
            </article>

            <article class="sidebar-card">
              <h3>Suggested Settlements</h3>

              <div *ngIf="!summary?.suggestedSettlements?.length" class="sidebar-empty">
                Nothing to settle right now.
              </div>

              <div
                *ngFor="let settlement of summary?.suggestedSettlements"
                class="suggested-row"
              >
                <div>
                  <strong>{{ settlement.fromUserName }}</strong>
                  <span class="material-symbols-outlined">arrow_forward</span>
                  <strong>{{ settlement.toUserName }}</strong>
                </div>
                <span>{{ formatCurrency(settlement.amount) }}</span>
              </div>

              <p *ngIf="summary?.suggestedSettlements?.length" class="settlement-help">
                Mark individual expense shares as settled from the expense cards.
              </p>
            </article>

            <article class="sidebar-card">
              <h3>Category Breakdown</h3>
              <div *ngFor="let entry of categoryBreakdownEntries" class="category-breakdown-row">
                <span>{{ formatCategory(entry.category) }}</span>
                <strong>{{ formatCurrency(entry.amount) }}</strong>
              </div>
            </article>
          </aside>
        </div>
      </ng-container>

      <div *ngIf="showExpenseModal" class="modal-backdrop">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingExpense ? 'Edit Expense' : 'Add Expense' }}</h3>
              <p>Record the expense and choose how it should be split.</p>
            </div>
            <button type="button" class="close-btn" (click)="closeExpenseModal()" aria-label="Close">
              &times;
            </button>
          </div>

          <div *ngIf="formError" class="form-error">{{ formError }}</div>

          <form [formGroup]="expenseForm" (ngSubmit)="saveExpense()">
            <label class="field">
              <span>Expense Title *</span>
              <input formControlName="title" maxlength="180" placeholder="Hotel booking" />
            </label>

            <div class="form-grid two">
              <label class="field">
                <span>Amount (₹) *</span>
                <input type="number" min="0.01" step="0.01" formControlName="amount" />
              </label>

              <label class="field">
                <span>Category *</span>
                <select formControlName="category">
                  <option *ngFor="let category of categories" [value]="category">
                    {{ formatCategory(category) }}
                  </option>
                </select>
              </label>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Expense Date *</span>
                <input
                  type="date"
                  [min]="trip.startDate"
                  [max]="trip.endDate"
                  formControlName="expenseDate"
                />
              </label>

              <label class="field">
                <span>Paid By *</span>
                <select formControlName="paidById">
                  <option *ngFor="let user of expenseUsers" [value]="user.userId">
                    {{ user.userName }} · {{ user.role }}
                  </option>
                </select>
              </label>
            </div>

            <label class="field">
              <span>Split Type *</span>
              <select formControlName="splitType" (change)="onSplitTypeChanged()">
                <option value="EQUAL">Equal</option>
                <option value="EXACT">Exact Amount</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </label>

            <div class="split-editor">
              <div class="split-editor-heading">
                <div>
                  <strong>Split Between</strong>
                  <p>{{ splitInstruction }}</p>
                </div>
                <button type="button" class="select-all-btn" (click)="toggleAllMembers()">
                  {{ allSelected ? 'Clear All' : 'Select All' }}
                </button>
              </div>

              <div *ngFor="let draft of splitDrafts" class="split-edit-row">
                <label class="member-check">
                  <input
                    type="checkbox"
                    [(ngModel)]="draft.selected"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  <span class="avatar">{{ initials(draft.userName) }}</span>
                  <span>{{ draft.userName }}</span>
                </label>

                <strong *ngIf="selectedSplitType === 'EQUAL' && draft.selected" class="equal-share">
                  {{ formatCurrency(equalShareAmount) }}
                </strong>

                <label *ngIf="selectedSplitType === 'EXACT' && draft.selected" class="split-input">
                  <span>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    [(ngModel)]="draft.amount"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </label>

                <label *ngIf="selectedSplitType === 'PERCENTAGE' && draft.selected" class="split-input">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    [(ngModel)]="draft.percentage"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  <span>%</span>
                </label>
              </div>

              <div class="split-total" [class.invalid]="!!splitValidationMessage">
                <span>
                  {{
                    selectedSplitType === 'EXACT'
                      ? 'Split Total'
                      : selectedSplitType === 'PERCENTAGE'
                        ? 'Percentage Total'
                        : 'Selected Members'
                  }}
                </span>
                <strong>
                  {{
                    selectedSplitType === 'EXACT'
                      ? formatCurrency(exactSplitTotal)
                      : selectedSplitType === 'PERCENTAGE'
                        ? formatPercent(percentageSplitTotal)
                        : selectedMemberCount
                  }}
                </strong>
              </div>

              <div *ngIf="splitValidationMessage" class="split-warning">
                {{ splitValidationMessage }}
              </div>
            </div>

            <label class="field">
              <span>Notes</span>
              <textarea formControlName="notes" rows="3" placeholder="Optional expense notes"></textarea>
            </label>

            <div *ngIf="editingExpense" class="edit-warning">
              <span class="material-symbols-outlined">info</span>
              Editing an expense recalculates its split using the values above.
            </div>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="closeExpenseModal()">Cancel</button>
              <button
                type="submit"
                class="btn primary"
                [disabled]="!canSubmitExpense"
              >
                {{ isSavingExpense ? 'Saving...' : (editingExpense ? 'Save Changes' : 'Add Expense') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .expense-page { color:#0f172a; }
    .expense-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .expense-toolbar h2 { margin:.15rem 0 .25rem; font-size:1.15rem; }
    .expense-toolbar p { margin:0; color:#64748b; font-size:.82rem; }
    .eyebrow { color:#2563eb; font-size:.66rem; font-weight:850; letter-spacing:.08em; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.62rem .9rem; border:0; border-radius:9px; font-weight:800; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }

    .budget-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.75rem; }
    .budget-summary article { padding:.9rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
    .budget-summary span { display:block; color:#64748b; font-size:.65rem; font-weight:850; text-transform:uppercase; }
    .budget-summary strong { display:block; margin-top:.35rem; font-size:1.05rem; }
    .budget-summary .spent { color:#2563eb; }
    .negative { color:#dc2626 !important; }
    .positive { color:#059669 !important; }
    .budget-progress { height:7px; margin:.65rem 0 1rem; overflow:hidden; border-radius:999px; background:#e2e8f0; }
    .budget-progress-fill { height:100%; border-radius:inherit; background:#2563eb; transition:width .2s ease; }
    .budget-progress-fill.over-budget { background:#dc2626; }

    .expense-controls { display:flex; align-items:center; gap:.65rem; margin-bottom:1rem; }
    .search-box { display:flex; align-items:center; gap:.45rem; flex:1; min-width:0; padding:.58rem .7rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; }
    .search-box .material-symbols-outlined { color:#94a3b8; font-size:1rem; }
    .search-box input { width:100%; min-width:0; border:0; outline:0; color:#0f172a; font:inherit; }
    .expense-controls select { min-width:180px; padding:.62rem .7rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#334155; }
    .clear-filter { border:0; color:#2563eb; background:transparent; font-weight:800; cursor:pointer; }

    .expense-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:1rem; align-items:start; }
    .expense-list { display:flex; flex-direction:column; gap:.75rem; }
    .expense-card { overflow:hidden; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 5px 18px rgba(15,23,42,.035); }
    .expense-card-main { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.75rem; padding:1rem; align-items:flex-start; }
    .category-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:11px; color:#2563eb; background:#eff6ff; }
    .category-icon[data-category='FOOD'] { color:#dc2626; background:#fef2f2; }
    .category-icon[data-category='HOTEL'] { color:#7c3aed; background:#f5f3ff; }
    .category-icon[data-category='TRANSPORT'] { color:#d97706; background:#fff7ed; }
    .category-icon[data-category='ACTIVITIES'] { color:#059669; background:#ecfdf5; }
    .category-icon[data-category='SHOPPING'] { color:#db2777; background:#fdf2f8; }
    .title-line { display:flex; align-items:center; flex-wrap:wrap; gap:.45rem; }
    .title-line h3 { margin:0; font-size:.9rem; }
    .category-pill { display:inline-flex; padding:.2rem .42rem; border-radius:999px; color:#475569; background:#f1f5f9; font-size:.6rem; font-weight:850; }
    .expense-info > p { margin:.28rem 0 0; color:#64748b; font-size:.7rem; }
    .expense-info .notes { color:#475569; line-height:1.4; }
    .expense-amount { display:flex; flex-direction:column; align-items:flex-end; gap:.2rem; }
    .expense-amount strong { font-size:1rem; }
    .expense-amount small { color:#94a3b8; font-size:.62rem; }
    .expense-card-actions { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.58rem 1rem; border-top:1px solid #f1f5f9; background:#fafcff; }
    .text-action { display:inline-flex; align-items:center; gap:.3rem; border:0; color:#2563eb; background:transparent; font-size:.7rem; font-weight:800; cursor:pointer; }
    .text-action .material-symbols-outlined { font-size:.95rem; }
    .edit-actions { display:flex; gap:.3rem; }
    .icon-btn { display:grid; place-items:center; width:30px; height:30px; border:0; border-radius:8px; color:#475569; background:#fff; cursor:pointer; }
    .icon-btn.danger { color:#dc2626; }
    .icon-btn .material-symbols-outlined { font-size:1rem; }
    .icon-btn:disabled { opacity:.4; cursor:not-allowed; }

    .split-panel { padding:.85rem 1rem 1rem; border-top:1px solid #e2e8f0; }
    .split-heading { display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-bottom:.6rem; font-size:.72rem; }
    .split-heading span { color:#64748b; }
    .split-row { display:grid; grid-template-columns:minmax(0,1fr) 100px 90px 110px; align-items:center; gap:.6rem; padding:.55rem 0; border-top:1px solid #f1f5f9; }
    .split-person { display:flex; align-items:center; gap:.55rem; min-width:0; }
    .split-person > div { display:flex; min-width:0; flex-direction:column; }
    .split-person strong { overflow:hidden; font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
    .split-person small { color:#94a3b8; font-size:.6rem; }
    .avatar { display:grid; place-items:center; width:30px; height:30px; min-width:30px; border-radius:50%; color:#fff; background:linear-gradient(135deg,#0f172a,#2563eb); font-size:.65rem; font-weight:850; }
    .split-value { display:flex; flex-direction:column; align-items:flex-end; }
    .split-value strong { font-size:.72rem; }
    .split-value small { color:#94a3b8; font-size:.6rem; }
    .settlement-pill { display:inline-flex; justify-content:center; padding:.22rem .38rem; border-radius:999px; color:#b45309; background:#fef3c7; font-size:.56rem; font-weight:850; }
    .settlement-pill[data-status='SETTLED'] { color:#047857; background:#d1fae5; }
    .settle-btn { border:0; border-radius:7px; padding:.38rem .48rem; color:#047857; background:#ecfdf5; font-size:.62rem; font-weight:800; cursor:pointer; }
    .settle-btn:disabled { opacity:.5; cursor:not-allowed; }
    .own-share { color:#94a3b8; font-size:.62rem; text-align:center; }

    .expense-sidebar { display:flex; flex-direction:column; gap:.8rem; }
    .sidebar-card { padding:1rem; border:1px solid #e2e8f0; border-radius:13px; background:#fff; }
    .sidebar-card h3 { margin:0 0 .75rem; font-size:.84rem; }
    .sidebar-title { display:flex; align-items:center; justify-content:space-between; gap:.6rem; }
    .sidebar-title span { color:#64748b; font-size:.65rem; }
    .balance-row { display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.58rem 0; border-top:1px solid #f1f5f9; }
    .balance-person { display:flex; align-items:center; gap:.5rem; min-width:0; }
    .balance-person > div { display:flex; min-width:0; flex-direction:column; }
    .balance-person strong { overflow:hidden; font-size:.7rem; text-overflow:ellipsis; white-space:nowrap; }
    .balance-person small { color:#94a3b8; font-size:.58rem; }
    .net-value { font-size:.7rem; white-space:nowrap; }
    .sidebar-empty { color:#94a3b8; font-size:.7rem; }
    .suggested-row { display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.55rem 0; border-top:1px solid #f1f5f9; font-size:.67rem; }
    .suggested-row > div { display:flex; align-items:center; gap:.25rem; min-width:0; }
    .suggested-row .material-symbols-outlined { color:#94a3b8; font-size:.85rem; }
    .settlement-help { margin:.6rem 0 0; color:#94a3b8; font-size:.62rem; line-height:1.4; }
    .category-breakdown-row { display:flex; justify-content:space-between; gap:.7rem; padding:.45rem 0; border-top:1px solid #f1f5f9; color:#64748b; font-size:.68rem; }
    .category-breakdown-row strong { color:#334155; }

    .empty-state,.state-card { display:flex; align-items:center; justify-content:center; gap:.75rem; min-height:220px; padding:1rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; text-align:center; }
    .empty-state { flex-direction:column; }
    .empty-state > .material-symbols-outlined { color:#93c5fd; font-size:2.7rem; }
    .empty-state h3 { margin:0; }
    .empty-state p { margin:0 0 .4rem; color:#64748b; font-size:.78rem; }
    .state-card.error { color:#b91c1c; }
    .state-card.error p { margin:.15rem 0 0; color:#64748b; }
    .spinner { width:28px; height:28px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .75s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .modal-backdrop { position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(15,23,42,.62); backdrop-filter:blur(5px); }
    .modal { width:min(100%,720px); max-height:92vh; overflow:auto; padding:1.35rem; border-radius:16px; background:#fff; box-shadow:0 22px 50px rgba(15,23,42,.22); }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .modal-header h3 { margin:0; }
    .modal-header p { margin:.2rem 0 0; color:#64748b; font-size:.78rem; }
    .close-btn { border:0; color:#64748b; background:transparent; font-size:1.7rem; cursor:pointer; }
    .form-error { margin-bottom:.8rem; padding:.7rem .8rem; border-radius:8px; color:#b91c1c; background:#fee2e2; font-size:.78rem; }
    .field { display:flex; flex-direction:column; gap:.3rem; margin-bottom:.8rem; color:#334155; font-size:.75rem; font-weight:750; }
    .field input,.field select,.field textarea { width:100%; box-sizing:border-box; padding:.65rem .72rem; border:1px solid #cbd5e1; border-radius:8px; color:#0f172a; background:#fff; font:inherit; font-weight:500; }
    .form-grid.two { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }

    .split-editor { margin:.3rem 0 .9rem; padding:.9rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
    .split-editor-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; margin-bottom:.6rem; }
    .split-editor-heading strong { font-size:.78rem; }
    .split-editor-heading p { margin:.12rem 0 0; color:#64748b; font-size:.64rem; }
    .select-all-btn { border:0; color:#2563eb; background:transparent; font-size:.65rem; font-weight:800; cursor:pointer; }
    .split-edit-row { display:grid; grid-template-columns:minmax(0,1fr) 130px; align-items:center; gap:.7rem; padding:.5rem 0; border-top:1px solid #e2e8f0; }
    .member-check { display:flex; align-items:center; gap:.5rem; min-width:0; font-size:.72rem; cursor:pointer; }
    .member-check input { accent-color:#2563eb; }
    .member-check > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .equal-share { text-align:right; font-size:.72rem; }
    .split-input { display:flex; align-items:center; gap:.3rem; }
    .split-input input { width:100%; min-width:0; padding:.45rem .5rem; border:1px solid #cbd5e1; border-radius:7px; }
    .split-input span { color:#64748b; font-size:.7rem; }
    .split-total { display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-top:.6rem; padding-top:.65rem; border-top:1px solid #cbd5e1; font-size:.72rem; }
    .split-total.invalid strong { color:#dc2626; }
    .split-warning { margin-top:.5rem; padding:.55rem .65rem; border-radius:8px; color:#b45309; background:#fffbeb; font-size:.65rem; }
    .edit-warning { display:flex; align-items:flex-start; gap:.4rem; padding:.65rem .75rem; border-radius:8px; color:#475569; background:#f8fafc; font-size:.68rem; }
    .edit-warning .material-symbols-outlined { color:#2563eb; font-size:.9rem; }
    .modal-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }

    @media(max-width:1000px){
      .expense-layout { grid-template-columns:1fr; }
      .expense-sidebar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
      .expense-sidebar .sidebar-card:last-child { grid-column:1 / -1; }
    }

    @media(max-width:720px){
      .expense-toolbar { align-items:stretch; flex-direction:column; }
      .expense-toolbar .btn { width:100%; }
      .budget-summary { grid-template-columns:1fr 1fr; }
      .expense-controls { align-items:stretch; flex-direction:column; }
      .expense-controls select { width:100%; min-width:0; }
      .expense-card-main { grid-template-columns:auto minmax(0,1fr); }
      .expense-amount { grid-column:2; align-items:flex-start; }
      .split-row { grid-template-columns:minmax(0,1fr) auto; }
      .split-value { align-items:flex-end; }
      .settlement-pill,.settle-btn,.own-share { grid-column:2; }
      .expense-sidebar { grid-template-columns:1fr; }
      .expense-sidebar .sidebar-card:last-child { grid-column:auto; }
      .form-grid.two { grid-template-columns:1fr; gap:0; }
    }

    @media(max-width:480px){
      .budget-summary { grid-template-columns:1fr; }
      .split-edit-row { grid-template-columns:1fr; }
      .equal-share { text-align:left; padding-left:2.2rem; }
    }
  `]
})
export class ExpenseManagerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);

  @Input({ required: true }) tripId = 0;
  @Input({ required: true }) trip!: Trip;
  @Input() members: TripMember[] = [];
  @Input() canEdit = false;
  @Input() openRequest = 0;
  @Output() expensesChanged = new EventEmitter<void>();

  expenses: Expense[] = [];
  summary: ExpenseSummary | null = null;

  searchTerm = '';
  categoryFilter: 'ALL' | ExpenseCategory = 'ALL';
  isLoading = true;
  loadError = '';
  showExpenseModal = false;
  editingExpense: Expense | null = null;
  isSavingExpense = false;
  deletingExpenseId: number | null = null;
  settlingSplitId: number | null = null;
  formError = '';
  splitDrafts: SplitDraft[] = [];
  expandedExpenseIds = new Set<number>();

  readonly categories: ExpenseCategory[] = [
    'HOTEL',
    'FOOD',
    'FUEL',
    'TOLL',
    'TICKETS',
    'ACTIVITIES',
    'SHOPPING',
    'PARKING',
    'TRANSPORT',
    'OTHER'
  ];

  expenseForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(180)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    category: ['FOOD' as ExpenseCategory, Validators.required],
    expenseDate: ['', Validators.required],
    paidById: [0, [Validators.required, Validators.min(1)]],
    splitType: ['EQUAL' as SplitType, Validators.required],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadAll();
    if (this.openRequest > 0 && this.canEdit) {
      queueMicrotask(() => this.openCreateExpense());
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && !changes['tripId'].firstChange && this.tripId > 0) {
      this.loadAll();
    }

    if (
      changes['openRequest'] &&
      !changes['openRequest'].firstChange &&
      this.openRequest > 0 &&
      this.canEdit
    ) {
      this.openCreateExpense();
    }

    if (changes['members'] && this.showExpenseModal && !this.editingExpense) {
      this.buildSplitDrafts();
    }
  }

  get expenseUsers(): ExpenseUserOption[] {
    const users = new Map<number, ExpenseUserOption>();

    if (this.trip?.ownerId) {
      users.set(this.trip.ownerId, {
        userId: this.trip.ownerId,
        userName: this.trip.ownerName,
        role: 'OWNER'
      });
    }

    for (const member of this.members ?? []) {
      if (member.memberStatus !== 'ACTIVE') continue;
      users.set(member.userId, {
        userId: member.userId,
        userName: member.userName,
        role: member.role
      });
    }

    return [...users.values()];
  }

  get filteredExpenses(): Expense[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.expenses.filter((expense) => {
      const categoryMatch =
        this.categoryFilter === 'ALL' || expense.category === this.categoryFilter;
      const searchMatch =
        !query ||
        expense.title.toLowerCase().includes(query) ||
        expense.paidByName.toLowerCase().includes(query) ||
        (expense.notes || '').toLowerCase().includes(query);

      return categoryMatch && searchMatch;
    });
  }

  get progressWidth(): number {
    const value = Number(this.summary?.budgetUtilizationPercentage || 0);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(value, 100);
  }

  get categoryBreakdownEntries(): Array<{ category: ExpenseCategory; amount: number }> {
    const breakdown = this.summary?.categoryBreakdown ?? {};
    return this.categories
      .map((category) => ({
        category,
        amount: Number(breakdown[category] || 0)
      }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  get selectedSplitType(): SplitType {
    return (this.expenseForm.value.splitType || 'EQUAL') as SplitType;
  }

  get selectedMemberCount(): number {
    return this.splitDrafts.filter((draft) => draft.selected).length;
  }

  get allSelected(): boolean {
    return this.splitDrafts.length > 0 &&
      this.splitDrafts.every((draft) => draft.selected);
  }

  get equalShareAmount(): number {
    if (this.selectedMemberCount === 0) return 0;
    return Number(this.expenseForm.value.amount || 0) / this.selectedMemberCount;
  }

  get exactSplitTotal(): number {
    return this.splitDrafts
      .filter((draft) => draft.selected)
      .reduce((sum, draft) => sum + Number(draft.amount || 0), 0);
  }

  get percentageSplitTotal(): number {
    return this.splitDrafts
      .filter((draft) => draft.selected)
      .reduce((sum, draft) => sum + Number(draft.percentage || 0), 0);
  }

  get splitInstruction(): string {
    if (this.selectedSplitType === 'EXACT') {
      return 'Enter each selected member\'s exact share.';
    }
    if (this.selectedSplitType === 'PERCENTAGE') {
      return 'Selected member percentages must total 100%.';
    }
    return 'The amount will be divided equally between selected members.';
  }

  get splitValidationMessage(): string {
    if (this.selectedMemberCount === 0) {
      return 'Select at least one member for the split.';
    }

    if (this.selectedSplitType === 'EXACT') {
      const amount = Number(this.expenseForm.value.amount || 0);
      if (Math.abs(this.exactSplitTotal - amount) > 0.009) {
        return `Exact split must total ${this.formatCurrency(amount)}.`;
      }
    }

    if (
      this.selectedSplitType === 'PERCENTAGE' &&
      Math.abs(this.percentageSplitTotal - 100) > 0.009
    ) {
      return 'Percentage split must total exactly 100%.';
    }

    return '';
  }

  get canSubmitExpense(): boolean {
    return this.canEdit &&
      !this.isSavingExpense &&
      this.expenseForm.valid &&
      !this.splitValidationMessage;
  }

  loadAll(): void {
    if (!this.tripId) return;

    this.isLoading = true;
    this.loadError = '';

    forkJoin({
      expenses: this.expenseService.getExpenses(this.tripId),
      summary: this.expenseService.getExpenseSummary(this.tripId)
    }).subscribe({
      next: ({ expenses, summary }) => {
        this.expenses = expenses ?? [];
        this.summary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        this.expenses = [];
        this.summary = null;
        this.loadError = err?.error?.message || 'Please try again.';
        this.isLoading = false;
      }
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = 'ALL';
  }

  openCreateExpense(): void {
    if (!this.canEdit) return;

    this.editingExpense = null;
    this.formError = '';
    this.expenseForm.reset({
      title: '',
      amount: 0,
      category: 'FOOD',
      expenseDate: this.defaultExpenseDate(),
      paidById: this.trip?.ownerId || this.expenseUsers[0]?.userId || 0,
      splitType: 'EQUAL',
      notes: ''
    });
    this.buildSplitDrafts();
    this.showExpenseModal = true;
  }

  openEditExpense(expense: Expense): void {
    if (!this.canEdit) return;

    this.editingExpense = expense;
    this.formError = '';
    this.expenseForm.reset({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      expenseDate: expense.expenseDate,
      paidById: expense.paidById,
      splitType: expense.splitType,
      notes: expense.notes || ''
    });

    this.splitDrafts = this.expenseUsers.map((user) => {
      const split = expense.splits.find((item) => item.userId === user.userId);
      return {
        userId: user.userId,
        userName: user.userName,
        selected: !!split,
        amount: Number(split?.shareAmount || 0),
        percentage: Number(split?.percentage || 0)
      };
    });

    this.showExpenseModal = true;
  }

  closeExpenseModal(): void {
    if (this.isSavingExpense) return;
    this.showExpenseModal = false;
    this.editingExpense = null;
    this.formError = '';
  }

  onSplitTypeChanged(): void {
    const selected = this.splitDrafts.filter((draft) => draft.selected);

    if (this.selectedSplitType === 'EQUAL') {
      return;
    }

    if (this.selectedSplitType === 'PERCENTAGE' && selected.length > 0) {
      const base = Math.floor((100 / selected.length) * 100) / 100;
      let used = 0;
      selected.forEach((draft, index) => {
        if (index === selected.length - 1) {
          draft.percentage = Number((100 - used).toFixed(2));
        } else {
          draft.percentage = base;
          used += base;
        }
      });
    }

    if (this.selectedSplitType === 'EXACT' && selected.length > 0) {
      const amount = Number(this.expenseForm.value.amount || 0);
      const base = Math.floor((amount / selected.length) * 100) / 100;
      let used = 0;
      selected.forEach((draft, index) => {
        if (index === selected.length - 1) {
          draft.amount = Number((amount - used).toFixed(2));
        } else {
          draft.amount = base;
          used += base;
        }
      });
    }
  }

  toggleAllMembers(): void {
    const next = !this.allSelected;
    this.splitDrafts.forEach((draft) => {
      draft.selected = next;
    });
    this.onSplitTypeChanged();
  }

  saveExpense(): void {
    if (!this.canSubmitExpense) return;

    const value = this.expenseForm.getRawValue();
    if (
      !value.expenseDate ||
      value.expenseDate < this.trip.startDate ||
      value.expenseDate > this.trip.endDate
    ) {
      this.formError = 'Expense date must be within the trip dates.';
      return;
    }

    const splits = this.buildSplitRequest();
    const request: CreateExpenseRequest | UpdateExpenseRequest = {
      title: value.title!.trim(),
      amount: Number(value.amount),
      category: value.category as ExpenseCategory,
      expenseDate: value.expenseDate,
      paidById: Number(value.paidById),
      splitType: value.splitType as SplitType,
      splits,
      notes: value.notes?.trim() || undefined
    };

    this.isSavingExpense = true;
    this.formError = '';

    const operation = this.editingExpense
      ? this.expenseService.updateExpense(
          this.tripId,
          this.editingExpense.id,
          request as UpdateExpenseRequest
        )
      : this.expenseService.createExpense(
          this.tripId,
          request as CreateExpenseRequest
        );

    operation.subscribe({
      next: () => {
        this.isSavingExpense = false;
        this.showExpenseModal = false;
        this.editingExpense = null;
        this.reloadAfterChange();
      },
      error: (err) => {
        this.isSavingExpense = false;
        this.formError = err?.error?.message || 'Unable to save expense.';
      }
    });
  }

  deleteExpense(expense: Expense): void {
    if (!this.canEdit || this.deletingExpenseId !== null) return;
    if (!window.confirm(`Delete "${expense.title}" expense?`)) return;

    this.deletingExpenseId = expense.id;
    this.expenseService.deleteExpense(this.tripId, expense.id).subscribe({
      next: () => {
        this.deletingExpenseId = null;
        this.expandedExpenseIds.delete(expense.id);
        this.reloadAfterChange();
      },
      error: (err) => {
        this.deletingExpenseId = null;
        this.loadError = err?.error?.message || 'Unable to delete expense.';
      }
    });
  }

  settleSplit(expense: Expense, split: ExpenseSplit): void {
    if (!this.canEdit || split.settlementStatus === 'SETTLED') return;
    if (split.userId === expense.paidById) return;

    if (!window.confirm(
      `Mark ${split.userName}'s ${this.formatCurrency(split.shareAmount)} share as settled?`
    )) {
      return;
    }

    this.settlingSplitId = split.id;
    this.expenseService.settleSplit(this.tripId, expense.id, split.id).subscribe({
      next: () => {
        this.settlingSplitId = null;
        this.reloadAfterChange(false);
      },
      error: (err) => {
        this.settlingSplitId = null;
        this.loadError = err?.error?.message || 'Unable to settle this expense share.';
      }
    });
  }

  toggleExpense(expenseId: number): void {
    if (this.expandedExpenseIds.has(expenseId)) {
      this.expandedExpenseIds.delete(expenseId);
    } else {
      this.expandedExpenseIds.add(expenseId);
    }
  }

  isExpanded(expenseId: number): boolean {
    return this.expandedExpenseIds.has(expenseId);
  }

  pendingSplitCount(expense: Expense): number {
    return expense.splits.filter((split) =>
      split.settlementStatus === 'PENDING' &&
      split.userId !== expense.paidById
    ).length;
  }

  settledSplitCount(expense: Expense): number {
    return expense.splits.filter((split) =>
      split.settlementStatus === 'SETTLED'
    ).length;
  }

  initials(name: string): string {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  signedCurrency(value: number): string {
    const number = Number(value || 0);
    if (number > 0) return `+${this.formatCurrency(number)}`;
    return this.formatCurrency(number);
  }

  formatPercent(value: number): string {
    const number = Number(value || 0);
    return `${number.toFixed(number % 1 === 0 ? 0 : 2)}%`;
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCategory(category: ExpenseCategory): string {
    return category
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  formatSplitType(splitType: SplitType): string {
    if (splitType === 'EXACT') return 'Exact split';
    if (splitType === 'PERCENTAGE') return 'Percentage split';
    return 'Equal split';
  }

  categoryIcon(category: ExpenseCategory): string {
    switch (category) {
      case 'HOTEL': return 'hotel';
      case 'FOOD': return 'restaurant';
      case 'FUEL': return 'local_gas_station';
      case 'TOLL': return 'toll';
      case 'TICKETS': return 'confirmation_number';
      case 'ACTIVITIES': return 'attractions';
      case 'SHOPPING': return 'shopping_bag';
      case 'PARKING': return 'local_parking';
      case 'TRANSPORT': return 'commute';
      default: return 'receipt_long';
    }
  }

  private buildSplitDrafts(): void {
    this.splitDrafts = this.expenseUsers.map((user) => ({
      userId: user.userId,
      userName: user.userName,
      selected: true,
      amount: 0,
      percentage: 0
    }));
  }

  private buildSplitRequest(): ExpenseSplitDetailRequest[] {
    return this.splitDrafts
      .filter((draft) => draft.selected)
      .map((draft) => {
        if (this.selectedSplitType === 'EXACT') {
          return {
            userId: draft.userId,
            amount: Number(draft.amount || 0)
          };
        }

        if (this.selectedSplitType === 'PERCENTAGE') {
          return {
            userId: draft.userId,
            percentage: Number(draft.percentage || 0)
          };
        }

        return {
          userId: draft.userId
        };
      });
  }

  private defaultExpenseDate(): string {
    const today = new Date();
    const localToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    if (localToday < this.trip.startDate) return this.trip.startDate;
    if (localToday > this.trip.endDate) return this.trip.endDate;
    return localToday;
  }

  private reloadAfterChange(emitChange = true): void {
    forkJoin({
      expenses: this.expenseService.getExpenses(this.tripId),
      summary: this.expenseService.getExpenseSummary(this.tripId)
    }).subscribe({
      next: ({ expenses, summary }) => {
        this.expenses = expenses ?? [];
        this.summary = summary;
        if (emitChange) this.expensesChanged.emit();
        else this.expensesChanged.emit();
      },
      error: () => {
        this.loadAll();
        this.expensesChanged.emit();
      }
    });
  }
}
