package com.tripmate.document;

import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        Long tripId,
        Long uploadedById,
        String uploadedByName,
        String fileName,
        DocumentType documentType,
        String fileType,
        Long fileSize,
        String storageUrl,
        LocalDateTime createdAt
) {
    public static DocumentResponse from(Document doc) {
        return new DocumentResponse(
                doc.getId(),
                doc.getTrip().getId(),
                doc.getUploadedBy().getId(),
                doc.getUploadedBy().getName(),
                doc.getFileName(),
                doc.getDocumentType(),
                doc.getFileType(),
                doc.getFileSize(),
                doc.getStorageUrl(),
                doc.getCreatedAt()
        );
    }
}
