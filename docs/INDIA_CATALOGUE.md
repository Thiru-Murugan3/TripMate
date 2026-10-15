# State-wise India catalogue

Route: `/explore/india`, linked from both standalone and trip Explore. The same catalogue also appears inline after a destination search, independently of live-provider success. A sourced destination/district index selects a matching state; ambiguous or unknown destinations require the traveller to select a state. State names are matched ignoring spaces and punctuation. Nearby search result counts are labelled separately. The route uses the existing auth guard. It is a read-only research browser with a link back to the existing destination search and trip-planning flow. Records are not automatically inserted into saved places, itineraries or the verified discovery database.

The active 2026-10-15 research snapshot contains 42,017 source records, including 14,881 Tamil Nadu records. It includes 4,392 prior tourism-source records, 33,927 community candidates and 3,698 government heritage-register entries. The 36 state/UT groups contain 37,891 records; another 4,126 retain an unknown state and are browsable under **State not assigned**. Counts represent source records, not unique verified attractions. Aliases and cross-source duplicates are preserved for review.

The 108 screened historical Commons photos and 35 fee options for six attractions remain unchanged. No new images, fees or visitor-access claims are invented. Candidate cards show their source class and review status. Expanded details explain unverified tourist relevance/access and historical ASI district assignments. Category and source filters remain inside the existing compact filter panel. Fees are historical observations, not live quotes; a zero tariff applies only to its visitor/scope condition. Missing fees never become free.

## Isolation and delivery

No backend, migration, existing discovery price/cache contract, permission, offline worker, booking, expense, timeline or flight-alert logic changes. Public versioned static assets use HttpBackend, avoiding token attachment and auth-refresh side effects. Only the index, selected state and visible lazy-loaded photos are fetched. The new snapshot is about 48 MB on disk and is not part of the JavaScript bundle or offline shell cache. Large state files can take time on slow connections. State changes cancel pending requests and clear district/category/source/search/page state. Failed requests offer retry.

The static files are public assets; the route guard is not intended to make tourism data confidential. Source references and image candidates without reviewed reuse metadata are excluded. Credits, license links, original photo source and reported capture dates accompany all displayed photographs. Broken/missing images show a text placeholder.

## Updating

The committed `web/public/india-catalogue/2026-10-15/index.json` lists state files, counts, the unassigned group and source-derived destination/name aliases. Each state file embeds the applicable photo metadata and fee rows keyed by `place_id`. `thumbnails/` holds provider thumbnails. Records retain `REVIEW_REQUIRED` or `CANDIDATE_REVIEW_REQUIRED`. Keep source URLs/dates, unknown values, fee conditions, district caveats and duplicate markers. Never promote records into the verified catalogue without its normal review process. `provenance.json` records the uploaded archive SHA-256, source counts and upstream quality summary.

Rebuild a new snapshot from the uploaded release with the standard-library-only importer:

```sh
python3 web/scripts/import-india-catalogue.py /absolute/path/to/release.zip --snapshot YYYY-MM-DD
```

The importer rejects overwriting a snapshot, duplicate IDs, missing references and changes to the previous release's fee/photo evidence. It copies selected browser fields and reviewed thumbnails, not the 354 MB archive, raw source dumps or preview. State and district assignments are retained as supplied, including unknowns. No name-only destructive deduplication occurs.

Publish a new dated directory and update `CATALOGUE_ROOT` and the integrity-test root together for future snapshots. Retain older directories during rolling deploys so open tabs can still fetch their version. Only include screened, licensed image metadata and files; do not ingest the upstream photo-match candidates or official-site image references. Do not guess districts from tourism destinations.

## Verification and rollback

`npm run test:india-catalogue` checks counts, trust labels, fees and licensed thumbnails, previous-record/evidence preservation, and Angular behaviour for unknown/zero fees, cancellation, pagination/filtering, aliases, unassigned states, source/district caveats, retry and auth isolation. Web CI also runs the existing discovery, admin, auth, expense, flight and offline suites and production/development/Render builds.

Rollback is a revert of this branch: no database or saved-trip cleanup is necessary. Do not merge or deploy until review and CI pass.
