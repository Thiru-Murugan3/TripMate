package com.tripmate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String mailUsername;
    private final String mailPassword;
    private final String mailFrom;

    public EmailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${app.mail.from:}") String mailFrom
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.mailFrom = mailFrom;
    }

    public void sendVerificationOtpEmail(String recipientEmail, String otpCode) {
        validateMailConfiguration();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(StringUtils.hasText(mailFrom) ? mailFrom : mailUsername);
        message.setTo(recipientEmail);
        message.setSubject("TripMate Email Verification Code");
        message.setText(
                "Welcome to TripMate!\n\n" +
                "Your email verification code is: " + otpCode + "\n\n" +
                "This code expires in 5 minutes.\n" +
                "If you did not request this account, you can safely ignore this email."
        );

        try {
            mailSender.send(message);
            log.info("TripMate verification email sent successfully to {}", recipientEmail);
        } catch (MailException ex) {
            log.error("Unable to send TripMate verification email to {}: {}", recipientEmail, ex.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Unable to send verification email. Please check the mail configuration and try again."
            );
        }
    }

    private void validateMailConfiguration() {
        if (mailSender == null || !StringUtils.hasText(mailUsername) || !StringUtils.hasText(mailPassword)) {
            log.error("TripMate SMTP is not configured. MAIL_USERNAME or MAIL_PASSWORD is missing.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Email service is not configured. Set MAIL_USERNAME and MAIL_PASSWORD before registering."
            );
        }
    }
}
