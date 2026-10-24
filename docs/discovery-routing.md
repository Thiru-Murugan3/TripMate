# Discovery and daily road estimates

Discovery runs independent providers concurrently using bounded worker queues. The primary source phase has an eight-second deadline. When needed, the fallback has a separate eight-second budget; its interest queries run concurrently with a six-second budget. Location resolution happens before these phases and can add latency. Healthy results survive a source deadline; unavailable sources are listed in coverage warnings. A deadline can reduce coverage compared with waiting indefinitely.

Broad searches defer optional photo and description enrichment. Photo galleries use exact OSM identities from Geoapify source metadata or explicit Wikidata identities from OpenTripMap. Names and internal provider IDs are never guessed into photo identities. Empty source photo results expire after five minutes. Opening View details requests cached exact-source enrichment; unavailable information remains unknown.

Daily planning has an All days/single-day selector. Get driving estimate sends the displayed ordered coordinates to the backend, which calls Geoapify Routing using the existing `discovery.geoapify.api-key` configuration (`DISCOVERY_GEOAPIFY_API_KEY`). No key is sent to the browser. The UI identifies Geoapify before the request. There is no automatic request on load and no automatic reorder or booking.

Routes support 2–25 points, including start/return stays. Estimates include per-leg and total road distance/time and road geometry, with a 30-minute cache. Times exclude live traffic and time at activities. Editing stops, changing the stay, loading another trip or destroying the view invalidates visible estimates. Missing keys, quota failures and unavailable routes fall back to clearly labelled schematic distances and Maps links; there is no straight-line-speed travel-time estimate.

Official reference: https://apidocs.geoapify.com/docs/routing/

Booking partnerships and checkout are intentionally outside this change.
