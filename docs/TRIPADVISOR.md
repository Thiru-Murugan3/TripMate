# Tripadvisor live lookup

Explore → **Tripadvisor photos & ratings** opens a compact, keyboard-accessible dialog. Search a city or named place, choose attractions/hotels/restaurants, then open details and optionally load traveller photos. Search returns up to 10 matches. It does not claim exhaustive coverage, current entry fees, bookable room prices or live camera imagery. Traveller review text and popularity rankings are deliberately omitted.

The backend uses the **legacy Content API v1** (`api.content.tripadvisor.com`), the product with the advertised 5,000 free monthly calls. Tripadvisor now marks this API deprecated in favour of Terra. A Terra key is not interchangeable. Confirm the product in your account; this implementation has not verified the owner's key or subscription. Do not place keys in Angular, commits, or chat.

## Render configuration

The existing `TRIPADVISOR_API_KEY` belongs on the backend service. Configuration maps it to `discovery.tripadvisor.api-key`. Missing keys disable live requests while existing discovery remains usable. Merge and deploy backend/frontend together. Flyway migration V19 creates the request-counter table before use. No existing trip, place, itinerary or catalogue schema changes.

Optional backend variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRIPADVISOR_DAILY_LIMIT` | 100 | Maximum attempted outbound API calls per UTC day |
| `TRIPADVISOR_MONTHLY_LIMIT` | 4000 | Maximum attempted outbound API calls per UTC calendar month |

Set either limit to zero to stop calls. Limits are durable in MySQL/TiDB and shared by all instances using that database. A row lock reserves and commits each call before the outbound request; failed calls count conservatively. Concurrent requests and restarts cannot reset the counts. Counter storage failure prevents outbound calls. Existing authentication protects all endpoints. Never delete/reset the counter to bypass a limit.

These are **Suttru usage caps**, not a guarantee of zero billing: usage before deployment, use of the same key elsewhere, Tripadvisor billing-cycle differences, and provider pricing still apply. Set your provider daily budget too and inspect its usage dashboard. One search = one call; opening details = another; explicitly loading photos = another. No background requests, auto-refresh or automatic retries. `/status` consumes no provider calls.

## Content handling

Tripadvisor's caching policy allows retaining only location IDs. This adapter is intentionally separate from `DiscoveryProvider`, `DestinationDiscoveryService` caches, saved-place creation and offline packs. JSON is projected into a small DTO, returned with `Cache-Control: no-store`, kept only while the lookup is open, and discarded on close/filter change/navigation. No server-side content cache, index or DB import. The existing service worker excludes APIs. Photos load from provider URLs; no image files are downloaded into the dataset. The key and upstream error body/URL never enter client responses. Outbound host is fixed; returned media/link URLs are restricted to trusted HTTPS Tripadvisor/TACDN domains.

Existing Suttru checkboxes, day assignments, guest permissions, save operations, price contracts and offline packs retain their existing code paths. The Tripadvisor dialog is a live reference lookup; it does **not** offer to copy Tripadvisor content into itineraries. Use Suttru's independent catalogue/discovery records for itinerary planning. Extending that behaviour requires separately licensed data or permission to store the fields.

Tripadvisor logo appears beside its content. Aggregate ratings use the bubble graphic supplied by the API, never custom stars. Credited photos include their author and provider photo link; incomplete/untrusted photo entries are omitted. Broken photos are removed. Text remains Angular-escaped. Required logo asset: https://files.readme.io/9f59534-Vector_1.png (official display-requirements page).

## Official references

- https://tripadvisor-content-api.readme.io/reference/overview
- https://tripadvisor-content-api.readme.io/reference/caching-policy
- https://tripadvisor-content-api.readme.io/reference/display-requirements
- https://tripadvisor-content-api.readme.io/reference/searchforlocations
- https://tripadvisor-content-api.readme.io/reference/getlocationdetails
- https://tripadvisor-content-api.readme.io/reference/getlocationphotos

## Validation

Backend: mocked provider contract/error handling, no key leakage, invalid requests, trusted media, no caching, controller no-store, H2 transaction tests for durable caps, rollover and concurrent reservations. Existing discovery orchestration tests cover saved-place/cache behaviour separately.
Frontend: mocked HTTP flow, no automatic paid requests, provider bubbles/photo credits, stale-request cancellation, quota recovery and disposal, plus existing Explore and catalogue selection tests. Production Angular build. Live key, account entitlement and Render deployment require verification after merge.
