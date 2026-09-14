package com.tripmate.document;

import com.tripmate.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    // 1. GET /api/v1/trips/{tripId}/documents
    @GetMapping
    public ResponseEntity<List<DocumentResponse>> getDocuments(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                documentService.getDocuments(tripId, userPrincipal.getId())
        );
    }

    // 2. GET /api/v1/trips/{tripId}/documents/{documentId}
    @GetMapping("/{documentId}")
    public ResponseEntity<DocumentResponse> getDocumentById(
            @PathVariable Long tripId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        return ResponseEntity.ok(
                documentService.getDocumentById(tripId, documentId, userPrincipal.getId())
        );
    }

    // 3. GET /api/v1/trips/{tripId}/documents/{documentId}/content
    @GetMapping("/{documentId}/content")
    public ResponseEntity<Resource> getDocumentContent(
            @PathVariable Long tripId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        DocumentDownload download = documentService.downloadDocument(
                tripId, documentId, userPrincipal.getId());

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (download.fileType() != null && !download.fileType().isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(download.fileType());
            } catch (IllegalArgumentException ignored) {
                // Fall back to application/octet-stream for unknown stored content types.
            }
        }

        ContentDisposition disposition = ContentDisposition.inline()
                .filename(download.fileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(download.fileSize() != null ? download.fileSize() : -1L)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(download.resource());
    }

    // 4. POST /api/v1/trips/{tripId}/documents
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> uploadDocument(
            @PathVariable Long tripId,
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentType", required = false) DocumentType documentType
    ) {
        DocumentResponse response = documentService.uploadDocument(
                tripId, userPrincipal.getId(), file, documentType
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // 5. DELETE /api/v1/trips/{tripId}/documents/{documentId}
    @DeleteMapping("/{documentId}")
    public ResponseEntity<Map<String, String>> deleteDocument(
            @PathVariable Long tripId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        documentService.deleteDocument(tripId, documentId, userPrincipal.getId());

        return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
    }
}
