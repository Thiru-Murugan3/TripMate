package com.tripmate.user;

import com.tripmate.document.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .name("Alex Smith")
                .email("alex@example.com")
                .mobile("9876543210")
                .systemRole(SystemRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("getUserProfile: Returns user profile response")
    void getUserProfile_Success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserProfileResponse response = userService.getUserProfile(1L);

        assertNotNull(response);
        assertEquals(1L, response.getId());
        assertEquals("Alex Smith", response.getName());
        assertEquals("alex@example.com", response.getEmail());
    }

    @Test
    @DisplayName("updateUserProfile: Updates profile preferences and emergency contact")
    void updateUserProfile_Success() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setName("Alex Johnson");
        request.setEmergencyContact("911");
        request.setTravelPreferences("Window seat, Vegan food");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileResponse response = userService.updateUserProfile(1L, request);

        assertNotNull(response);
        assertEquals("Alex Johnson", response.getName());
        assertEquals("911", response.getEmergencyContact());
        assertEquals("Window seat, Vegan food", response.getTravelPreferences());
    }

    @Test
    @DisplayName("uploadProfilePhoto: Uploads new photo and deletes previous photo")
    void uploadProfilePhoto_Success() {
        user.setProfilePhotoUrl("/uploads/users/1/old_photo.jpg");
        MockMultipartFile file = new MockMultipartFile(
                "file", "avatar.jpg", "image/jpeg", "Image data".getBytes());

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(fileStorageService.storeProfilePhoto(file, 1L)).thenReturn("/uploads/users/1/avatar.jpg");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileResponse response = userService.uploadProfilePhoto(1L, file);

        assertNotNull(response);
        assertEquals("/uploads/users/1/avatar.jpg", response.getProfilePhotoUrl());
        verify(fileStorageService, times(1)).deleteFile("/uploads/users/1/old_photo.jpg");
    }
}
