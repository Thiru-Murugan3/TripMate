package com.tripmate.expense;

import java.util.List;

public record CreateEqualSplitRequest(
        List<Long> memberIds
) {
}
