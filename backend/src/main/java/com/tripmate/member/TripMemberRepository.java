package com.tripmate.member;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripMemberRepository extends JpaRepository<TripMember, Long> {

    List<TripMember> findByTripIdAndMemberStatus(Long tripId, MemberStatus status);

    List<TripMember> findByUserIdAndMemberStatus(Long userId, MemberStatus status);

    Optional<TripMember> findByTripIdAndUserIdAndMemberStatus(Long tripId, Long userId, MemberStatus status);

    Optional<TripMember> findByTripIdAndUserId(Long tripId, Long userId);

    boolean existsByTripIdAndUserIdAndMemberStatus(Long tripId, Long userId, MemberStatus status);
}
