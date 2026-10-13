package com.tripmate.booking.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.booking.*;
import com.tripmate.booking.importer.BookingImportService;
import com.tripmate.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationImportReviewTest {
    @Mock ReservationImportAddressRepository addressRepository;
    @Mock ReservationEmailImportRepository importRepository;
    @Mock UserRepository userRepository;
    @Mock BookingImportService bookingImportService;
    @Mock BookingService bookingService;
    @Mock ObjectMapper objectMapper;
    @InjectMocks ReservationEmailImportService service;

    @Test void retryAfterLostResponseReturnsSavedBookingWithoutCreatingAnother() {
        var item = ReservationEmailImport.builder().status(ReservationEmailImportStatus.IMPORTED)
                .tripId(7L).bookingId(9L).build();
        when(importRepository.findByIdAndUserId(1L, 2L)).thenReturn(Optional.of(item));
        var booking = mock(BookingResponse.class);
        when(bookingService.getBookingById(7L, 9L, 2L)).thenReturn(booking);
        assertSame(booking, service.confirm(1L, 2L, new ConfirmReservationImportRequest(7L, null)));
        verify(bookingService, never()).createImportedBooking(any(), any(), any());
    }

    @Test void failedSaveDoesNotMarkImportComplete() {
        var item = ReservationEmailImport.builder().status(ReservationEmailImportStatus.NEEDS_REVIEW).build();
        when(importRepository.findByIdAndUserId(1L, 2L)).thenReturn(Optional.of(item));
        when(bookingService.createImportedBooking(eq(7L), eq(2L), isNull()))
                .thenThrow(new IllegalStateException("database unavailable"));
        assertThrows(IllegalStateException.class,
                () -> service.confirm(1L, 2L, new ConfirmReservationImportRequest(7L, null)));
        assertEquals(ReservationEmailImportStatus.NEEDS_REVIEW, item.getStatus());
        verify(importRepository, never()).save(any());
    }

    @Test void anotherUsersImportCannotBeConfirmedOrRetried() {
        when(importRepository.findByIdAndUserId(1L, 2L)).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class,
                () -> service.confirm(1L, 2L, new ConfirmReservationImportRequest(7L, null)));
        assertThrows(ResponseStatusException.class, () -> service.retry(1L, 2L));
        verifyNoInteractions(bookingService, bookingImportService);
    }

    @Test void attachmentOnlyFailureOffersUploadRecovery() {
        var item = ReservationEmailImport.builder().status(ReservationEmailImportStatus.FAILED).build();
        when(importRepository.findByIdAndUserId(1L, 2L)).thenReturn(Optional.of(item));
        var error = assertThrows(ResponseStatusException.class, () -> service.retry(1L, 2L));
        assertTrue(error.getReason().contains("Upload"));
        verifyNoInteractions(bookingImportService);
    }
}
