package com.tripmate.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public void sendVerificationOtpEmail(String recipientEmail, String otpCode) {
        log.info("=========================================================================");
        log.info("📧 [TRIPMATE EMAIL] Verification OTP for [{}] -> [{}]", recipientEmail, otpCode);
        log.info("=========================================================================");

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(recipientEmail);
                message.setSubject("TripMate Email Verification Code");
                message.setText("Your TripMate verification code is: " + otpCode + "\n\nThis code expires in 5 minutes.\nIf you did not request this account, please ignore this email.");
                mailSender.send(message);
                log.info("Successfully dispatched email via SMTP to {}", recipientEmail);
            } catch (Exception e) {
                log.warn("Failed to send SMTP email (check mail settings): {}", e.getMessage());
            }
        }
    }
}
