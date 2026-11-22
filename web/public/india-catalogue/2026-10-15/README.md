# Suttru India place inventory — broader source edition

15 October 2026. **This remains an incomplete research/staging dataset. It is not a verified list of every tourist place.**

## What changed

The previous 4,392-record catalogue used selective tourism listings. This release adds a separate, explicit source classification for 33,927 community-sourced place candidates and 3,698 government heritage-register records. The master now contains 42,017 records. These are source records, not a verified unique-attraction count: aliases and cross-source duplicates remain. Tamil Nadu has 14,881 records, compared with 382 previously. No fixed record target was used.

## Browse

Open `preview.html` after extracting. Filter State/UT → District → category or source. Community candidates and government registry entries are visibly labelled. `places.json` and `places.csv` contain the same master inventory. `states/`, `districts/` and `tamil-nadu-districts/` provide grouped exports. `district-category-coverage.csv` exposes empty categories as research gaps, not evidence that no such places exist.

## Source scope

1. Previous national and district tourism listings are preserved with their IDs and evidence.
2. Wikidata structured data (CC0) was queried for entities explicitly declaring country India and belonging to selected attraction, religious-site, natural-feature and recreational categories through instance/subclass relationships. All successful queries are included without a result LIMIT. This query scope misses unmapped places, missing country/type statements, private listings and many small local attractions. A zero-result query is not proof that a category has no places in India. `source-collection-report.json` records each scope and count. Raw structured results and exact queries are in `source-records/broader/wikidata/`.
3. The ASI centrally protected monument/site register published in April 2025 contains 3,698 entries. All entries were extracted, joining table rows that continue across pages. Each of the 33 state/UT totals reconciles with the PDF summary. This is the complete selected register, not every monument or tourist attraction in India. Registry entries can represent groups of structures, inscriptions, archaeological land or restricted places. Names and localities are factual registry labels, not visitor descriptions.

## Candidate status and districts

Community entries use `CANDIDATE_REVIEW_REQUIRED`; they are not independently confirmed tourist attractions. Temple, church, mosque, park, lake, reservoir and dam records may be local, private, inaccessible, restricted or unsuitable for tourism. No public access or current operation is asserted. Source type, tourist relevance, visitor access, coordinates and fees are separate fields.

Wikidata district labels follow P131 administrative relationships. Known dissolved/former districts are excluded from the preferred assignment where metadata identifies them; conflicting district/state paths remain unassigned with candidate evidence. These relationships can still be outdated. Coordinates are reference points and have not been checked against district boundary polygons.

ASI districts are retained **as published**, with `ASI_PUBLISHED_DISTRICT_CURRENT_BOUNDARY_NOT_VERIFIED`. Some places now belong to districts formed after the source's administrative grouping. Do not interpret an ASI district grouping as a verified current boundary assignment. `district_as_published`, locality and PDF page reference are retained. District spelling aliases are normalized for browsing; `district-index.json` counts labels, not an authoritative count of India's current districts.

## Duplicates and existing work

An entity is automatically linked to an existing record only when the same Wikidata entity ID was already cited. Names alone do not trigger destructive merges. `duplicate-review-broader.csv` lists exact-name/district candidates for identity review. Different names and transliterations can still identify the same place. Previous record IDs, names, existing fee evidence and photograph files remain intact. No repository, application or database was changed.

## Fees, photographs and source terms

New fees, opening hours, live status and photos are unknown; no values were invented. No new photos are supplied. Existing fee/photo tables retain their previous checking dates and licensing metadata. Wikidata structured data is CC0: https://www.wikidata.org/wiki/Wikidata:Licensing . ASI source: https://asi.nic.in/pdf/CPM_List.pdf . Source links are evidence, not blanket permission to reproduce third-party images or text. The ASI PDF itself is not redistributed here.

## Remaining work

This release does not complete every district. Missing local attractions and source records without usable names, state or district assignments remain. Broader map data, state archaeology registers, forest/park and municipal inventories, religious-site directories, private-operator sources and local validation are still needed. `all_india_exhaustive` remains false. Do not publish the catalogue as “all tourist places”, as unique-place counts, or as verified/live visitor information.
