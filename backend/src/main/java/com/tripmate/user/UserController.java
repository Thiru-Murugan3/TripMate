package com.tripmate.user;

import com.tripmate.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 1. GET /api/v1/users/me
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                userService.getUserProfile(userPrincipal.getId())
        );
    }

    // 2. PUT /api/v1/users/me
    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(
                userService.updateUserProfile(userPrincipal.getId(), request)
        );
    }

    // 3. POST /api/v1/users/me/profile-photo
    @PostMapping(path = "/me/profile-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> uploadProfilePhoto(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(
                userService.uploadProfilePhoto(userPrincipal.getId(), file)
        );
    }

    // 4. DELETE /api/v1/users/me/profile-photo
    @DeleteMapping("/me/profile-photo")
    public ResponseEntity<UserProfileResponse> deleteProfilePhoto(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                userService.deleteProfilePhoto(userPrincipal.getId())
        );
    }
}