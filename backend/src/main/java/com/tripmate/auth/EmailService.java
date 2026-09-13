package com.tripmate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

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

    public void sendVerificationOtpEmail(String recipientEmail, String otpCode) {
        validateConfiguration();

        SendTransactionalEmailRequest request = new SendTransactionalEmailRequest(
                new Sender(senderName, senderEmail),
                List.of(new Recipient(recipientEmail)),
                "TripMate Email Verification Code",
                "Welcome to TripMate!\n\n" +
                        "Your email verification code is: " + otpCode + "\n\n" +
                        "This code expires in 5 minutes.\n" +
                        "If you did not request this account, you can safely ignore this email."
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
                    "TripMate verification email accepted by Brevo for {} (messageId={})",
                    recipientEmail,
                    messageId
            );
        } catch (RestClientResponseException ex) {
            String responseBody = ex.getResponseBodyAsString();
            if (responseBody != null && responseBody.length() > 1000) {
                responseBody = responseBody.substring(0, 1000) + "...";
            }

            log.error(
                    "Brevo rejected verification email for {} with HTTP {}. Provider response: {}",
                    recipientEmail,
                    ex.getStatusCode().value(),
                    responseBody
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Unable to send verification email (Brevo HTTP " +
                            ex.getStatusCode().value() +
                            "). Check the backend log for the provider error."
            );
        } catch (RestClientException ex) {
            log.error(
                    "Unable to reach Brevo while sending verification email to {}: {}",
                    recipientEmail,
                    ex.getMessage()
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Verification email service is temporarily unavailable. Please try again."
            );
        }
    }

    private void validateConfiguration() {
        if (!StringUtils.hasText(apiKey) || !StringUtils.hasText(senderEmail)) {
            log.error("Brevo email provider is not configured. BREVO_API_KEY or BREVO_SENDER_EMAIL is missing.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email service is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL."
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
