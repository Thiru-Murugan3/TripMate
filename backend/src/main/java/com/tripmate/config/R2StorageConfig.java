package com.tripmate.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
@ConditionalOnProperty(prefix = "storage.r2", name = "enabled", havingValue = "true")
public class R2StorageConfig {

    @Bean(destroyMethod = "close")
    public S3Client r2S3Client(
            @Value("${storage.r2.endpoint}") String endpoint,
            @Value("${storage.r2.access-key-id}") String accessKeyId,
            @Value("${storage.r2.secret-access-key}") String secretAccessKey
    ) {
        validateConfiguration(endpoint, accessKeyId, secretAccessKey);

        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(credentials(accessKeyId, secretAccessKey))
                .serviceConfiguration(s3Configuration())
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build();
    }

    @Bean(destroyMethod = "close")
    public S3Presigner r2S3Presigner(
            @Value("${storage.r2.endpoint}") String endpoint,
            @Value("${storage.r2.access-key-id}") String accessKeyId,
            @Value("${storage.r2.secret-access-key}") String secretAccessKey
    ) {
        validateConfiguration(endpoint, accessKeyId, secretAccessKey);

        return S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(credentials(accessKeyId, secretAccessKey))
                .serviceConfiguration(s3Configuration())
                .build();
    }

    private StaticCredentialsProvider credentials(String accessKeyId, String secretAccessKey) {
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKeyId, secretAccessKey)
        );
    }

    private S3Configuration s3Configuration() {
        return S3Configuration.builder()
                .pathStyleAccessEnabled(true)
                .build();
    }

    private void validateConfiguration(String endpoint, String accessKeyId, String secretAccessKey) {
        if (endpoint == null || endpoint.isBlank()
                || accessKeyId == null || accessKeyId.isBlank()
                || secretAccessKey == null || secretAccessKey.isBlank()) {
            throw new IllegalStateException(
                    "Cloudflare R2 is enabled but its endpoint or credentials are missing"
            );
        }
    }
}
