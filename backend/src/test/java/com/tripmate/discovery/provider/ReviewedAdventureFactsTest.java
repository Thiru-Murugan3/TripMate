package com.tripmate.discovery.provider;
import com.tripmate.discovery.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ReviewedAdventureFactsTest {
 @Test void operatorOfferHasItsOwnSourceAndNeverBecomesAnAssumedPerPersonEntryFee() {
  var place=DiscoveredPlace.builder().externalId("osm:node:13285506794").name("Red chilli adventure").category(DiscoveryCategory.ADVENTURE).build();
  var result=ReviewedAdventureFacts.apply(place);
  assertNull(result.estimatedCostPerPerson());assertEquals(PriceStatus.STARTING_FROM,result.priceStatus());
  assertEquals("1500",result.priceOptions().getFirst().amount().toPlainString());
  assertEquals(PriceType.UNKNOWN,result.priceOptions().getFirst().priceType());
  assertTrue(result.priceOptions().getFirst().sourceUrl().startsWith("https://www.redchilliadventure.com/"));
  assertNotNull(result.verificationExpiresAt());assertTrue(result.imageGallery().isEmpty());
  var unknown=place.toBuilder().externalId("osm:node:99").build();assertSame(unknown,ReviewedAdventureFacts.apply(unknown));
 }
}
