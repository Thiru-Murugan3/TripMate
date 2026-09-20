package com.tripmate.discovery.provider;

import java.net.URI;

final class ProviderUrlSupport {
    private ProviderUrlSupport() {
    }

    static URI uri(String baseUrl, String suffix) {
        URI base = URI.create(baseUrl);
        String basePath = base.getPath() == null || "/".equals(base.getPath()) ? "" : base.getPath().replaceAll("/$", "");
        try {
            return new URI(base.getScheme(), null, base.getHost(), base.getPort(), basePath + suffix, null, null);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid provider URL", ex);
        }
    }
}
