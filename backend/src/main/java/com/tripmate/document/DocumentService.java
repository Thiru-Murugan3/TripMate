package com.tripmate.document;

import com.tripmate.audit.AuditAction;
import com.tripmate.audit.AuditLogService;
import com.tripmate.member.MemberStatus;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.member.TripRole;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<DocumentResponse> getDocuments(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        return documentRepository.findByTripIdOrderByCreatedAtDesc(tripId)
                .stream()
                .map(DocumentResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponse getDocumentById(Long tripId, Long documentId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);
        return DocumentResponse.from(findDocumentOrThrow(tripId, documentId));
    }

    @Transactional(readOnly = true)
    public DocumentDownload downloadDocument(Long tripId, Long documentId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Document document = findDocumentOrThrow(tripId, documentId);
        Resource resource = fileStorageService.loadFile(document.getStorageUrl());

        return new DocumentDownload(
                resource,
                document.getFileName(),
                document.getFileType(),
                document.getFileSize()
        );
    }

    @Transactional(readOnly = true)
    public DocumentDownloadUrl createDownloadUrl(Long tripId, Long documentId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanView(trip, userId);

        Document document = findDocumentOrThrow(tripId, documentId);
        String url = fileStorageService.createPresignedGetUrl(
                document.getStorageUrl(),
                document.getFileName(),
                document.getFileType()
        );

        return new DocumentDownloadUrl(
                url,
                fileStorageService.getPresignedUrlDurationSeconds()
        );
    }

    @Transactional
    public DocumentResponse uploadDocument(
            Long tripId,
            Long userId,
            MultipartFile file,
            DocumentType documentType
    ) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        User uploader = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Uploader user not found"));

        String storageUrl = fileStorageService.storeFile(file, tripId);
        DocumentType type = documentType != null ? documentType : DocumentType.OTHER;

        try {
            Document document = Document.builder()
                    .trip(trip)
                    .uploadedBy(uploader)
                    .fileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : "document")
                    .documentType(type)
                    .fileType(file.getContentType())
                    .fileSize(file.getSize())
                    .storageUrl(storageUrl)
                    .build();

            Document saved = documentRepository.save(document);
            auditLogService.log(
                    userId,
                    tripId,
                    AuditAction.DOCUMENT_UPLOADED,
                    "DOCUMENT",
                    saved.getId(),
                    "Uploaded document: " + saved.getFileName() + " (" + type + ")"
            );
            return DocumentResponse.from(saved);
        } catch (RuntimeException ex) {
            fileStorageService.deleteFile(storageUrl);
            throw ex;
        }
    }

    @Transactional
    public void deleteDocument(Long tripId, Long documentId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        verifyCanEdit(trip, userId);

        Document document = findDocumentOrThrow(tripId, documentId);
        fileStorageService.deleteFile(document.getStorageUrl());
        documentRepository.delete(document);

        auditLogService.log(
                userId,
                tripId,
                AuditAction.DOCUMENT_DELETED,
                "DOCUMENT",
                documentId,
                "Deleted document: " + document.getFileName()
        );
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Trip not found"));
    }

    private Document findDocumentOrThrow(Long tripId, Long documentId) {
        return documentRepository.findByIdAndTripId(documentId, tripId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Document not found in this trip"));
    }

    private void verifyCanView(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        boolean isMember = tripMemberRepository.existsByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);
        if (!isMember) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You do not have access to this trip");
        }
    }

    private void verifyCanEdit(Trip trip, Long userId) {
        if (trip.getOwner().getId().equals(userId)) {
            return;
        }
        var memberOpt = tripMemberRepository.findByTripIdAndUserIdAndMemberStatus(
                trip.getId(), userId, MemberStatus.ACTIVE);

        if (memberOpt.isEmpty() || memberOpt.get().getRole() == TripRole.VIEWER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to modify documents for this trip"
            );
        }
    }
}
