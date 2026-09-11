package com.tripmate.user;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @Size(max = 120, message = "Name cannot exceed 120 characters")
    private String name;

    @Size(max = 20, message = "Mobile number cannot exceed 20 characters")
    private String mobile;

    @Size(max = 20, message = "Emergency contact cannot exceed 20 characters")
    private String emergencyContact;

    private String travelPreferences;
}
