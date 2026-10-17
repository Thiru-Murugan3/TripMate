# Free Top 10 places to visit

Both Explore source views offer **Top 10 places to visit** after destination search. This replaces Gemini/Google Search grounding: no Google/Gemini request, key, billing setup, AI response or Google ranking is used. Existing Google environment variables are no longer read by the application; they may be removed from the backend environment separately without sharing their values.

## Sources and limits

Authenticated `GET /api/v1/discovery/top-places?destination=Ooty&radiusKm=25` uses only the curated verified catalogue, explicitly configured OpenStreetMap/Overpass instances and key-free Wikidata. Geoapify, OpenTripMap, Tripadvisor, Photon name lookup and any unrecognized future provider are excluded from this endpoint, including when their keys are configured for ordinary Explore. Existing geocoding remains Nominatim/Photon, with its public-service rate controls and geographic candidate checks. No new API key is required. Public services remain subject to usage policies, finite coverage and availability; application hosting still has its normal costs.

The selected radius is honoured (1–100 km; default 25). City changes, radius changes and component destruction cancel the displayed request and clear old highlights. The list contains at most ten source-backed tourist places; restaurants, hotels, shopping, transport, nightlife, wellness and transient events cannot crowd it out. If fewer than ten supported places are available, display the actual count, not placeholder attractions. Provider warnings and attribution remain available.

Highlights rank administrator-curated records first, then existing source coverage/prominence signals, confidence and distance, with a stable name tie-break. Wikidata language sitelink counts are a coverage signal, not visitor counts or user ratings; absent/invalid counts stay unknown. This is a Suttru shortlist among fetched places, not an official or comprehensive popularity ranking. The ordinary discovery inventory limit and each provider's bounded retrieval still apply.

The free path has a separate cache namespace from ordinary discovery, so optional paid-provider records cannot enter it through an earlier search. It uses the existing bounded TTL/invalidation cache, duplicate detection, exact-image attribution rules, fee expiry and detail lookup. Missing fees stay unknown and the feature does not generate images. Partial provider failures retain valid results with warnings.

The panel is compact and shows names, category, distance and source links. In Combined places, **Find in Explore** submits the selected name through the existing discovery/checkbox/trip-day workflow. The usual itinerary and group permissions are preserved. The Tripadvisor tab's free shortlist is sourced separately from Tripadvisor content.

## Configuration

No Top 10-specific activation variables are needed. Google service classes, key/model configuration and required Search Suggestions HTML rendering have been removed. Existing `DISCOVERY_OVERPASS_URLS` can improve coverage when configured with permitted reliable instances, while Wikidata provides key-free landmarks without an Overpass endpoint. Do not add commercial-only or non-commercial-restricted providers to the allowlist without reviewing their plan and updating this contract.

Deploy the updated backend and frontend together, then refresh existing browser tabs. The former Google POST contract is replaced by the free GET endpoint; older cached frontend bundles must be refreshed.
