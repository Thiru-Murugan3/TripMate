package com.tripmate.discovery;

import java.util.EnumSet;

/** Interests can span several source categories without changing the source identity. */
public final class DiscoveryCategoryMatching {
    private DiscoveryCategoryMatching() {}
    public static boolean matches(DiscoveryCategory requested, DiscoveryCategory actual) {
        if (requested == null || requested == actual) return true;
        if (requested == DiscoveryCategory.NATURE) return EnumSet.of(DiscoveryCategory.WATERFALL,
                DiscoveryCategory.LAKE, DiscoveryCategory.RIVER, DiscoveryCategory.BEACH,
                DiscoveryCategory.VIEWPOINT, DiscoveryCategory.WILDLIFE, DiscoveryCategory.PARK).contains(actual);
        return requested == DiscoveryCategory.FAMILY && EnumSet.of(DiscoveryCategory.PARK,
                DiscoveryCategory.MUSEUM, DiscoveryCategory.ENTERTAINMENT).contains(actual);
    }
}
