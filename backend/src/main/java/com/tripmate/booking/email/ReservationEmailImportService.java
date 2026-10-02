package com.tripmate.booking.email;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripmate.booking.BookingService;
import com.tripmate.booking.importer.BookingImportDraft;
import com.tripmate.booking.importer.BookingImportService;
import com.tripmate.user.User;
import com.tripmate.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationEmailImportService {

    private static final int MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ReservationImportAddressRepository addressRepository;
    private final ReservationEmailImportRepository importRepository;
    private final UserRepository userRepository;
    private final BookingImportService bookingImportService;
    private final BookingService bookingService;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.create();

    @Value("${reservation-import.inbound-domain:}")
    private String inboundDomain;

    @Value("${reservation-import.webhook-secret:}")
    private String webhookSecret;

    @Value("${reservation-import.brevo-api-url:https://api.brevo.com/v3/inbound/attachments}")
    private String brevoAttachmentUrl;

    @Value("${brevo.api-key:}")
    private String brevoApiKey;

    @Transactional
    public ReservationImportAddressResponse getAddress(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        ReservationImportAddress address = addressRepository.findByUserId(userId)
                .orElseGet(() -> addressRepository.save(ReservationImportAddress.builder()
                        .user(user)
                        .importToken(generateToken())
                        .enabled(true)
                        .build()));

        boolean domainConfigured = !blank(inboundDomain);
        boolean configured = domainConfigured && !blank(webhookSecret);
        String forwardingAddress = domainConfigured
                ? "import+" + address.getImportToken() + "@" + inboundDomain
                : "";
        String message = configured
                ? "Forward reservation confirmations to this private address."
                : "Inbound email is not active yet. Configure the Brevo inbound domain and webhook secret.";
        return new ReservationImportAddressResponse(forwardingAddress, configured, message);
    }

    @Transactional(readOnly = true)
    public List<ReservationEmailImportResponse> listImports(Long userId) {
        return importRepository.findByUserIdOrderByReceivedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public int receiveBrevoWebhook(String suppliedSecret, JsonNode payload) {
        verifyWebhookSecret(suppliedSecret);
        JsonNode items = payload == null ? null : payload.path("items");
        if (items == null || !items.isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brevo webhook items are required");
        }

        int accepted = 0;
        for (JsonNode item : items) {
            if (receiveItem(item)) accepted++;
        }
        return accepted;
    }

    @Transactional
    public ReservationEmailImportResponse complete(
            Long importId,
            Long userId,
            CompleteReservationImportRequest request
    ) {
        ReservationEmailImport emailImport = ownedImport(importId, userId);
        bookingService.getBookingById(request.tripId(), request.bookingId(), userId);
        emailImport.setTripId(request.tripId());
        emailImport.setBookingId(request.bookingId());
        emailImport.setStatus(ReservationEmailImportStatus.IMPORTED);
        emailImport.setErrorMessage(null);
        return toResponse(importRepository.save(emailImport));
    }

    @Transactional
    public ReservationEmailImportResponse dismiss(Long importId, Long userId) {
        ReservationEmailImport emailImport = ownedImport(importId, userId);
        emailImport.setStatus(ReservationEmailImportStatus.DISMISSED);
        return toResponse(importRepository.save(emailImport));
    }

    private boolean receiveItem(JsonNode item) {
        String recipient = recipient(item);
        String token = tokenFromRecipient(recipient);
        if (token == null) {
            log.warn("Ignoring inbound reservation email without a TripMate import recipient");
            return false;
        }

        ReservationImportAddress importAddress = addressRepository
                .findByImportTokenAndEnabledTrue(token)
                .orElse(null);
        if (importAddress == null) {
            log.warn("Ignoring inbound reservation email for an unknown import token");
            return false;
        }

        String messageId = text(item, "MessageId");
        if (blank(messageId)) messageId = text(item, "Uuid");
        if (blank(messageId)) messageId = "tripmate-generated-" + UUID.randomUUID();
        if (importRepository.existsByMessageId(messageId)) return false;

        String subject = limit(text(item, "Subject"), 500);
        String body = firstText(item, "ExtractedMarkdownMessage", "RawTextBody", "RawHtmlBody");
        body = cleanBody(body);
        JsonNode attachments = item.path("Attachments");
        int attachmentCount = attachments.isArray() ? attachments.size() : 0;

        ReservationEmailImport emailImport = ReservationEmailImport.builder()
                .user(importAddress.getUser())
                .messageId(limit(messageId, 255))
                .providerUuid(limit(text(item, "Uuid"), 100))
                .senderAddress(limit(mailboxAddress(item.path("From")), 320))
                .recipientAddress(limit(recipient, 320))
                .subject(subject)
                .rawText(limit(body, 60000))
                .attachmentCount(attachmentCount)
                .status(ReservationEmailImportStatus.NEEDS_REVIEW)
                .build();

        try {
            BookingImportDraft draft = null;
            if (!blank(body) || !blank(subject)) {
                draft = bookingImportService.extractEmailText(
                        (subject == null ? "" : subject + "\n") + (body == null ? "" : body),
                        LocalDate.now().getYear());
            }
            BookingImportDraft attachmentDraft = bestAttachmentDraft(attachments);
            if (attachmentDraft != null && (draft == null || attachmentDraft.confidence() > draft.confidence())) {
                draft = attachmentDraft;
            }
            if (draft == null) {
                throw new IllegalStateException("No readable reservation content was found");
            }
            emailImport.setDraftJson(objectMapper.writeValueAsString(draft));
        } catch (RuntimeException | JsonProcessingException exception) {
            emailImport.setStatus(ReservationEmailImportStatus.FAILED);
            emailImport.setErrorMessage(limit(safeMessage(exception), 1000));
        }

        importRepository.save(emailImport);
        return true;
    }

    private BookingImportDraft bestAttachmentDraft(JsonNode attachments) {
        if (!attachments.isArray() || blank(brevoApiKey)) return null;
        BookingImportDraft best = null;
        for (JsonNode attachment : attachments) {
            String contentType = text(attachment, "ContentType");
            String name = text(attachment, "Name");
            String token = text(attachment, "DownloadToken");
            long size = attachment.path("ContentLength").asLong(0);
            if (!supportedAttachment(contentType, name) || blank(token) || size > MAX_ATTACHMENT_BYTES) continue;
            try {
                byte[] bytes = restClient.get()
                        .uri(UriComponentsBuilder.fromUriString(brevoAttachmentUrl)
                                .pathSegment(token).build().encode().toUri())
                        .header("api-key", brevoApiKey)
                        .retrieve()
                        .body(byte[].class);
                if (bytes == null || bytes.length == 0 || bytes.length > MAX_ATTACHMENT_BYTES) continue;
                BookingImportDraft draft = bookingImportService.importEmailAttachment(
                        bytes, name, normalizedContentType(contentType, name), LocalDate.now().getYear());
                if (best == null || draft.confidence() > best.confidence()) best = draft;
            } catch (RuntimeException exception) {
                log.warn("Unable to parse inbound reservation attachment {}: {}", name, exception.getMessage());
            }
        }
        return best;
    }

    private ReservationEmailImport ownedImport(Long importId, Long userId) {
        return importRepository.findByIdAndUserId(importId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Reservation email import not found"));
    }

    private ReservationEmailImportResponse toResponse(ReservationEmailImport emailImport) {
        BookingImportDraft draft = null;
        if (!blank(emailImport.getDraftJson())) {
            try {
                draft = objectMapper.readValue(emailImport.getDraftJson(), BookingImportDraft.class);
            } catch (JsonProcessingException exception) {
                log.warn("Unable to read reservation import draft {}: {}", emailImport.getId(), exception.getMessage());
            }
        }
        return new ReservationEmailImportResponse(
                emailImport.getId(), emailImport.getSenderAddress(), emailImport.getRecipientAddress(),
                emailImport.getSubject(), emailImport.getAttachmentCount(), emailImport.getStatus(),
                emailImport.getErrorMessage(), emailImport.getReceivedAt(), emailImport.getTripId(),
                emailImport.getBookingId(), draft);
    }

    private void verifyWebhookSecret(String suppliedSecret) {
        if (blank(webhookSecret)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Reservation email webhook is not configured");
        }
        byte[] expected = webhookSecret.getBytes(StandardCharsets.UTF_8);
        byte[] supplied = (suppliedSecret == null ? "" : suppliedSecret).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, supplied)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid reservation webhook secret");
        }
    }

    private String recipient(JsonNode item) {
        List<JsonNode> candidates = new ArrayList<>();
        addCandidates(candidates, item.path("Recipients"));
        addCandidates(candidates, item.path("To"));
        for (JsonNode candidate : candidates) {
            String address = candidate.isTextual() ? candidate.asText() : mailboxAddress(candidate);
            if (tokenFromRecipient(address) != null) return address;
        }
        return null;
    }

    private void addCandidates(List<JsonNode> target, JsonNode node) {
        if (node.isArray()) node.forEach(target::add);
        else if (!node.isMissingNode() && !node.isNull()) target.add(node);
    }

    private String tokenFromRecipient(String address) {
        if (blank(address) || blank(inboundDomain)) return null;
        String normalized = address.trim().toLowerCase(Locale.ROOT);
        int at = normalized.lastIndexOf('@');
        if (at <= 0 || !normalized.substring(at + 1).equals(inboundDomain.toLowerCase(Locale.ROOT))) return null;
        String local = normalized.substring(0, at);
        return local.startsWith("import+") && local.length() > 7 ? local.substring(7) : null;
    }

    private boolean supportedAttachment(String contentType, String name) {
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String filename = name == null ? "" : name.toLowerCase(Locale.ROOT);
        return type.equals("application/pdf") || type.equals("image/png") || type.equals("image/jpeg")
                || filename.endsWith(".pdf") || filename.endsWith(".png")
                || filename.endsWith(".jpg") || filename.endsWith(".jpeg");
    }

    private String normalizedContentType(String contentType, String name) {
        if (!blank(contentType) && supportedAttachment(contentType, name)) return contentType;
        String filename = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (filename.endsWith(".pdf")) return "application/pdf";
        if (filename.endsWith(".png")) return "image/png";
        return "image/jpeg";
    }

    private String generateToken() {
        byte[] bytes = new byte[24];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).toLowerCase(Locale.ROOT);
    }

    private String mailboxAddress(JsonNode mailbox) {
        if (mailbox == null || mailbox.isMissingNode() || mailbox.isNull()) return null;
        if (mailbox.isTextual()) return mailbox.asText(null);
        return firstText(mailbox, "Address", "address", "Email", "email");
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (!blank(value)) return value;
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (value.isArray()) return value.isEmpty() ? null : value.path(0).asText(null);
        return value.asText(null);
    }

    private String cleanBody(String value) {
        if (blank(value)) return null;
        return value.replaceAll("(?is)<(script|style).*?>.*?</\\1>", " ")
                .replaceAll("(?s)<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\R{3,}", "\n\n")
                .trim();
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return blank(message) ? "Unable to extract reservation details" : message;
    }

    private String limit(String value, int maximum) {
        if (value == null) return null;
        return value.length() <= maximum ? value : value.substring(0, maximum);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
