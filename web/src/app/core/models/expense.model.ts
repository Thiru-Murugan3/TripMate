export type ExpenseCategory =
  | 'HOTEL'
  | 'FOOD'
  | 'FUEL'
  | 'TOLL'
  | 'TICKETS'
  | 'ACTIVITIES'
  | 'SHOPPING'
  | 'PARKING'
  | 'TRANSPORT'
  | 'OTHER';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';
export type SettlementStatus = 'PENDING' | 'SETTLED';

export interface ExpenseSplit {
  id: number;
  userId: number;
  userName: string;
  shareAmount: number;
  percentage?: number;
  settlementStatus: SettlementStatus;
}

export interface Expense {
  id: number;
  tripId: number;
  paidById: number;
  paidByName: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  splitType: SplitType;
  notes?: string;
  splits: ExpenseSplit[];
  createdAt?: string;
}

export interface ExpenseSplitDetailRequest {
  userId: number;
  amount?: number;
  percentage?: number;
}

export interface CreateExpenseRequest {
  title: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  paidById?: number;
  splitType: SplitType;
  splits?: ExpenseSplitDetailRequest[];
  notes?: string;
}

export interface UpdateExpenseRequest extends CreateExpenseRequest {}

export interface ExpenseMemberBalance {
  userId: number;
  userName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface SuggestedSettlement {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
}

export interface ExpenseSummary {
  tripId: number;
  totalTripBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  budgetUtilizationPercentage: number;
  categoryBreakdown: Partial<Record<ExpenseCategory, number>>;
  memberBalances: ExpenseMemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
}

export interface CreateCustomSplitRequest {
  splitType: SplitType;
  splits: Array<{
    userId: number;
    shareAmount: number;
    percentage?: number;
  }>;
}
