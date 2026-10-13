# Opt-in flight updates

This release adds periodic FlightAware AeroAPI status checks to confirmed, non-sandbox flight bookings. The Flight updates panel appears in Timeline and Bookings. It does not book flights or overwrite booking/timeline times. Live estimates are shown alongside the saved travel plan.

## Traveller flow

1. Save or review/import the booking first.
2. The owner or an editor opens Flight updates and confirms the airline code (prefer the operating ICAO designator for codeshares), flight number, departure date at origin, airport codes and departure IANA time zone.
3. Enable tracking and save. Other guest roles cannot change tracking configuration.
4. Each active member selects **Notify me** to opt into their own in-app alerts. No other travellers are subscribed automatically.
5. Read current/saved status, departure/arrival estimates, gates and terminals where supplied. Every card shows the source and last successful check. Both departure and arrival times are explicitly displayed in the selected departure time zone.

The initial successful lookup establishes a baseline; an initial delay, cancellation or diversion also triggers an alert for existing subscribers. Later changes create one persisted notification per subscribed active member. Identical snapshots do not notify again. Removing membership prevents future delivery. Notification SSE delivery occurs after the transaction commits. Opening the notification takes the traveller to the trip via existing navigation.

Booking cancellation or edits to the route/date/provider stop further provider calls until eligible details are confirmed again. Flight operational cancellation is an informational status; it never cancels a booking in Suttru.

## Activation and reliability prerequisites

Disabled by default. No live API key is bundled and no subscription is purchased.

- Configure `FLIGHTAWARE_API_KEY` as a backend secret and set `FLIGHT_ALERTS_ENABLED=true` after validating provider coverage/licensing for your routes.
- Keep `SPRING_FLYWAY_ENABLED=true` on Render. Flyway V18 adds tracking, subscriptions and the API budget. Do not enable tracking with unapplied migrations.
- Use an always-running backend before promising travel-day delivery. The existing Render free service can sleep; its process cannot check flights while asleep. In-app SSE reaches connected users; persisted notifications are available when they return. This release does not deliver mobile/browser push, SMS or email alerts.
- Verify booking import/review, duplicate rejection, expenses, member-role restrictions and offline travel packs on the deployed environment. Passing unit/CI tests is not a substitute for that signed-in smoke check.
- Pilot with a small set of real Indian routes, confirm date/time-zone matching and gate availability, and compare against airline information before enabling broadly.

## Polling and cost controls

A scheduled scan processes up to five due bookings per pass. A booking is checked at most every 15 minutes from 18:00 on the previous local date through three days after the start of its departure date. Transient failures retry after 30 minutes. Shared database row locks and persisted due times prevent concurrent duplicate checks, including multiple application instances.

`FLIGHT_ALERTS_DAILY_REQUEST_LIMIT` defaults to 200 for the whole installation, resetting by UTC day. Reservations are committed in a separate transaction before the API call, so failed calls also consume allowance. After exhaustion, checks retry hourly and cards explain the limit. This caps requests, not monetary cost; provider billing is governed by the selected plan. Each lookup requests one page. Incomplete/ambiguous result sets are rejected instead of silently tracking another flight.

No match is shown as unavailable, never “on time.” First matching uses the designator, both airports and the origin-local date, then pins FlightAware's flight ID. Ambiguous diversion legs are retained as unavailable pending an unambiguous provider response. Provider failures retain old snapshots and do not expose provider response bodies or API keys to users. The timestamp means “last successful fetch,” not guaranteed freshness of the airline feed. The Refresh button fetches the stored status; it does not spend an extra provider request.

## Provider contract

Uses `GET https://aeroapi.flightaware.com/aeroapi/flights/{ident}` with the `x-apikey` header, `ident_type`, `max_pages=1`, and an origin-local day's UTC `start`/`end` for initial matching. Subsequent lookups use `fa_flight_id`. Fields include `scheduled_out`, `estimated_out`, `actual_out`, corresponding `*_in` times, cancellation/diversion flags, and origin/destination gate and terminal values.

Reference: https://www.flightaware.com/commercial/aeroapi/resources/aeroapi-openapi.yml (official downloadable specification inspected for this implementation). Missing gate timestamps remain unavailable; runway times are used only to determine operational status/date matching, never mislabeled as gate times.

## Validation

CI includes provider matching tests (time zones, wrong routes, ambiguity, pagination, pinned IDs), service tests (permissions, deduplication, inactive members, stale recovery, booking changes, cost cap), persistence tests, migration table checks and frontend tests (setup, preferences, disabled/demo flights, retained state on failure). Provider fixtures are synthetic and make no paid calls. Actual API connectivity and coverage still need validation with an authorized account.
