# Discovery data policy

Suttru's Explore catalogue is source-backed. It must not invent a place, coordinate, entry fee, opening time, or image in order to make a result card look complete.

## Current providers

- Nominatim is the primary India-only destination geocoder. The common spelling `Wayanadu` is normalized to the Wayanad district in Kerala for search and suggestions, preventing an unrelated business with that spelling from becoming the search centre.
- Photon is the fallback India-only destination geocoder. Destination geocoders reject business/road candidates and accept geographic area categories, preventing a shop from becoming the city centre. The public Nominatim endpoint is not used for autocomplete; Photon supplies suggestions.
- A user-submitted particular-place search also queries the configured Photon endpoint for up to 20 named OpenStreetMap objects within an India-only bounding box. The shared OSM mapper verifies the actual circular radius, preserves OSM IDs and enforces the existing fee and photo-credit rules. Generic roads, buildings and locality matches are excluded from this place lookup. It runs for every destination, without requiring a Wikidata identifier. Results remain filtered by the submitted name and selected category before pagination.
- Explicitly configured Overpass instances provide OpenStreetMap place data. No public Overpass servers are silently appended as fallbacks.
- Wikidata/Wikipedia enrich linked objects with descriptions and exact-place identifiers. A key-free Wikidata landmark query supplements every supported landmark search within the selected India destination radius, even when earlier providers have already returned 25 tourist records. Mapped classes include caves, archaeological sites, churches, rivers, dams, zoos and nature reserves alongside the original landmark types.
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
- `name` requests a bounded Photon/OpenStreetMap name lookup and a name-constrained Wikidata landmark query before their respective source limits, then filters provider records before the combined cap and pagination, retaining the destination/radius. Case, spacing and punctuation differences do not hide fetched name matches. Named searches use separate bounded cache entries.
- `sort` (`RELEVANCE`, `DISTANCE`, `VERIFIED`, `RECENTLY_VERIFIED`, `POPULAR`, `PRICE_LOW`, `PRICE_HIGH`, or `NAME`)
- `page` and `size`

`GET /api/v1/discovery/places/{externalId}` returns a cached or curated listing detail. `/categories`, `/popular-destinations`, `/search-suggestions`, and `/reverse-geocode` provide catalogue metadata and India-only location lookup.

Admin-only `/api/v1/admin/discovery` endpoints list quality gaps/conflicts, create/update records, refresh verification timestamps and enable/disable listings. The `V9` Flyway migration stores curated listings, structured price options and exact image attribution without changing earlier migrations.

## Cache and selection behavior

Search and provider-detail caches are bounded and expire at the configured TTL or the next fee expiry, whichever comes first. Search inventories retain at most 64 destination/radius/category combinations, limiting memory as inventories grow. Searches with provider-unavailable warnings expire within two minutes; failed Overpass endpoints also enter a two-minute retry cooldown, allowing subsequent requests to try other configured endpoints. Open/closed results are cached for at most one minute. Catalogue writes invalidate caches after commit; rolled-back writes do not. Cache generations prevent in-flight requests from restoring invalidated entries. Curated detail requests read the enabled record from the database.

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

The combined inventory is bounded by `DISCOVERY_MAX_RESULTS` (default 500). Tourist landmarks take priority over food, stays, shopping, transport, nightlife and wellness before inventory truncation; the requested display sort still applies afterward. OpenTripMap fetches up to 100 records. Geoapify follows up to three 100-record pages (300 records), stopping on a short page; each page consumes provider quota and a later-page failure preserves earlier results. The key-free Wikidata provider makes one bounded 200-row geographic query for mapped landmark classes, verifies coordinates/radius and removes repeated entity IDs. At most four linked entities receive optional Commons enrichment; missing photos and fees remain unknown. This source also has finite coverage and can be unavailable. The radius selector offers 10, 25 (default), 50 and 100 km; a larger radius includes surrounding areas and can increase latency. Pagination browses the fetched combined inventory, not every possible place in India. Limits and partial failures are shown in source notes. Small cards show name/category/distance, supported price status, credited photo when available, source and itinerary selection. Name search queries Photon/OpenStreetMap and Wikidata within the selected radius and filters matching provider records before truncation and pagination. Selections persist across pages and require an explicit trip/day confirmation in the compact view; changing city cancels the old search and clears selection.

Sources: https://dev.opentripmap.org/price, https://dev.opentripmap.org/product, https://dev.opentripmap.org/openapi.en.json, https://www.geoapify.com/pricing/, https://apidocs.geoapify.com/docs/places/, https://wiki.openstreetmap.org/wiki/Overpass_API, https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries, https://www.wikidata.org/wiki/Wikidata:Data_access.


Photon uses the existing `DISCOVERY_PHOTON_URL` (default public demo); results are cached by destination/radius/category/name. Name lookup is only triggered by an explicit user search, with one bounded request and no bulk crawling. The public Photon server permits reasonable project use, can throttle heavy traffic and provides no availability guarantee. Configure a suitable hosted or self-hosted endpoint as traffic grows: https://github.com/komoot/photon and https://github.com/komoot/photon/blob/master/docs/api-v1.md. Public Nominatim policy (including no autocomplete and a maximum aggregate rate of one request/second) is enforced by skipping public autocomplete and a shared single-instance request gate that falls back to Photon when busy: https://operations.osmfoundation.org/policies/nominatim/. Multiple backend replicas require shared rate limiting or a suitable hosted geocoder before using the public endpoint at scale.

## Free Top 10 highlights

Explore offers a compact Top 10 shortlist without Gemini/Google Search or keyed discovery-provider requests. Only curated, configured OpenStreetMap and Wikidata sources are consulted in a separate cache namespace. Ranking uses editorial verification, available source prominence/coverage and distance, not visitor ratings. Fewer than ten real records are shown when coverage is limited. See [the free highlights contract](FREE_TOP_PLACES.md).
