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
        return toResponse(findUserOrThrow(userId));
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

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserProfileResponse uploadProfilePhoto(Long userId, MultipartFile file) {
        User user = findUserOrThrow(userId);
        String oldPhotoReference = user.getProfilePhotoUrl();
        String newPhotoReference = fileStorageService.storeProfilePhoto(file, userId);

        try {
            user.setProfilePhotoUrl(newPhotoReference);
            User updated = userRepository.save(user);

            if (oldPhotoReference != null && !oldPhotoReference.equals(newPhotoReference)) {
                fileStorageService.deleteFile(oldPhotoReference);
            }
            return toResponse(updated);
        } catch (RuntimeException ex) {
            fileStorageService.deleteFile(newPhotoReference);
            throw ex;
        }
    }

    @Transactional
    public UserProfileResponse deleteProfilePhoto(Long userId) {
        User user = findUserOrThrow(userId);
        String photoReference = user.getProfilePhotoUrl();

        if (photoReference != null) {
            user.setProfilePhotoUrl(null);
            userRepository.save(user);
            fileStorageService.deleteFile(photoReference);
        }

        return toResponse(user);
    }

    private UserProfileResponse toResponse(User user) {
        UserProfileResponse response = UserProfileResponse.from(user);
        if (user.getProfilePhotoUrl() != null
                && user.getProfilePhotoUrl().startsWith("r2://")) {
            response.setProfilePhotoUrl(
                    fileStorageService.createPresignedGetUrl(
                            user.getProfilePhotoUrl(),
                            "profile-photo",
                            null
                    )
            );
        }
        return response;
    }

    private User findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
    }
}
