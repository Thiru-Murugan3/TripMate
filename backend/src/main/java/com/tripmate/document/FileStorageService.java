package com.tripmate.document;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Slf4j
public class FileStorageService {

    private static final String UPLOAD_DIR = "uploads";
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    private static final List<String> ALLOWED_EXTENSIONS = List.of(
            "pdf", "jpg", "jpeg", "png", "doc", "docx", "txt"
    );
    private static final List<String> PROFILE_IMAGE_EXTENSIONS = List.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );

    private final boolean r2Enabled;
    private final String r2Bucket;
    private final Duration presignedUrlDuration;
    private final ObjectProvider<S3Client> s3ClientProvider;
    private final ObjectProvider<S3Presigner> s3PresignerProvider;

    public FileStorageService(
            @Value("${storage.r2.enabled:false}") boolean r2Enabled,
            @Value("${storage.r2.bucket:}") String r2Bucket,
            @Value("${storage.r2.presigned-url-expiration-seconds:3600}") long presignedUrlExpirationSeconds,
            ObjectProvider<S3Client> s3ClientProvider,
            ObjectProvider<S3Presigner> s3PresignerProvider
    ) {
        this.r2Enabled = r2Enabled;
        this.r2Bucket = r2Bucket;
        this.presignedUrlDuration = Duration.ofSeconds(
                Math.max(60, Math.min(presignedUrlExpirationSeconds, 604800))
        );
        this.s3ClientProvider = s3ClientProvider;
        this.s3PresignerProvider = s3PresignerProvider;

        if (r2Enabled && (r2Bucket == null || r2Bucket.isBlank())) {
            throw new IllegalStateException("Cloudflare R2 is enabled but R2_BUCKET is missing");
        }
    }

    public String storeFile(MultipartFile file, Long tripId) {
        String extension = validateFile(file, "document", ALLOWED_EXTENSIONS);
        String safeFileName = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);

        if (r2Enabled) {
            return storeInR2(file, "trips/" + tripId + "/documents/" + safeFileName);
        }

        return storeLocally(file, Paths.get("trips", String.valueOf(tripId)), safeFileName);
    }

    public String storeProfilePhoto(MultipartFile file, Long userId) {
        String extension = validateFile(file, "profile.jpg", PROFILE_IMAGE_EXTENSIONS);
        String safeFileName = UUID.randomUUID() + "." + extension;

        if (r2Enabled) {
            return storeInR2(file, "users/" + userId + "/profile/" + safeFileName);
        }

        return storeLocally(file, Paths.get("profile", String.valueOf(userId)), safeFileName);
    }

    public Resource loadFile(String storageReference) {
        requireStorageReference(storageReference);

        if (isR2Reference(storageReference)) {
            String objectKey = resolveR2ObjectKey(storageReference);
            try {
                ResponseBytes<GetObjectResponse> response = s3Client().getObjectAsBytes(
                        GetObjectRequest.builder()
                                .bucket(r2Bucket)
                                .key(objectKey)
                                .build()
                );
                return new ByteArrayResource(response.asByteArray());
            } catch (S3Exception ex) {
                if (ex.statusCode() == 404) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stored file was not found");
                }
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Could not read stored file", ex
                );
            }
        }

        return loadLocalFile(storageReference);
    }

    public String createPresignedGetUrl(
            String storageReference,
            String fileName,
            String contentType
    ) {
        requireStorageReference(storageReference);

        if (!isR2Reference(storageReference)) {
            return storageReference;
        }

        GetObjectRequest.Builder objectRequest = GetObjectRequest.builder()
                .bucket(r2Bucket)
                .key(resolveR2ObjectKey(storageReference));

        if (fileName != null && !fileName.isBlank()) {
            objectRequest.responseContentDisposition(
                    ContentDisposition.inline()
                            .filename(fileName, StandardCharsets.UTF_8)
                            .build()
                            .toString()
            );
        }
        if (contentType != null && !contentType.isBlank()) {
            objectRequest.responseContentType(contentType);
        }

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(presignedUrlDuration)
                .getObjectRequest(objectRequest.build())
                .build();

        return s3Presigner().presignGetObject(presignRequest).url().toString();
    }

    public long getPresignedUrlDurationSeconds() {
        return presignedUrlDuration.toSeconds();
    }

    public void deleteFile(String storageReference) {
        if (storageReference == null || storageReference.isBlank()) {
            return;
        }

        if (isR2Reference(storageReference)) {
            try {
                s3Client().deleteObject(
                        DeleteObjectRequest.builder()
                                .bucket(r2Bucket)
                                .key(resolveR2ObjectKey(storageReference))
                                .build()
                );
            } catch (S3Exception ex) {
                log.warn("Could not delete R2 object: {}", ex.getMessage());
            }
            return;
        }

        try {
            Files.deleteIfExists(resolveLocalStoragePath(storageReference));
        } catch (IOException ex) {
            log.warn("Could not delete local stored file", ex);
        }
    }

    private String validateFile(
            MultipartFile file,
            String fallbackName,
            List<String> allowedExtensions
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File cannot be empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "File size exceeds maximum limit of 10 MB"
            );
        }

        String originalFileName = StringUtils.cleanPath(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : fallbackName
        );
        String extension = getFileExtension(originalFileName).toLowerCase(Locale.ROOT);

        if (!allowedExtensions.contains(extension)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "File type not allowed. Allowed types: " + allowedExtensions
            );
        }

        return extension;
    }

    private String storeInR2(MultipartFile file, String objectKey) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(r2Bucket)
                .key(objectKey)
                .contentType(normalizeContentType(file.getContentType()))
                .contentLength(file.getSize())
                .build();

        try (InputStream inputStream = file.getInputStream()) {
            s3Client().putObject(request, RequestBody.fromInputStream(inputStream, file.getSize()));
            return "r2://" + r2Bucket + "/" + objectKey;
        } catch (IOException | S3Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Could not store file. Please try again!", ex
            );
        }
    }

    private String storeLocally(MultipartFile file, Path relativeDirectory, String safeFileName) {
        Path uploadDirectory = Paths.get(UPLOAD_DIR)
                .resolve(relativeDirectory)
                .toAbsolutePath()
                .normalize();

        try {
            Files.createDirectories(uploadDirectory);
            Path targetLocation = uploadDirectory.resolve(safeFileName).normalize();
            if (!targetLocation.startsWith(uploadDirectory)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path");
            }
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
            }
            return "/uploads/" + relativeDirectory.toString().replace('\\', '/') + "/" + safeFileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not store file. Please try again!", ex
            );
        }
    }

    private Resource loadLocalFile(String storageReference) {
        try {
            Path filePath = resolveLocalStoragePath(storageReference);
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stored file was not found");
            }
            return resource;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not read stored file", ex
            );
        }
    }

    private Path resolveLocalStoragePath(String storageReference) {
        String relativePath = storageReference.startsWith("/")
                ? storageReference.substring(1)
                : storageReference;
        Path uploadRoot = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
        Path filePath = Paths.get(relativePath).toAbsolutePath().normalize();

        if (!filePath.startsWith(uploadRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid stored file path");
        }
        return filePath;
    }

    private String resolveR2ObjectKey(String storageReference) {
        try {
            URI uri = URI.create(storageReference);
            if (!"r2".equalsIgnoreCase(uri.getScheme()) || !r2Bucket.equals(uri.getHost())) {
                throw new IllegalArgumentException("Unexpected R2 bucket");
            }
            String objectKey = uri.getPath();
            objectKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
            if (objectKey.isBlank() || objectKey.contains("../") || objectKey.endsWith("/..")) {
                throw new IllegalArgumentException("Invalid R2 object key");
            }
            return objectKey;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid stored file reference", ex);
        }
    }

    private boolean isR2Reference(String storageReference) {
        return storageReference != null && storageReference.startsWith("r2://");
    }

    private void requireStorageReference(String storageReference) {
        if (storageReference == null || storageReference.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stored file is missing");
        }
    }

    private String normalizeContentType(String contentType) {
        return contentType == null || contentType.isBlank()
                ? "application/octet-stream"
                : contentType;
    }

    private S3Client s3Client() {
        S3Client client = s3ClientProvider.getIfAvailable();
        if (client == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Cloudflare R2 storage is unavailable"
            );
        }
        return client;
    }

    private S3Presigner s3Presigner() {
        S3Presigner presigner = s3PresignerProvider.getIfAvailable();
        if (presigner == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Cloudflare R2 storage is unavailable"
            );
        }
        return presigner;
    }

    private String getFileExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < fileName.length() - 1) {
            return fileName.substring(dotIndex + 1);
        }
        return "";
    }
}
