package com.tripmate.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatusException(
            ResponseStatusException ex,
            HttpServletRequest request
    ) {
        HttpStatusCode statusCode = ex.getStatusCode();
        int statusValue = statusCode.value();
        String code = resolveErrorCode(statusCode);
        String message = ex.getReason() != null ? ex.getReason() : "An error occurred";
        String path = request.getRequestURI();

        ApiErrorResponse response = new ApiErrorResponse(
                Instant.now().toString(),
                statusValue,
                code,
                message,
                path
        );

        return ResponseEntity.status(statusCode).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        Map<String, String> errors = new HashMap<>();

        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));

        ApiErrorResponse response = new ApiErrorResponse(
                Instant.now().toString(),
                HttpStatus.BAD_REQUEST.value(),
                "VALIDATION_ERROR",
                "Validation failed",
                request.getRequestURI(),
                errors
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGenericException(
            Exception ex,
            HttpServletRequest request
    ) {
        ApiErrorResponse response = new ApiErrorResponse(
                Instant.now().toString(),
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "INTERNAL_SERVER_ERROR",
                ex.getMessage() != null ? ex.getMessage() : "An unexpected server error occurred",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private String resolveErrorCode(HttpStatusCode statusCode) {
        if (statusCode.equals(HttpStatus.BAD_REQUEST)) {
            return "INVALID_REQUEST";
        } else if (statusCode.equals(HttpStatus.UNAUTHORIZED)) {
            return "UNAUTHORIZED";
        } else if (statusCode.equals(HttpStatus.FORBIDDEN)) {
            return "FORBIDDEN";
        } else if (statusCode.equals(HttpStatus.NOT_FOUND)) {
            return "NOT_FOUND";
        } else if (statusCode.equals(HttpStatus.CONFLICT)) {
            return "CONFLICT";
        } else if (statusCode.is5xxServerError()) {
            return "INTERNAL_SERVER_ERROR";
        }
        return "ERROR";
    }
}
