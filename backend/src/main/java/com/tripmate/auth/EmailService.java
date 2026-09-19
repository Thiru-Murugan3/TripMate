package com.tripmate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final RestClient restClient;
    private final String apiUrl;
    private final String apiKey;
    private final String senderEmail;
    private final String senderName;

    public EmailService(
            @Value("${brevo.api-url:https://api.brevo.com/v3/smtp/email}") String apiUrl,
            @Value("${brevo.api-key:}") String apiKey,
            @Value("${brevo.sender-email:}") String senderEmail,
            @Value("${brevo.sender-name:TripMate}") String senderName
    ) {
        this.restClient = RestClient.create();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
    }

    @PostConstruct
    void logConfigurationSummary() {
        if (StringUtils.hasText(apiKey)) {
            log.info(
                    "Brevo configuration loaded: sender={}, apiKeyFingerprint={}",
                    senderEmail,
                    apiKeyFingerprint()
            );
        } else {
            log.warn("Brevo API key is not configured.");
        }
    }

    public void sendVerificationOtpEmail(String recipientEmail, String otpCode) {
        String content =
                "Welcome to TripMate!\n\n" +
                "Your email verification code is: " + otpCode + "\n\n" +
                "This code expires in 5 minutes.\n" +
                "If you did not request this account, you can safely ignore this email.";

        sendTransactionalEmail(
                recipientEmail,
                "TripMate Email Verification Code",
                content,
                "verification"
        );
    }

    public void sendPasswordResetEmail(String recipientEmail, String resetLink) {
        String content =
                "We received a request to reset your TripMate password.\n\n" +
                "Open this secure link to set a new password:\n" +
                resetLink + "\n\n" +
                "This link expires in 15 minutes and can be used only once.\n" +
                "If you did not request a password reset, you can safely ignore this email.";

        sendTransactionalEmail(
                recipientEmail,
                "Reset your TripMate password",
                content,
                "password reset"
        );
    }

    public void sendTripInvitationEmail(
            String recipientEmail,
            String inviterName,
            String tripName,
            String role,
            String invitationLink
    ) {
        String friendlyRole =
                "EDITOR".equalsIgnoreCase(role) ? "Editor" : "Viewer";

        String content =
                "You have been invited to join a trip on TripMate.\n\n" +
                inviterName + " invited you to join \"" + tripName + "\" as " +
                friendlyRole + ".\n\n" +
                "Open this secure invitation link to review and accept the invitation:\n" +
                invitationLink + "\n\n" +
                "This invitation expires in 7 days. " +
                "If you are not signed in, TripMate will ask you to sign in first and then return you to the invitation.\n\n" +
                "If you were not expecting this invitation, you can ignore this email.";

        sendTransactionalEmail(
                recipientEmail,
                "You're invited to join " + tripName + " on TripMate",
                content,
                "trip invitation"
        );
    }

    private void sendTransactionalEmail(
            String recipientEmail,
            String subject,
            String textContent,
            String emailPurpose
    ) {
        validateConfiguration();

        SendTransactionalEmailRequest request = new SendTransactionalEmailRequest(
                new Sender(senderName, senderEmail),
                List.of(new Recipient(recipientEmail)),
                subject,
                textContent
        );

        try {
            SendTransactionalEmailResponse response = restClient.post()
                    .uri(apiUrl)
                    .header("api-key", apiKey)
                    .accept(MediaType.APPLICATION_JSON)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(SendTransactionalEmailResponse.class);

            String messageId = response != null && StringUtils.hasText(response.messageId())
                    ? response.messageId()
                    : "not-returned";

            log.info(
                    "TripMate {} email accepted by Brevo for {} (messageId={})",
                    emailPurpose,
                    recipientEmail,
                    messageId
            );
        } catch (RestClientResponseException ex) {
            String responseBody = ex.getResponseBodyAsString();
            if (responseBody != null && responseBody.length() > 1000) {
                responseBody = responseBody.substring(0, 1000) + "...";
            }

            log.error(
                    "Brevo rejected {} email for {} with HTTP {}. Provider response: {}",
                    emailPurpose,
                    recipientEmail,
                    ex.getStatusCode().value(),
                    responseBody
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Unable to send " + emailPurpose + " email (Brevo HTTP " +
                            ex.getStatusCode().value() +
                            "). Check the backend log for the provider error."
            );
        } catch (RestClientException ex) {
            log.error(
                    "Unable to reach Brevo while sending {} email to {}: {}",
                    emailPurpose,
                    recipientEmail,
                    ex.getMessage()
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email service is temporarily unavailable. Please try again."
            );
        }
    }

    private String apiKeyFingerprint() {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(apiKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 12);
        } catch (NoSuchAlgorithmException ex) {
            return "unavailable";
        }
    }

    private void validateConfiguration() {
        if (!StringUtils.hasText(apiKey) || !StringUtils.hasText(senderEmail)) {
            log.error("Brevo email provider is not configured. TRIPMATE_BREVO_API_KEY or TRIPMATE_BREVO_SENDER_EMAIL is missing.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email service is not configured. Set TRIPMATE_BREVO_API_KEY and TRIPMATE_BREVO_SENDER_EMAIL."
            );
        }
    }

    private record Sender(String name, String email) {}

    private record Recipient(String email) {}

    private record SendTransactionalEmailRequest(
            Sender sender,
            List<Recipient> to,
            String subject,
            String textContent
    ) {}

    private record SendTransactionalEmailResponse(String messageId) {}
}
