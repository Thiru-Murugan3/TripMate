package com.tripmate.discovery;

import java.util.EnumSet;

/** Interests can span several source categories without changing the source identity. */
public final class DiscoveryCategoryMatching {
    private DiscoveryCategoryMatching() {}
    public static boolean matches(DiscoveryCategory requested, DiscoveryCategory actual) {
        if (requested == null || requested == actual) return true;
        return requested == DiscoveryCategory.FAMILY && EnumSet.of(DiscoveryCategory.PARK,
                DiscoveryCategory.MUSEUM, DiscoveryCategory.ENTERTAINMENT).contains(actual);
    }
}
