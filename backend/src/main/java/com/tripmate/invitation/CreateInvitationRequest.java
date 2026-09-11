package com.tripmate.invitation;

import com.tripmate.member.TripRole;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateInvitationRequest {

    private String email;
    private String mobileNumber;

    @NotNull(message = "Invitation role is required")
    private TripRole role;

    private InvitationType type;
}
