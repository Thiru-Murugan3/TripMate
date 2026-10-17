# Google Search-based Top 10 places

After a destination search, both Combined places and Tripadvisor expose **Top 10 places to visit**. Clicking it explicitly requests a live, Google Search-grounded travel answer through the Gemini API. The result appears inside Explore as the complete numbered answer, linked sources and Google's associated Search Suggestions. It is AI-assisted guidance based on web search, not Google's official ranking, a Google Maps rating sort, or an exhaustive tourist inventory. The prompt requests up to ten supported places; fewer may be returned.

## Backend setup

The implementation defaults to disabled and does not activate billing, create an account, change Render settings or make any Google requests without configuration. Set these on the backend service only:

| Variable | Value |
| --- | --- |
| `GOOGLE_TOP_PLACES_ENABLED` | `true` after reviewing Google access, billing and terms |
| `GOOGLE_TOP_PLACES_API_KEY` | Private Gemini API key from Google AI Studio; never commit or enter it in Angular |
| `GOOGLE_TOP_PLACES_MODEL` | `gemini-3.5-flash-lite` by default; choose a currently accessible model supporting `google_search` |
| `GOOGLE_TOP_PLACES_DAILY_REQUEST_LIMIT` | Default `50` upstream API attempts per backend instance per UTC day, clamped to 1–2,000 |

Create/restrict the key in https://aistudio.google.com/apikey and review https://ai.google.dev/gemini-api/docs/pricing before enabling. Google Search grounding and model tokens can incur charges; a single upstream request may execute multiple billable Google searches. The application attempt limit is **not** a Google billing/spend cap. Set Google-side quotas/budget alerts as appropriate. The key is sent only in the `x-goog-api-key` header to the fixed Google API host. No key or upstream error body is logged or returned to the browser.

The retired Custom Search JSON API is not used: Google's current overview says it is closed to new customers and existing users must transition by January 1, 2027.

## Data and display contract

- Authenticated `POST /api/v1/discovery/top-places`, body `{ "destination": "Ooty" }`. Input must be 2–180 characters; destination geocoding remains India-only. Only the resolved public geographic name is sent to Google, without trip IDs, bookings, guests, documents or itinerary contents.
- Requests are explicit, never automatic on render, typing or pagination. At most two requests run concurrently; each user has a 30-second cooldown. Failed upstream attempts consume the instance's daily allowance. These are local process controls; a multi-replica deployment needs shared limits. Restarting an instance resets the allowance.
- The answer must finish normally and include search queries, HTTPS web sources, supporting metadata and Search Suggestions. Missing/incomplete grounding produces a recoverable error instead of a synthetic list. This validates the provider contract; it cannot independently prove every statement or Google's ordering.
- Preserve the complete answer text and associated source links/suggestion markup. No extracting records, reranking, truncating, merging into the ordinary catalogue, or automatically saving Google content to an itinerary.
- Render answer text with Angular interpolation, preserving line breaks. Render the required provider suggestion HTML/CSS in a Shadow DOM, without frames. Validate the markup against a restricted set of passive elements/HTTPS links before trusting it; scripts, event handlers, active embeds and external CSS imports/URLs are rejected. If it cannot render safely, withhold the whole answer and show retry guidance. Live rendering against an enabled key remains a required activation check because provider markup can change.
- No caching, persistence, click tracking, response logging, database rows, offline packs or generated imagery. Successful responses use `Cache-Control: no-store` and `Pragma: no-cache`. The offline worker already bypasses API requests and non-GET methods. Results are released when the panel closes, the destination changes, the source view changes or the component is destroyed. No state is shared between users.
- Ordinary sourced place discovery, selection snapshots and itinerary saving remain separate and available when Google is disabled or fails. The new button does not add a navbar Explore link.

## Verification before live activation

Local tests use fabricated API fixtures, never actual Google content. After configuring an allowed key/model, sign in, search at least two destinations, click the button, verify the complete answer, source links and original Google Search Suggestions appear correctly, then change city and confirm the answer disappears. Check Google project usage and restrict the key as appropriate. No successful live Google call is claimed without this check.

Primary references (checked October 17, 2026):

- https://ai.google.dev/gemini-api/docs/generate-content/google-search
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/terms (Grounding with Google Search restrictions and application requirements)
- https://developers.google.com/custom-search/v1/overview

## Diagnosing live failures

The backend distinguishes rejected/expired keys, blocked key restrictions, disabled API service, billing/credit requirements, access denial, unavailable model/API version, Google quota exhaustion, request-option errors, transient provider failures, socket timeouts and connection failures. Runtime warnings contain only a numeric upstream HTTP status and fixed category (or a fixed network category). No upstream body/message, raw reason code, key, model value, destination, project ID, request URL or exception stack is logged. A 429 from Google remains 429 in Suttru; a socket timeout becomes 504. Automatic retries and model changes are not introduced, so failed requests cannot silently multiply billable attempts.

Use the category to choose a next step; do not assume a billing requirement or change models based only on the former generic unavailable message. After the diagnostic version is deployed, retry once and inspect the displayed category-specific guidance or `Google top-places request rejected` runtime warning. Live key access/model compatibility still needs verification with the configured project.
