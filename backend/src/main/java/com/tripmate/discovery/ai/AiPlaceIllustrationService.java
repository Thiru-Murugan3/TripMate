package com.tripmate.discovery.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.tripmate.discovery.DestinationDiscoveryService;
import com.tripmate.discovery.DiscoveredPlace;
import com.tripmate.document.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Creates a clearly labelled AI illustration for a discovered place that has no real photo.
 *
 * <ul>
 *   <li>The prompt is built only from the server's own cached search record, never from client text.</li>
 *   <li>Each place is generated once and stored (R2 or local uploads), then reused.</li>
 *   <li>Disabled until configured; capped per day and per concurrent request to control cost.</li>
 *   <li>Provider "pollinations" is free and needs no key; "openai" is paid and needs OPENAI_API_KEY.</li>
 * </ul>
 */
@Service
@Slf4j
public class AiPlaceIllustrationService {
    public static final String LABEL = "AI illustration";
    public static final String NOTICE = "AI-generated illustration · Not a real photo of this place";
    static final Pattern EXTERNAL_ID = Pattern.compile("[A-Za-z0-9:._-]{3,200}");
    static final Pattern FILE_NAME = Pattern.compile("[a-f0-9]{32}\\.png");
    private static final String PREFIX = "ai-illustrations/";
    static final String POLLINATIONS_URL = "https://image.pollinations.ai/prompt/";

    private final boolean enabled;
    private final String provider;
    private final String apiKey;
    private final String model;
    private final String quality;
    private final String size;
    private final int dailyLimit;
    private final String apiUrl;
    private final RestClient client;
    private final DestinationDiscoveryService discovery;
    private final FileStorageService storage;

    private final Semaphore concurrent = new Semaphore(2);
    private final Map<String, Object> locks = new ConcurrentHashMap<>();
    private final AtomicInteger usedToday = new AtomicInteger();
    private volatile LocalDate usageDay = LocalDate.now();
    /** The free service rejects rapid anonymous calls; space them out. */
    static long freeMinIntervalMs = 16_000;
    private long lastFreeCall = 0;

    @Autowired
    public AiPlaceIllustrationService(
            @Value("${ai-images.enabled:false}") boolean enabled,
            @Value("${ai-images.provider:pollinations}") String provider,
            @Value("${ai-images.openai-api-key:}") String apiKey,
            @Value("${ai-images.model:gpt-image-1}") String model,
            @Value("${ai-images.quality:low}") String quality,
            @Value("${ai-images.size:1536x1024}") String size,
            @Value("${ai-images.daily-limit:50}") int dailyLimit,
            @Value("${ai-images.api-url:https://api.openai.com/v1/images/generations}") String apiUrl,
            DestinationDiscoveryService discovery,
            FileStorageService storage) {
        this(enabled, provider, apiKey, model, quality, size, dailyLimit, apiUrl, defaultClient(), discovery, storage);
    }

    /** OpenAI constructor kept for tests and explicit paid setups. */
    AiPlaceIllustrationService(boolean enabled, String apiKey, String model, String quality, String size, int dailyLimit,
                               String apiUrl, RestClient client, DestinationDiscoveryService discovery, FileStorageService storage) {
        this(enabled, "openai", apiKey, model, quality, size, dailyLimit, apiUrl, client, discovery, storage);
    }

    AiPlaceIllustrationService(boolean enabled, String provider, String apiKey, String model, String quality, String size, int dailyLimit,
                               String apiUrl, RestClient client, DestinationDiscoveryService discovery, FileStorageService storage) {
        this.provider = "openai".equalsIgnoreCase(provider == null ? "" : provider.trim()) ? "openai" : "pollinations";
        boolean keyReady = "pollinations".equals(this.provider) || apiKey != null && !apiKey.isBlank();
        this.enabled = enabled && keyReady;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.quality = quality;
        this.size = size;
        this.dailyLimit = Math.max(0, dailyLimit);
        this.apiUrl = "pollinations".equals(this.provider) && (apiUrl == null || apiUrl.contains("api.openai.com"))
                ? POLLINATIONS_URL : apiUrl;
        this.client = client;
        this.discovery = discovery;
        this.storage = storage;
        if (enabled && !this.enabled) log.warn("AI place illustrations are enabled but OPENAI_API_KEY is missing; feature stays off.");
    }

    private static RestClient defaultClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(120_000); // image generation can take tens of seconds
        return RestClient.builder().requestFactory(factory).build();
    }

    public boolean enabled() { return enabled; }

    /** Returns the stored illustration for a place, generating it once if needed. */
    public Illustration illustrationFor(String externalId) {
        if (!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI illustrations are not enabled");
        if (externalId == null || !EXTERNAL_ID.matcher(externalId).matches())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid place id is required");

        String fileName = fileNameFor(externalId);
        String key = PREFIX + fileName;
        if (exists(key)) return illustration(fileName);

        // Throws 404 unless the place came from a recent search: the prompt never uses client text.
        DiscoveredPlace place = discovery.findByExternalId(externalId);

        Object lock = locks.computeIfAbsent(fileName, k -> new Object());
        synchronized (lock) {
            try {
                if (exists(key)) return illustration(fileName);
                reserveDailyQuota();
                if (!concurrent.tryAcquire())
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Illustrations are being created. Try again shortly.");
                try {
                    byte[] png = generate(prompt(place), externalId);
                    MediaType type = imageType(png);
                    storage.storeBytes(key, png, type == null ? MediaType.IMAGE_PNG_VALUE : type.toString());
                    return illustration(fileName);
                } finally {
                    concurrent.release();
                }
            } finally {
                locks.remove(fileName);
            }
        }
    }

    /** Loads a stored illustration by its generated file name (for the public image route). */
    public Resource image(String fileName) {
        if (fileName == null || !FILE_NAME.matcher(fileName).matches())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Illustration not found");
        return storage.loadFile(storage.referenceFor(PREFIX + fileName));
    }

    static String prompt(DiscoveredPlace place) {
        String name = clean(place.name(), 120);
        String kind = place.category() == null ? "tourist place"
                : place.category().name().toLowerCase(Locale.ROOT).replace('_', ' ');
        String where = String.join(", ", java.util.stream.Stream.of(clean(place.city(), 60), clean(place.state(), 60), "India")
                .filter(s -> !s.isBlank()).toList());
        return "Painterly digital travel illustration (clearly an artwork, not a photograph) evoking \"" + name
                + "\", a " + kind + " in " + where + ". Show a typical, generic scene for this kind of place with "
                + "soft natural light and an inviting travel-poster mood. No text, no lettering, no logos, no watermarks, "
                + "no close-up faces.";
    }

    private byte[] generate(String prompt, String seedSource) {
        if ("pollinations".equals(provider)) return generateFree(prompt, seedSource);
        try {
            JsonNode response = client.post().uri(apiUrl)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", model, "prompt", prompt, "size", size, "quality", quality, "n", 1))
                    .retrieve().body(JsonNode.class);
            String b64 = response == null ? "" : response.path("data").path(0).path("b64_json").asText("");
            if (b64.isBlank()) throw new IllegalStateException("Image service returned no image");
            return Base64.getDecoder().decode(b64);
        } catch (RestClientException | IllegalStateException | IllegalArgumentException ex) {
            log.warn("AI illustration generation failed: {}", ex.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The illustration service is unavailable right now.");
        }
    }

    /** Free Pollinations image API: GET with the prompt in the path; returns image bytes (usually JPEG). */
    private byte[] generateFree(String prompt, String seedSource) {
        String[] dims = size.split("x");
        int width = dims.length == 2 && dims[0].matches("[0-9]{2,4}") ? Integer.parseInt(dims[0]) : 1536;
        int height = dims.length == 2 && dims[1].matches("[0-9]{2,4}") ? Integer.parseInt(dims[1]) : 1024;
        long seed = Integer.toUnsignedLong(seedSource.hashCode()); // same place → same picture
        java.net.URI uri = org.springframework.web.util.UriComponentsBuilder.fromUriString(apiUrl)
                .path(java.net.URLEncoder.encode(prompt, StandardCharsets.UTF_8).replace("+", "%20"))
                .queryParam("width", Math.min(width, 1280)).queryParam("height", Math.min(height, 960))
                .queryParam("seed", seed).queryParam("nologo", "true").build(true).toUri();
        try {
            for (int attempt = 1; ; attempt++) {
                paceFreeCalls();
                try {
                    byte[] bytes = client.get().uri(uri).header("User-Agent", "Suttru/1.0").retrieve().body(byte[].class);
                    if (bytes == null || bytes.length < 1024 || imageType(bytes) == null)
                        throw new IllegalStateException("Image service returned no image");
                    return bytes;
                } catch (org.springframework.web.client.HttpStatusCodeException ex) {
                    if (attempt >= 2) throw ex; // one retry after a refusal/overload
                    log.info("Free illustration service answered {}; retrying once", ex.getStatusCode().value());
                }
            }
        } catch (RestClientException | IllegalStateException ex) {
            log.warn("Free AI illustration generation failed: {}", ex.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The illustration service is busy right now. Try again shortly.");
        }
    }

    private synchronized void paceFreeCalls() {
        long wait = lastFreeCall + freeMinIntervalMs - System.currentTimeMillis();
        if (wait > 0) {
            try { Thread.sleep(wait); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
        }
        lastFreeCall = System.currentTimeMillis();
    }

    /** Detects PNG/JPEG/WebP from magic bytes; null when the bytes are not an image. */
    public static MediaType imageType(byte[] bytes) {
        if (bytes == null || bytes.length < 12) return null;
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') return MediaType.IMAGE_PNG;
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) return MediaType.IMAGE_JPEG;
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P')
            return MediaType.parseMediaType("image/webp");
        return null;
    }

    private void reserveDailyQuota() {
        LocalDate today = LocalDate.now();
        if (!today.equals(usageDay)) {
            synchronized (this) {
                if (!today.equals(usageDay)) { usageDay = today; usedToday.set(0); }
            }
        }
        if (usedToday.incrementAndGet() > dailyLimit) {
            usedToday.decrementAndGet();
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Today's illustration limit has been reached.");
        }
    }

    private boolean exists(String key) {
        try {
            return storage.loadFile(storage.referenceFor(key)) != null;
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode() == HttpStatus.NOT_FOUND) return false;
            throw ex;
        }
    }

    private Illustration illustration(String fileName) {
        return new Illustration("/api/v1/discovery/place-illustrations/image/" + fileName, LABEL, NOTICE);
    }

    static String fileNameFor(String externalId) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(externalId.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 32) + ".png";
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String clean(String value, int max) {
        if (value == null) return "";
        String text = value.replaceAll("[\\p{Cntrl}\"\\\\]", " ").replaceAll("\\s+", " ").trim();
        return text.length() > max ? text.substring(0, max).trim() : text;
    }

    public record Illustration(String imageUrl, String label, String notice) {}
}
