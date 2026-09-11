package com.tripmate.document;

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

    public void deleteFile(String storageUrl) {
        if (storageUrl == null || storageUrl.isBlank()) {
            return;
        }

        try {
            String relativePath = storageUrl.startsWith("/") ? storageUrl.substring(1) : storageUrl;
            Path filePath = Paths.get(relativePath).toAbsolutePath().normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            // Log warning but continue
        }
    }

    private String getFileExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < fileName.length() - 1) {
            return fileName.substring(dotIndex + 1);
        }
        return "";
    }
}
