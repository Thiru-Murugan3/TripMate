package com.tripmate.discovery;

public final class TouristPlacePriority {
    private TouristPlacePriority() {}
    public static int rank(DiscoveredPlace place) {
        return switch(place.category()) {
            case FOOD, STAY, SHOPPING, TRANSPORT, NIGHTLIFE, WELLNESS -> 1;
            default -> 0;
        };
    }
}
