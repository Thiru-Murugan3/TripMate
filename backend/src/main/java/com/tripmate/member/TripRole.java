package com.tripmate.member;

public enum TripRole {
    OWNER, EDITOR, PLANNER, EXPENSE_MANAGER, VIEWER;

    public boolean canEditContent() { return this == OWNER || this == EDITOR; }
    public boolean canPlan() { return canEditContent() || this == PLANNER; }
    public boolean canManageExpenses() { return canEditContent() || this == EXPENSE_MANAGER; }
}
