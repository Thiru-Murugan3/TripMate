package com.tripmate.invitation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripInvitationRepository extends JpaRepository<TripInvitation, Long> {

    List<TripInvitation> findByTripIdOrderByCreatedAtDesc(Long tripId);

    Optional<TripInvitation> findByIdAndTripId(Long id, Long tripId);

    Optional<TripInvitation> findByTokenHash(String tokenHash);

    List<TripInvitation> findByInviteeEmailIgnoreCaseAndStatus(String email, InvitationStatus status);

    List<TripInvitation> findByInviteeMobileAndStatus(String mobile, InvitationStatus status);

    boolean existsByTripIdAndInviteeEmailIgnoreCaseAndStatus(Long tripId, String email, InvitationStatus status);

    boolean existsByTripIdAndInviteeMobileAndStatus(Long tripId, String mobile, InvitationStatus status);
}
