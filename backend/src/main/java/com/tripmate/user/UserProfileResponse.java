package com.tripmate.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {

    private Long id;
    private String name;
    private String email;
    private String mobile;
    private String profilePhotoUrl;
    private String emergencyContact;
    private String travelPreferences;

    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .profilePhotoUrl(user.getProfilePhotoUrl())
                .emergencyContact(user.getEmergencyContact())
                .travelPreferences(user.getTravelPreferences())
                .build();
    }
}
