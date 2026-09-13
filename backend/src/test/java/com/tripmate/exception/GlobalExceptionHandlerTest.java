package com.tripmate.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
        request = Mockito.mock(HttpServletRequest.class);
    }

    @Test
    @DisplayName("handleResponseStatusException: Standardizes 404 NOT_FOUND error response")
    void handleResponseStatusException_NotFound() {
        when(request.getRequestURI()).thenReturn("/api/v1/trips/99");
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found");

        ResponseEntity<ApiErrorResponse> responseEntity = exceptionHandler.handleResponseStatusException(ex, request);

        assertNotNull(responseEntity);
        assertEquals(HttpStatus.NOT_FOUND, responseEntity.getStatusCode());

        ApiErrorResponse body = responseEntity.getBody();
        assertNotNull(body);
        assertEquals(404, body.status());
        assertEquals("NOT_FOUND", body.code());
        assertEquals("Trip not found", body.message());
        assertEquals("/api/v1/trips/99", body.path());
        assertNotNull(body.timestamp());
    }

    @Test
    @DisplayName("handleResponseStatusException: Standardizes 400 INVALID_REQUEST error response")
    void handleResponseStatusException_BadRequest() {
        when(request.getRequestURI()).thenReturn("/api/v1/trips");
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date cannot be before start date");

        ResponseEntity<ApiErrorResponse> responseEntity = exceptionHandler.handleResponseStatusException(ex, request);

        assertNotNull(responseEntity);
        assertEquals(HttpStatus.BAD_REQUEST, responseEntity.getStatusCode());

        ApiErrorResponse body = responseEntity.getBody();
        assertNotNull(body);
        assertEquals(400, body.status());
        assertEquals("INVALID_REQUEST", body.code());
        assertEquals("End date cannot be before start date", body.message());
        assertEquals("/api/v1/trips", body.path());
    }

    @Test
    @DisplayName("handleValidationException: Standardizes 400 VALIDATION_ERROR response with field errors")
    void handleValidationException_ReturnsFieldErrors() {
        when(request.getRequestURI()).thenReturn("/api/v1/trips");

        BindingResult bindingResult = Mockito.mock(BindingResult.class);
        FieldError fieldError = new FieldError("createTripRequest", "name", "Trip name is required");
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));

        MethodParameter parameter = Mockito.mock(MethodParameter.class);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(parameter, bindingResult);

        ResponseEntity<ApiErrorResponse> responseEntity = exceptionHandler.handleValidationException(ex, request);

        assertNotNull(responseEntity);
        assertEquals(HttpStatus.BAD_REQUEST, responseEntity.getStatusCode());

        ApiErrorResponse body = responseEntity.getBody();
        assertNotNull(body);
        assertEquals(400, body.status());
        assertEquals("VALIDATION_ERROR", body.code());
        assertEquals("Validation failed", body.message());
        assertEquals("/api/v1/trips", body.path());
        assertNotNull(body.validationErrors());
        assertEquals("Trip name is required", body.validationErrors().get("name"));
    }

    @Test
    @DisplayName("handleGenericException: Standardizes 500 INTERNAL_SERVER_ERROR response")
    void handleGenericException_ReturnsInternalError() {
        when(request.getRequestURI()).thenReturn("/api/v1/health");
        Exception ex = new RuntimeException("Database connection timeout");

        ResponseEntity<ApiErrorResponse> responseEntity = exceptionHandler.handleGenericException(ex, request);

        assertNotNull(responseEntity);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, responseEntity.getStatusCode());

        ApiErrorResponse body = responseEntity.getBody();
        assertNotNull(body);
        assertEquals(500, body.status());
        assertEquals("INTERNAL_SERVER_ERROR", body.code());
        assertEquals("Database connection timeout", body.message());
        assertEquals("/api/v1/health", body.path());
    }
}
