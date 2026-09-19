# Discovery data policy

TripMate's Explore catalogue is source-backed. It must not invent a place, coordinate, entry fee, opening time, or image in order to make a result card look complete.

## Current providers

- Nominatim is the primary India-only destination geocoder.
- Photon is the fallback India-only destination geocoder.
- Configured Overpass instances provide OpenStreetMap place data.
- Wikimedia Commons images are used only when the exact OpenStreetMap object links to a Commons file.

Provider attribution and the time TripMate checked the source are returned with each search. Search responses are cached for the configured discovery cache period.

## Price rules

- `FREE` is returned only when the source explicitly marks the item as free (`fee=no` or `fee=free`).
- A numeric OpenStreetMap `charge` or `fee:amount` is returned as `ESTIMATED`, because it may not be current or sufficiently detailed.
- `UNKNOWN` is returned when no price can be supported by the source. The UI renders this as **Price not verified**, never as free.
- Before booking or travelling, users should confirm price and opening details using the linked source or official website.

## Image rules

- An exact image is shown only when an OpenStreetMap object supplies an `image` or `wikimedia_commons` tag.
- Generic city/category stock photos are not presented as photos of a specific listing.
- When no exact image is available, the UI shows TripMate's neutral placeholder.

## Coverage limitations

OpenStreetMap coverage varies across India. The current implementation can return mapped attractions, nature, heritage, worship, food, shopping, stays, and mapped adventure/sport locations. It cannot guarantee every commercial activity, current event, operator package, availability, or live ticket price without licensed/official provider integrations. Missing data remains visibly unknown.

## API summary

`GET /api/v1/discovery/places` supports:

- `destination`, `radiusKm`, and `category`
- `itemType`, `priceStatus`, `minPrice`, and `maxPrice`
- `sort` (`DISTANCE`, `VERIFIED`, `PRICE_LOW`, `PRICE_HIGH`, or `NAME`)
- `page` and `size`

`GET /api/v1/discovery/places/{externalId}` returns a cached listing detail, while `/categories` exposes supported categories and filter values.
