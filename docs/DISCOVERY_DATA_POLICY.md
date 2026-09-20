# Discovery data policy

TripMate's Explore catalogue is source-backed. It must not invent a place, coordinate, entry fee, opening time, or image in order to make a result card look complete.

## Current providers

- Nominatim is the primary India-only destination geocoder.
- Photon is the fallback India-only destination geocoder.
- Configured Overpass instances provide OpenStreetMap place data.
- Wikidata/Wikipedia enrich linked objects with descriptions and exact-place identifiers.
- Wikimedia Commons images are used only when the place's OpenStreetMap/Wikidata/Wikipedia record links to that file.
- The Flyway-backed TripMate curated catalogue contains administrator-verified official tourism/provider records.
- Geoapify can supply additional licensed records only when `DISCOVERY_GEOAPIFY_API_KEY` is configured.

Provider attribution and the time TripMate checked the source are returned with each search. Geocoding, static catalogue data and volatile price-bearing searches use separate configurable cache periods. One provider failing returns partial sourced results with a warning instead of fabricated fallback data.

## Price rules

- `FREE` is returned only when the source explicitly marks the item as free (`fee=no` or `fee=free`).
- A numeric OpenStreetMap `charge` or `fee:amount` is returned as `ESTIMATED`, because it may not be current or sufficiently detailed.
- `UNKNOWN` is returned when no price can be supported by the source. The UI renders this as **Price not verified — check official website**, never as free.
- Every structured fee stores its unit, source URL, verification timestamp, status and expiry. Expired values are marked **May have changed**.
- Before booking or travelling, users should confirm price and opening details using the linked source or official website.

## Image rules

- An exact image is shown only when an OpenStreetMap object supplies an `image` or `wikimedia_commons` tag.
- Generic city/category stock photos are not presented as photos of a specific listing.
- When no exact image is available, the UI shows TripMate's neutral category placeholder.

## Coverage limitations

OpenStreetMap coverage varies across India. The catalogue can return attractions, adventure, history, worship, museums, beaches, water, viewpoints, wildlife, parks, family activities, entertainment, shopping, food, culture/events, nightlife, wellness, stays and tour/transport services when the configured sources contain them. It cannot guarantee every commercial activity, current event, operator package, availability, or live ticket price without licensed/official provider integrations. Missing data remains visibly unknown. TripMate does not perform provider booking; it links to authorized official/provider pages when supplied.

## API summary

`GET /api/v1/discovery/places` supports:

- `destination`, `radiusKm`, and `category`
- `itemType`, `subcategory`, `priceStatus`, `minPrice`, `maxPrice`, `openNow`, `familyFriendly`, `difficulty`, duration and rating filters
- `sort` (`RELEVANCE`, `DISTANCE`, `VERIFIED`, `RECENTLY_VERIFIED`, `POPULAR`, `PRICE_LOW`, `PRICE_HIGH`, or `NAME`)
- `page` and `size`

`GET /api/v1/discovery/places/{externalId}` returns a cached or curated listing detail. `/categories`, `/popular-destinations`, `/search-suggestions`, and `/reverse-geocode` provide catalogue metadata and India-only location lookup.

Admin-only `/api/v1/admin/discovery` endpoints list quality gaps/conflicts, create/update records, refresh verification timestamps and enable/disable listings. The `V9` Flyway migration stores curated listings, structured price options and exact image attribution without changing earlier migrations.
