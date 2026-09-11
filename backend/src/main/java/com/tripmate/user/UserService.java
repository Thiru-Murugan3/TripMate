package com.tripmate.user;

import com.tripmate.document.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        User user = findUserOrThrow(userId);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateUserProfile(Long userId, UpdateProfileRequest request) {
        User user = findUserOrThrow(userId);

        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }
        if (request.getMobile() != null) {
            user.setMobile(request.getMobile().trim());
        }
        if (request.getEmergencyContact() != null) {
            user.setEmergencyContact(request.getEmergencyContact().trim());
        }
        if (request.getTravelPreferences() != null) {
            user.setTravelPreferences(request.getTravelPreferences().trim());
        }

        User updated = userRepository.save(user);
        return UserProfileResponse.from(updated);
    }

    @Transactional
    public UserProfileResponse uploadProfilePhoto(Long userId, MultipartFile file) {
        User user = findUserOrThrow(userId);

        // Delete old photo if exists
        if (user.getProfilePhotoUrl() != null) {
            fileStorageService.deleteFile(user.getProfilePhotoUrl());
        }

        String photoUrl = fileStorageService.storeProfilePhoto(file, userId);
        user.setProfilePhotoUrl(photoUrl);

        User updated = userRepository.save(user);
        return UserProfileResponse.from(updated);
    }

    @Transactional
    public UserProfileResponse deleteProfilePhoto(Long userId) {
        User user = findUserOrThrow(userId);

        if (user.getProfilePhotoUrl() != null) {
            fileStorageService.deleteFile(user.getProfilePhotoUrl());
            user.setProfilePhotoUrl(null);
            userRepository.save(user);
        }

        return UserProfileResponse.from(user);
    }

    private User findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
    }
}
