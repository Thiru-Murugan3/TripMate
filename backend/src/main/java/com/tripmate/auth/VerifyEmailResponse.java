package com.tripmate.auth;

public record VerifyEmailResponse(String message, LoginResponse session) {
}
