package com.tripmate.document;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final String UPLOAD_DIR = "uploads";
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    private static final List<String> ALLOWED_EXTENSIONS = List.of(
            "pdf", "jpg", "jpeg", "png", "doc", "docx", "txt"
    );

    public String storeFile(MultipartFile file, Long tripId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File cannot be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File size exceeds maximum limit of 10 MB");
        }

        String originalFileName = StringUtils.cleanPath(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "document"
        );

        String extension = getFileExtension(originalFileName);
        if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File type not allowed. Allowed types: " + ALLOWED_EXTENSIONS);
        }

        // Generate safe unique stored filename: UUID + extension
        String safeFileName = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);

        // Directory path: uploads/trips/{tripId}
        Path tripUploadDir = Paths.get(UPLOAD_DIR, "trips", String.valueOf(tripId)).toAbsolutePath().normalize();

        try {
            Files.createDirectories(tripUploadDir);
            Path targetLocation = tripUploadDir.resolve(safeFileName);

            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
            }

            return "/uploads/trips/" + tripId + "/" + safeFileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not store file. Please try again!", ex);
        }
    }

    public String storeProfilePhoto(MultipartFile file, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File cannot be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File size exceeds maximum limit of 10 MB");
        }

        String originalFileName = StringUtils.cleanPath(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "profile.jpg"
        );

        String extension = getFileExtension(originalFileName);
        List<String> imageExtensions = List.of("jpg", "jpeg", "png", "webp", "gif");
        if (!imageExtensions.contains(extension.toLowerCase())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid image format. Allowed: jpg, jpeg, png, webp, gif");
        }

        String safeFileName = UUID.randomUUID() + "." + extension.toLowerCase();
        Path profileUploadDir = Paths.get(UPLOAD_DIR, "profile", String.valueOf(userId)).toAbsolutePath().normalize();

        try {
            Files.createDirectories(profileUploadDir);
            Path targetLocation = profileUploadDir.resolve(safeFileName);

            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
            }

            return "/uploads/profile/" + userId + "/" + safeFileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not store profile photo.", ex);
        }
    }

    public Resource loadFile(String storageUrl) {
        if (storageUrl == null || storageUrl.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Stored document file is missing");
        }

        try {
            Path filePath = resolveStoragePath(storageUrl);
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Stored document file was not found");
            }

            return resource;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not read stored document", ex);
        }
    }

    public void deleteFile(String storageUrl) {
        if (storageUrl == null || storageUrl.isBlank()) {
            return;
        }

        try {
            Path filePath = resolveStoragePath(storageUrl);
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            // Log warning but continue
        }
    }

    private Path resolveStoragePath(String storageUrl) {
        String relativePath = storageUrl.startsWith("/") ? storageUrl.substring(1) : storageUrl;
        Path uploadRoot = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
        Path filePath = Paths.get(relativePath).toAbsolutePath().normalize();

        if (!filePath.startsWith(uploadRoot)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid stored file path");
        }

        return filePath;
    }

    private String getFileExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < fileName.length() - 1) {
            return fileName.substring(dotIndex + 1);
        }
        return "";
    }
}
