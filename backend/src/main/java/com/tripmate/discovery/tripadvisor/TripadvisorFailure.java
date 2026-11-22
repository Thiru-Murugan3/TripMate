package com.tripmate.discovery.tripadvisor;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Stable, non-sensitive client error code; never wraps the provider's exception or body. */
public class TripadvisorFailure extends ResponseStatusException {
    private final String code;
    public TripadvisorFailure(HttpStatus status, String code, String message) {
        super(status, message);
        this.code = code;
    }
    public String code() { return code; }
}
