package com.tripmate.discovery.provider;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ProviderHttpClientFactory {
    private final String userAgent;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;

    public ProviderHttpClientFactory(
            @org.springframework.beans.factory.annotation.Value("${discovery.user-agent:TripMate/1.0}") String userAgent,
            @org.springframework.beans.factory.annotation.Value("${discovery.connect-timeout-ms:8000}") int connectTimeoutMs,
            @org.springframework.beans.factory.annotation.Value("${discovery.read-timeout-ms:35000}") int readTimeoutMs
    ) {
        this.userAgent = userAgent;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
    }

    public RestClient create(int maximumReadTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.max(1000, connectTimeoutMs));
        factory.setReadTimeout(Math.max(3000, Math.min(readTimeoutMs, maximumReadTimeoutMs)));
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", userAgent)
                .defaultHeader("Accept-Language", "en")
                .build();
    }
}
