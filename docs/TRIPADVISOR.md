# Tripadvisor-only Explore: legacy and Terra adapters

`/explore` and each trip's Explore tab now render only `TripadvisorComponent`. The previous `/explore/india` URL redirects to `/explore`. Existing saved places, itinerary entries, group permissions, offline packs and their APIs are retained; the old source-catalogue component is no longer part of Explore. No catalogue fallback runs when Tripadvisor fails.

The page has a destination search and attraction/hotel/restaurant selector, followed by small photo cards. Search returns up to 10 provider matches in their original order. Four cards display per page; their credited photos load automatically, with two requests in flight per page. Details and provider bubble ratings load on demand. Missing/broken photos have a text placeholder, never a fabricated or unrelated image. Photo failures retain the place name and offer explicit retry. Search changes/navigation cancel pending requests and discard content.

## API configuration

The gateway supports explicit `LEGACY` and `TERRA` modes. Existing installations remain in `LEGACY` until the owner deliberately switches modes. Legacy calls use `api.content.tripadvisor.com` and the query-string key; Terra calls use `terra.tripadvisor.com/api`, `version=1` and the `X-API-Key` header, never a query-string key. There is no automatic fallback between APIs and no API key or account-plan auto-detection. Key presence does not prove validity, entitlement or location/photo access.

The developer URL `https://www.tripadvisor.com/developers?screen=home` belongs to the portal linked by the Terra documentation. The public portal announces the legacy sunset date of August 31, 2026 (October 30 for certain enterprise customers). The former 5,000-free-monthly-call offer must not be assumed to apply to a newly issued Terra key.

Set these variables on the **backend** service, never in Angular:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRIPADVISOR_API_MODE` | `LEGACY` | Explicit `TERRA` opt-in; no automatic failover |
| `TRIPADVISOR_TERRA_ENTITY_LIMIT` | `0` | Lifetime maximum conservatively reserved Terra entities; zero disables Terra calls |
| `TRIPADVISOR_API_KEY` | Empty | Secret API key; missing key disables live requests |
| `TRIPADVISOR_REFERER` | `APP_FRONTEND_URL`, otherwise `https://www.suttru.in` | HTTPS URL of your actual application domain registered in Tripadvisor |
| `TRIPADVISOR_DAILY_LIMIT` | 100 | Maximum attempted API calls per UTC day |
| `TRIPADVISOR_MONTHLY_LIMIT` | 4000 | Maximum attempted API calls per UTC calendar month |

The legacy Content API requires an HTTP **Referer** for domain-restricted keys. The legacy adapter sends the configured `Referer` and corresponding `Origin` on search, details and photo calls. Terra uses its own header authentication; changing the legacy referer does not migrate a key to Terra. It never uses an incoming browser-controlled header as the provider referer. Configure the exact registered domain: `suttru.in` and `www.suttru.in` may have different restrictions. If you registered `suttru.in`, set `TRIPADVISOR_REFERER=https://suttru.in`. Keep appropriate domain/IP restrictions in place. Invalid referer URLs (including credentials, query parameters or fragments) disable only the Tripadvisor integration rather than preventing the rest of the application from starting.

The previous adapter omitted these headers, a concrete compatibility bug for domain-restricted keys. Production logs showed V19 migrated successfully but did not record the provider's failure status, so the specific live rejection has not yet been verified. New safe logs include operation and status or exception class only; client errors use stable codes. No key, raw provider body or exception URL is exposed. `ACCESS_DENIED` means checking the key, domain/IP restrictions and legacy-vs-Terra access; it is not an invitation to remove security restrictions.

Merge and deploy backend/frontend together. New `render.yaml` settings require a Blueprint sync if using that configuration; Git-linked deploys alone do not necessarily sync Blueprint values. The application fallback uses the existing `APP_FRONTEND_URL` if no explicit referer is set. Existing API key stays in Render. No credentials were read or changed during this update.

## Terra activation and billing

**Default: no Terra requests.** Setting only `TRIPADVISOR_API_MODE=TERRA` is insufficient: an explicit positive `TRIPADVISOR_TERRA_ENTITY_LIMIT` is also required. Without it, `/status` returns `available:false` and `setupCode:TERRA_SETUP_REQUIRED`, and the UI explains the setup requirement. No Render configuration or secret is changed by the PR.

Before enabling, verify the account product, package, remaining allowance, provider budget and location access. Then set both mode and a conservative entity limit within the amount the owner has authorized, and deploy. This is not a promise of zero cost: the local counter cannot observe usage elsewhere, usage before deployment, provider pricing changes or a previous consumption of the account's free allowance.

The currently published Discover pricing grants **1,000 billable entities once per account lifetime**, followed by usage charges. Search is billed by each location returned, not by HTTP call alone. Details/photo endpoints consume usage per location. The adapter reserves the maximum requested search size (10) before a search and one entity before a details or photo request. Thus a search plus photos for four visible cards conservatively reserves 14 entities. Reservations are not refunded on empty/error responses. This deliberately overcounts rather than risking an underestimate. Existing daily/monthly request caps still apply.

V20 creates `tripadvisor_terra_usage`. Its lifetime entity count never resets when days/months roll over or the service restarts. Reservations and request counters use a shared transaction/row lock, preventing concurrent overspending of the configured application cap. Missing counters fail closed. Do not delete/reset counters to recover an allowance. An owner-authorized increase in the configured cap is a separate operational decision.

Terra end-user search calls **`/locations/search`**, scoped to licensed locations, using the requested category, `country_code=IN`, `search_type=COMBINED`, page 1 and size 10. It does not call the configuration-only Catalog endpoints to work around access limitations. It does not add, remove or overwrite any provider allowlist, upgrade a plan, or change permissions. An empty allowlist or contract restriction may prevent expected places/photos from appearing; configure these in the provider account as appropriate to the actual subscription.

## Terra response contract and links

The mapper follows the official Terra v1 OpenAPI definitions embedded in the documentation Markdown:

- Search: `data[].location`, `id`, `names[].value`, `addresses[].formatted`, `urls.tripadvisor.main`.
- Details: the root Location object, `descriptions[].value`, `traveler_ratings.overall.icon_url` and `.count`.
- Photos: `data[].photo.original_size_url`, `location_id`, `caption`, `user.username` or supplied `source.name` (`Traveler`/`Management`). Only one photo per location is requested. A missing personal username is not invented; the supplied source label is used.

Photo responses do not contain the property-page URL. The UI links the name/photo to the trusted property URL returned by search. A Terra photo with no applicable property link is not displayed. Rating counts link to the returned property page. Images stay on Tripadvisor's CDN and are not downloaded/re-hosted. Missing/untrusted URLs and mismatched photo location IDs are rejected. No generated images or surrogate place data are used.

Safe codes distinguish `TERRA_AUTHENTICATION` (401), `TERRA_ACCESS_DENIED` (403/package or key access), `LOCATION_ACCESS_REQUIRED` (404/missing or unlicensed location), `TERRA_ENTITY_LIMIT`, provider quotas and connection errors. Logs never include a header key, response body or provider exception text. No automatic retry/fallback or unexpected POST request occurs.

## Legacy calls and shared storage

One search costs one outbound call; visible cards each fetch a photo endpoint; details cost another. The first full four-card page normally uses five calls. Opening later pages loads their photos. No duplicate photo request within the same displayed search, background refresh or automatic retry. The page does not promise exhaustive results, entry fees, room prices or live camera imagery.

Flyway V19 stores durable request counts only, shared by all instances on the database. A row lock reserves each attempt before outbound access; failures count conservatively. Missing counter storage prevents provider calls. Set either limit to zero to stop calls. Application caps exclude usage before deployment, other applications using the key and provider billing-cycle differences; also configure the provider's own daily budget.

Tripadvisor content stays outside discovery caches, place creation, database catalogue imports, offline packs and indexes. Responses are `Cache-Control: no-store`; the browser retains only transient display state. The API key remains server-side, outbound host is fixed and content URLs are limited to trusted HTTPS Tripadvisor/TACDN hosts. Only location IDs may be retained under the documented caching policy. No imported Tripadvisor fields are saved to an itinerary by this UI. Existing independent saved-place and itinerary features remain available in their respective trip tabs.

Tripadvisor logo appears with its content; aggregate ratings use the API's bubble graphic. Photos include author and provider photo link. Uncredited photo entries are omitted. Text uses Angular interpolation, not HTML injection.

## Terra references

- https://docs.terra.tripadvisor.com/docs/overview
- https://docs.terra.tripadvisor.com/docs/versioning-compatibility
- https://docs.terra.tripadvisor.com/docs/usage-based-pricing
- https://docs.terra.tripadvisor.com/docs/api-access-and-limits
- https://docs.terra.tripadvisor.com/docs/guide-for-managing-allowed-locations
- https://docs.terra.tripadvisor.com/docs/caching-policy
- https://docs.terra.tripadvisor.com/docs/linking-policy
- https://docs.terra.tripadvisor.com/reference/locationssearch.md
- https://docs.terra.tripadvisor.com/reference/locationget.md
- https://docs.terra.tripadvisor.com/reference/locationphotosget.md

## Legacy references

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

Terra validation additionally covers exact documented request/response fields, no query-string key, no requests without activation, licensed-search-only routing, sanitized error codes, linked names/photos, and lifetime/concurrent entity-budget enforcement. All provider requests in tests are mocked. No live key validation or billing changes were performed.
