package com.tripmate.member;

import java.time.LocalDateTime;

public record TripMemberResponse(
        Long id,
        Long tripId,
        Long userId,
        String userName,
        String userEmail,
        String userMobile,
        TripRole role,
        MemberStatus memberStatus,
        LocalDateTime joinedAt
) {
    public static TripMemberResponse from(TripMember member) {
        return new TripMemberResponse(
                member.getId(),
                member.getTrip().getId(),
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                member.getUser().getMobile(),
                member.getRole(),
                member.getMemberStatus(),
                member.getJoinedAt()
        );
    }
}
