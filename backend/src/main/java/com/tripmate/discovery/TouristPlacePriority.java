package com.tripmate.discovery;

public final class TouristPlacePriority {
    private TouristPlacePriority() {}
    public static int rank(DiscoveredPlace place) {
        if(!place.curated() && place.category()==DiscoveryCategory.ATTRACTION && place.name()!=null
                && place.name().toLowerCase(java.util.Locale.ROOT).matches(".*\\b(school ground|school play ?ground|parade ground|volleyball ground|badminton ground|soccer ground|football ground|cricket ground|army ground)\\b.*")) return 3;
        return switch(place.category()) {
            case RIVER -> 1;
            case FOOD, STAY, SHOPPING, TRANSPORT, NIGHTLIFE, WELLNESS -> 2;
            default -> 0;
        };
    }
}
