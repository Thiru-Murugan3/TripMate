# State-wise India catalogue

Route: `/explore/india`, linked from the existing Explore screen. The route uses the existing auth guard. It is a read-only research browser with a link back to the existing destination search and trip-planning flow. Records are not automatically inserted into saved places, itineraries or the verified discovery database.

The 2026-10-14 research snapshot contains 2,089 source records across 36 states/UTs, 334 Tamil Nadu records, 108 screened historical Commons photos and 35 fee options for six attractions. It is not comprehensive; duplicate candidates and incomplete district/location information remain. The screen explicitly shows these limitations. Fees are historical source observations, not live quotes. Zero applies only to the listed visitor/scope condition. Missing fees never become free.

## Isolation and delivery

Only the existing Explore navigation and route table change. No backend, migration, existing discovery price/cache contract, permission, offline worker, booking, expense, timeline or flight-alert logic changes. The new service fetches public versioned static assets through HttpBackend, avoiding token attachment and auth-refresh side effects. Only the selected state and visible lazy-loaded photos are fetched; the 8.9 MB catalogue is not part of the JavaScript bundle or offline shell cache. State changes cancel pending requests and clear district/search/page state. Failed requests offer retry.

The static files are public assets; the route guard is not intended to make tourism data confidential. Source references and image candidates without reviewed reuse metadata are excluded. Credits, license links, original photo source and reported capture dates accompany all displayed photographs. Broken/missing images show a text placeholder.

## Updating

The committed `web/public/india-catalogue/2026-10-14/index.json` lists the 36 state files and counts. Each state file embeds the applicable reviewed photo metadata and fee rows from the expanded research release, keyed by `place_id`. `thumbnails/` holds the corresponding provider thumbnails. All rows retain `publication_status: REVIEW_REQUIRED`. Keep source URLs/dates, unknown values, fee conditions and duplicate markers during future imports. Never promote records into the existing verified catalogue without its normal review process.

Publish a new dated directory and update `CATALOGUE_ROOT` and the integrity-test root together for future snapshots. Retain older directories during rolling deploys so open tabs can still fetch their version. Only include screened, licensed image metadata and files; do not ingest the upstream photo-match candidates or official-site image references. Do not guess districts from tourism destinations.

## Verification and rollback

`npm run test:india-catalogue` runs asset-integrity checks and Angular tests for unknown/zero fees, request cancellation, pagination/filtering, retry and auth isolation. Web CI also runs the existing discovery, admin, auth, expense, flight and offline suites and production/development/Render builds.

Rollback is a revert of this branch: no database or saved-trip cleanup is necessary. Do not merge or deploy until review and CI pass.
