# Tripadvisor-only Explore

`/explore` and each trip's Explore tab now render only `TripadvisorComponent`. The previous `/explore/india` URL redirects to `/explore`. Existing saved places, itinerary entries, group permissions, offline packs and their APIs are retained; the old source-catalogue component is no longer part of Explore. No catalogue fallback runs when Tripadvisor fails.

The page has a destination search and attraction/hotel/restaurant selector, followed by small photo cards. Search returns up to 10 provider matches in their original order. Four cards display per page; their credited photos load automatically, with two requests in flight per page. Details and provider bubble ratings load on demand. Missing/broken photos have a text placeholder, never a fabricated or unrelated image. Photo failures retain the place name and offer explicit retry. Search changes/navigation cancel pending requests and discard content.

## API configuration

The adapter targets **legacy Content API v1**, `api.content.tripadvisor.com`. Terra uses different endpoints/authentication and is not supported by this adapter. Key presence is not proof of key validity, product entitlement or location/photo access.

Set these variables on the **backend** service, never in Angular:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRIPADVISOR_API_KEY` | Empty | Secret API key; missing key disables live requests |
| `TRIPADVISOR_REFERER` | `APP_FRONTEND_URL`, otherwise `https://www.suttru.in` | HTTPS URL of your actual application domain registered in Tripadvisor |
| `TRIPADVISOR_DAILY_LIMIT` | 100 | Maximum attempted API calls per UTC day |
| `TRIPADVISOR_MONTHLY_LIMIT` | 4000 | Maximum attempted API calls per UTC calendar month |

Tripadvisor requires an HTTP **Referer** for domain-restricted keys. The adapter sends the configured `Referer` and corresponding `Origin` on search, details and photo calls. It never uses an incoming browser-controlled header as the provider referer. Configure the exact registered domain: `suttru.in` and `www.suttru.in` may have different restrictions. If you registered `suttru.in`, set `TRIPADVISOR_REFERER=https://suttru.in`. Keep appropriate domain/IP restrictions in place. Invalid referer URLs (including credentials, query parameters or fragments) disable only the Tripadvisor integration rather than preventing the rest of the application from starting.

The previous adapter omitted these headers, a concrete compatibility bug for domain-restricted keys. Production logs showed V19 migrated successfully but did not record the provider's failure status, so the specific live rejection has not yet been verified. New safe logs include operation and status or exception class only; client errors use stable codes. No key, raw provider body or exception URL is exposed. `ACCESS_DENIED` means checking the key, domain/IP restrictions and legacy-vs-Terra access; it is not an invitation to remove security restrictions.

Merge and deploy backend/frontend together. New `render.yaml` settings require a Blueprint sync if using that configuration; Git-linked deploys alone do not necessarily sync Blueprint values. The application fallback uses the existing `APP_FRONTEND_URL` if no explicit referer is set. Existing API key stays in Render. No credentials were read or changed during this update.

## Calls and storage

One search costs one outbound call; visible cards each fetch a photo endpoint; details cost another. The first full four-card page normally uses five calls. Opening later pages loads their photos. No duplicate photo request within the same displayed search, background refresh or automatic retry. The page does not promise exhaustive results, entry fees, room prices or live camera imagery.

Flyway V19 stores durable request counts only, shared by all instances on the database. A row lock reserves each attempt before outbound access; failures count conservatively. Missing counter storage prevents provider calls. Set either limit to zero to stop calls. Application caps exclude usage before deployment, other applications using the key and provider billing-cycle differences; also configure the provider's own daily budget.

Tripadvisor content stays outside discovery caches, place creation, database catalogue imports, offline packs and indexes. Responses are `Cache-Control: no-store`; the browser retains only transient display state. The API key remains server-side, outbound host is fixed and content URLs are limited to trusted HTTPS Tripadvisor/TACDN hosts. Only location IDs may be retained under the documented caching policy. No imported Tripadvisor fields are saved to an itinerary by this UI. Existing independent saved-place and itinerary features remain available in their respective trip tabs.

Tripadvisor logo appears with its content; aggregate ratings use the API's bubble graphic. Photos include author and provider photo link. Uncredited photo entries are omitted. Text uses Angular interpolation, not HTML injection.

## References

- https://tripadvisor-content-api.readme.io/reference/api-security
- https://tripadvisor-content-api.readme.io/reference/authentication
- https://tripadvisor-content-api.readme.io/reference/overview
- https://tripadvisor-content-api.readme.io/reference/caching-policy
- https://tripadvisor-content-api.readme.io/reference/display-requirements
- https://tripadvisor-content-api.readme.io/reference/searchforlocations
- https://tripadvisor-content-api.readme.io/reference/getlocationdetails
- https://tripadvisor-content-api.readme.io/reference/getlocationphotos

## Validation

Backend tests verify referer/origin headers, configurable domains, sanitized denial codes, no key leakage, invalid requests, credited media, no-store responses and transactional budget caps. Frontend tests cover direct routes, no modal/fallback, automatic visible-page photos, request concurrency, provider order, pagination, attribution, domain errors, quota recovery and cancellation. Existing discovery/catalogue selection regression tests are retained; production Angular and full CI builds validate the trip-page integration.
