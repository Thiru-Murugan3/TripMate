package com.tripmate.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        String timestamp,
        int status,
        String code,
        String message,
        String path,
        Map<String, String> validationErrors
) {
    public ApiErrorResponse(String timestamp, int status, String code, String message, String path) {
        this(timestamp, status, code, message, path, null);
    }
}
