package com.tripmate.document;

import com.tripmate.audit.AuditLogService;
import com.tripmate.member.TripMemberRepository;
import com.tripmate.trip.Trip;
import com.tripmate.trip.TripRepository;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
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
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private DocumentService documentService;

    private User owner;
    private Trip trip;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .name("Owner User")
                .email("owner@example.com")
                .build();

        trip = Trip.builder()
                .id(10L)
                .owner(owner)
                .name("Flight Trip")
                .build();
    }

    @Test
    @DisplayName("uploadDocument: Stores file and saves Document metadata successfully")
    void uploadDocument_Success() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "flight_ticket.pdf", "application/pdf", "PDF Content".getBytes());

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(fileStorageService.storeFile(file, 10L)).thenReturn("/uploads/trips/10/flight_ticket.pdf");
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> {
            Document doc = invocation.getArgument(0);
            doc.setId(100L);
            return doc;
        });

        DocumentResponse response = documentService.uploadDocument(10L, 1L, file, DocumentType.FLIGHT_TICKET);

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertEquals("flight_ticket.pdf", response.fileName());
        assertEquals(DocumentType.FLIGHT_TICKET, response.documentType());
        verify(auditLogService, times(1)).log(eq(1L), eq(10L), any(), any(), eq(100L), any());
    }

    @Test
    @DisplayName("deleteDocument: Deletes document file and database entry successfully")
    void deleteDocument_Success() {
        Document doc = Document.builder()
                .id(100L)
                .trip(trip)
                .fileName("flight_ticket.pdf")
                .storageUrl("/uploads/trips/10/flight_ticket.pdf")
                .build();

        when(tripRepository.findById(10L)).thenReturn(Optional.of(trip));
        when(documentRepository.findByIdAndTripId(100L, 10L)).thenReturn(Optional.of(doc));

        documentService.deleteDocument(10L, 100L, 1L);

        verify(fileStorageService, times(1)).deleteFile("/uploads/trips/10/flight_ticket.pdf");
        verify(documentRepository, times(1)).delete(doc);
        verify(auditLogService, times(1)).log(eq(1L), eq(10L), any(), any(), eq(100L), any());
    }
}
