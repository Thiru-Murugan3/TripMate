# Discovery data policy

Suttru's Explore catalogue is source-backed. It must not invent a place, coordinate, entry fee, opening time, or image in order to make a result card look complete.

## Current providers

- Nominatim is the primary India-only destination geocoder.
- Photon is the fallback India-only destination geocoder.
- Explicitly configured Overpass instances provide OpenStreetMap place data. No public Overpass servers are silently appended as fallbacks.
- Wikidata/Wikipedia enrich linked objects with descriptions and exact-place identifiers.
- Wikimedia Commons images are used only when the place's OpenStreetMap/Wikidata/Wikipedia record links to that file.
- The Flyway-backed Suttru curated catalogue contains administrator-verified official tourism/provider records.
- Geoapify can supply additional licensed records only when `DISCOVERY_GEOAPIFY_API_KEY` is configured.
- OpenTripMap supplies additional nearby places when `DISCOVERY_OPENTRIPMAP_ENABLED=true` and its backend API key are configured. The published free plan is non-commercial; key presence alone does not activate it.

Provider attribution and the time Suttru checked the source are returned with each search. Geocoding, static catalogue data and volatile price-bearing searches use separate configurable cache periods. One provider failing returns partial sourced results with a warning instead of fabricated fallback data.

## Price rules

- `FREE` is returned only when the source explicitly marks the item as free (`fee=no` or `fee=free`).
- A numeric OpenStreetMap `charge` or `fee:amount` is returned as `ESTIMATED`, because it may not be current or sufficiently detailed.
- `UNKNOWN` is returned when no price can be supported by the source. The UI renders this as **Price not verified — check official website**, never as free.
- Every structured fee stores its unit, source URL, verification timestamp, status and expiry. Expired values are marked **May have changed**.
- Before booking or travelling, users should confirm price and opening details using the linked source or official website.

## Image rules

- Exact images come from linked OpenStreetMap/Wikidata/Wikipedia records or curated entries. Wikimedia images resolve the file metadata for author, licence and source page. External OSM images require explicit `image:author` and `image:license` tags.
- Cards and each gallery photo display linked attribution and the licence. Images without exact-place metadata, an explicit licence or attribution use the neutral placeholder.
- Generic city/category stock photos are not presented as photos of a specific listing.
- When no exact image is available, the UI shows Suttru's neutral category placeholder.

## Coverage limitations

OpenStreetMap coverage varies across India. The catalogue can return attractions, adventure, history, worship, museums, beaches, water, viewpoints, wildlife, parks, family activities, entertainment, shopping, food, culture/events, nightlife, wellness, stays and tour/transport services when the configured sources contain them. It cannot guarantee every commercial activity, current event, operator package, availability, or live ticket price without licensed/official provider integrations. Missing data remains visibly unknown. Suttru does not perform provider booking; it links to authorized official/provider pages when supplied.

## API summary

`GET /api/v1/discovery/places` supports:

- `destination`, `radiusKm`, and `category`
- `itemType`, `subcategory`, `priceStatus`, `minPrice`, `maxPrice`, `openNow`, `familyFriendly`, `difficulty`, duration and rating filters
- `name` filters the full fetched inventory before pagination, retaining the destination/radius
- `sort` (`RELEVANCE`, `DISTANCE`, `VERIFIED`, `RECENTLY_VERIFIED`, `POPULAR`, `PRICE_LOW`, `PRICE_HIGH`, or `NAME`)
- `page` and `size`

`GET /api/v1/discovery/places/{externalId}` returns a cached or curated listing detail. `/categories`, `/popular-destinations`, `/search-suggestions`, and `/reverse-geocode` provide catalogue metadata and India-only location lookup.

Admin-only `/api/v1/admin/discovery` endpoints list quality gaps/conflicts, create/update records, refresh verification timestamps and enable/disable listings. The `V9` Flyway migration stores curated listings, structured price options and exact image attribution without changing earlier migrations.

## Cache and selection behavior

Search and provider-detail caches are bounded and expire at the configured TTL or the next fee expiry, whichever comes first. Open/closed results are cached for at most one minute. Catalogue writes invalidate caches after commit; rolled-back writes do not. Cache generations prevent in-flight requests from restoring invalidated entries. Curated detail requests read the enabled record from the database.

Invalidation events are local to one backend instance. Deployments with multiple replicas need a shared invalidation channel before relying on immediate cross-instance updates; TTL expiry remains the fallback.

Selections retain complete listing snapshots across pages, filters and sorting within a destination. Changing destination clears the selection. Admin request fee options use `priceStatus`; read responses retain `status`. Editing a catalogue record preserves all existing fee options and image credits.

## Starter coverage

Flyway V16 seeds nine reviewed places and activities for Chennai, Mysuru and Jaipur. See [the evidence register](VERIFIED_CITY_CATALOGUE.md) for sources, coordinate provenance, tariff conflicts, expiry and maintenance instructions.

## Combined Explore setup

`/explore` and trip Explore now use a compact **Combined places** view by default. Tripadvisor remains a separate source tab, preserving its live-only storage policy and existing selection flow. Combined discovery reuses the original provider orchestration, curated records, bounded caches, India geocoding, duplicate detection, credited images and saved-place/itinerary APIs. It does not insert Tripadvisor content into these caches. Duplicate detection uses matching normalized names within 250 metres, preserves Unicode/Tamil names, and retains a credited photo from the duplicate record when the preferred record lacks one. Different spelling/transliteration may still produce duplicates.

Configure these only on the backend service:

| Variable | Activation |
| --- | --- |
| `DISCOVERY_GEOAPIFY_API_KEY` | Geoapify backend key; blank skips the provider. Published free plan is 3,000 credits/day with attribution; credit cost depends on query. |
| `DISCOVERY_OPENTRIPMAP_API_KEY` | OpenTripMap key; do not put it in Angular or commit it. |
| `DISCOVERY_OPENTRIPMAP_ENABLED` | Defaults to `false`. Set `true` only with a plan appropriate to the application's use. Published free plan: non-commercial, 5,000 requests/day, 10 requests/second. |
| `DISCOVERY_OVERPASS_URLS` | Comma-separated HTTPS Overpass endpoints whose policies permit your deployment. Defaults empty; use a permitted hosted service or your own server for production. Geoapify also supplies OSM-based data without direct Overpass access. |

Provider keys and endpoints were not configured in Render by this change. Configured provider failures return partial results and availability notes. Default-empty direct Overpass configuration intentionally removes the old implicit public-server traffic; existing explicit endpoint values are preserved and used in their configured order. Review the chosen server's current usage policy. Geoapify and OpenTripMap remain inactive without configuration; curated records can still appear for seeded cities.

OpenTripMap calls the documented `/0.1/en/places/radius` once per uncached search with JSON output and a 100-place limit. It maps XID, name, kinds, coordinates and linked Wikidata IDs, verifies coordinates/radius, and leaves fees/rating unknown. It does not bulk-fetch individual OpenTripMap details. At most four linked Wikidata records are enriched per provider fetch, with existing Commons metadata checks for exact photos, author, licence and source page. No generated, generic-city or uncredited image is substituted.

The combined inventory is bounded by `DISCOVERY_MAX_RESULTS` (default 200); OpenTripMap and Geoapify fetch up to 100 each. Pagination browses the fetched combined inventory, not every possible place in India. Limits and partial failures are shown in source notes. Small cards show name/category/distance, supported price status, credited photo when available, source and itinerary selection. Name search runs across fetched records before pagination. Selections persist across pages and require an explicit trip/day confirmation in the compact view; changing city cancels the old search and clears selection.

Sources: https://dev.opentripmap.org/price, https://dev.opentripmap.org/product, https://dev.opentripmap.org/openapi.en.json, https://www.geoapify.com/pricing/, https://apidocs.geoapify.com/docs/places/, https://wiki.openstreetmap.org/wiki/Overpass_API.
