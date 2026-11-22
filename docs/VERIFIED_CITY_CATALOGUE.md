# Verified city starter catalogue

Reviewed online on 12 October 2026 (UTC). This release adds nine source-backed records across Chennai, Mysuru and Jaipur: six places and three activities. These are online source checks, not on-site inspections or guaranteed live availability.

The existing catalogue provider supplies these records to search, filters, detail pages and itinerary selection. Apply Flyway V16 through normal backend startup. No manual production SQL is required. Existing admin records are untouched.

## Evidence register

| Listing | Content / price source | Coordinate source |
| --- | --- | --- |
| Marina Beach | [Chennai District Administration](https://chennai.nic.in/tourist-place/marina/) | [Location](https://geographic.org/geographic_names/name.php?c=india&fid=2690&uni=9093708) (13.051389, 80.283889) |
| Government Museum, Chennai | [Chennai District Administration](https://chennai.nic.in/tourist-place/government-museum/) | [Location](https://mapcarta.com/W1126975457) (13.07128, 80.25675) |
| Muttukadu Boat House boating | [Tamil Nadu Tourism Development Corporation](https://www.ttdc.in/) | [Location](https://en.wikipedia.org/wiki/Muttukadu_boat_house) (12.8058083, 80.2419194) |
| Mysuru Palace | [Mysuru District Administration](https://mysore.nic.in/en/tourist-place/mysuru-palace/) | [Location](https://mysore.nic.in/en/tourist-place/mysuru-palace/) (12.305135, 76.655148) |
| Mysuru Zoo | [Mysuru Zoo](https://www.mysuruzoo.info/visit) | [Location](https://www.mysuruzoo.info/visit) (12.3022057, 76.6641882) |
| Karanji Lake birdwatching | [Mysuru Zoo](https://www.mysuruzoo.info/visit) | [Location](https://mysore.nic.in/en/tourist-place/karanji-lake/) (12.302778, 76.673611) |
| Amber Palace | [Rajasthan Tourism](https://www.tourism.rajasthan.gov.in/amber-palace.html) | [Location](https://en.wikipedia.org/wiki/Amer_Fort) (26.9859, 75.8507) |
| Jantar Mantar, Jaipur | [Rajasthan Tourism](https://www.tourism.rajasthan.gov.in/jantar-mantar.html) | [Location](https://whc.unesco.org/en/list/1338/maps/) (26.9247222, 75.825) |
| Amber Palace light and sound show | [Rajasthan Tourism](https://www.tourism.rajasthan.gov.in/amber-palace.html) | [Location](https://en.wikipedia.org/wiki/Amer_Fort) (26.9859, 75.8507) |

## Verification boundaries

- Source review timestamps are fixed to the research date. Installing the migration later does not renew verification. All records expire on 11 November 2026; the app then displays its existing stale-verification warning.
- Mysuru Zoo: adult admission INR 120, children 5–12 INR 60, under 5 free. Karanji Lake admission: adults INR 60, children 5–12 INR 30. Each option has its own source, unit and expiry. The adult price is the card headline; free child admission does not make the entire listing free.
- The district Karanji page contains an older INR 10 adult tariff. Prefer the zoo operator’s INR 60 tariff. Do not import the old boating price. Birdwatching is self-guided, not a newly invented bookable tour; activity evidence: https://www.incredibleindia.gov.in/en/karnataka/mysuru/mysuru-zoo.
- TTDC advertises Muttukadu starting at INR 150 without a clear boat/passenger unit in the retrieved listing. Do not convert this into a per-person fee. The record stays UNKNOWN.
- All remaining fees are UNKNOWN with no numeric fallback. No guessed hours, durations, age limits, ratings, accessibility guarantees or availability are populated.
- Coordinates represent sites rather than verified entrances. Amber’s show shares the fort pin; travellers must confirm its meeting point. Muttukadu is a Chennai-area excursion about 36 km south of the centre and requires the 50 km search radius.
- Images remain neutral placeholders: official-source photos are not automatically licensed for reuse. Add only exact-place photos with separately verified author, licence and source metadata through the existing admin editor.

## Maintenance and acceptance

Use the existing admin catalogue editor to recheck source pages, update each fee option and renew its expiry; never extend dates without rereading the source. Disable an activity if its operator no longer offers it. Future seed changes use a new migration, never edits to V16 after deployment.

Search Chennai (50 km), Mysuru (10 km) and Jaipur (20 km). Check Places and Activities filters, open source links, inspect the five Mysuru price options, and add entries to an itinerary. The migration smoke test checks city coverage, activity coverage, unknown-price integrity and fee provenance on MariaDB.
