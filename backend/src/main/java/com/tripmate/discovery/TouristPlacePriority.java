package com.tripmate.discovery;

public final class TouristPlacePriority {
    private TouristPlacePriority() {}
    public static int rank(DiscoveredPlace place) {
        return switch(place.category()) {
            case RIVER -> 1;
            case FOOD, STAY, SHOPPING, TRANSPORT, NIGHTLIFE, WELLNESS -> 2;
            default -> 0;
        };
    }
}
