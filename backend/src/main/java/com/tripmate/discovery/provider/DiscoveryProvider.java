package com.tripmate.discovery.provider;

public interface DiscoveryProvider {
    String name();
    DiscoveryProviderResult discover(DiscoveryProviderRequest request);
}
