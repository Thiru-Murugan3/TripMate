package com.tripmate.discovery.provider;

import com.tripmate.discovery.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Manually checked exact-object facts. No copied photos or assumed licensing. */
public final class ReviewedAdventureFacts {
    private ReviewedAdventureFacts() {}
    public static DiscoveredPlace apply(DiscoveredPlace place) {
        if(place.externalId().equals("osm:node:13285506794")) {
            String source="https://www.redchilliadventure.com/tours/shivpuri-rafting-ganga-tapovan-uttarakhand";
            Instant checked=Instant.parse("2026-10-24T00:00:00Z"), expiry=Instant.parse("2026-11-07T00:00:00Z");
            var option=new DiscoveryPriceOption("Shivpuri rafting package (confirm pricing unit)",new BigDecimal("1500"),null,
                    PriceType.UNKNOWN,"INR","https://www.redchilliadventure.com/collections/tours",checked,PriceStatus.STARTING_FROM,expiry,!expiry.isAfter(Instant.now()));
            return place.toBuilder().website(source).officialWebsite(source).bookingUrl(source)
                    .shortDescription("Example package: Shivpuri rafting, approximately 3 hours including transfers and briefing. Confirm the selected package and availability with the operator.")
                    .activityDuration(180).suggestedVisitMinutes(180)
                    .bestTimeToVisit("Published Shivpuri departures: 09:00 and 14:00; confirm seasonal operation. These are departure times, not office hours.")
                    .estimatedCostPerPerson(null).priceStatus(PriceStatus.STARTING_FROM).priceType(PriceType.UNKNOWN)
                    .priceOptions(List.of(option)).verificationExpiresAt(expiry).verificationExpired(!expiry.isAfter(Instant.now())).build();
        }
        if(place.externalId().equals("osm:node:13454788338")) {
            return place.toBuilder().website("https://hevalrivercottage.in/").officialWebsite("https://hevalrivercottage.in/gallery/")
                    .bookingUrl("https://hevalrivercottage.in/")
                    .bestTimeToVisit("Venue/reservation hours do not establish rafting operating times. Ask the operator for the activity schedule and quote.")
                    .openNow(null).build();
        }
        return place;
    }
}
