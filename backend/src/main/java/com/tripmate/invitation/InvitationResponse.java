package com.tripmate.invitation;

import com.tripmate.member.TripRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationResponse {

    private Long id;
    private Long tripId;
    private String tripName;
    private Long inviterId;
    private String inviterName;
    private String inviteeEmail;
    private String inviteeMobile;
    private TripRole role;
    private InvitationStatus status;
    private InvitationType type;
    private String inviteLink;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;

    public static InvitationResponse from(TripInvitation invitation, String rawToken) {
        String link = rawToken != null ? "http://localhost:4200/invite/" + rawToken : null;

        return InvitationResponse.builder()
                .id(invitation.getId())
                .tripId(invitation.getTrip().getId())
                .tripName(invitation.getTrip().getName())
                .inviterId(invitation.getInviter().getId())
                .inviterName(invitation.getInviter().getName())
                .inviteeEmail(invitation.getInviteeEmail())
                .inviteeMobile(invitation.getInviteeMobile())
                .role(invitation.getRole())
                .status(invitation.getStatus())
                .type(invitation.getType())
                .inviteLink(link)
                .expiresAt(invitation.getExpiresAt())
                .createdAt(invitation.getCreatedAt())
                .build();
    }
}
