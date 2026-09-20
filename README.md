# TripMate

TripMate is a smart trip planning and management platform.

## Stack
- Web: Angular + TypeScript
- Mobile: Ionic + Angular + Capacitor
- Backend: Java + Spring Boot
- Database: MySQL / TiDB Cloud
- Object storage: Cloudflare R2 (S3-compatible)
- API: REST / OpenAPI
- Authentication: JWT + Refresh Token + Email OTP verification
- Transactional email: Brevo API
- Real-time: SSE
- CI/CD: GitHub Actions

## Brevo OTP Setup

TripMate now sends registration OTPs through the Brevo transactional email API. This is configured once on the backend. New users do not need Gmail App Passwords, SMTP credentials, or Brevo accounts.

One-time setup:
1. Create a Brevo account.
2. Add and verify the sender email TripMate will use.
3. Generate a Brevo API key.
4. Run `setup-brevo.bat`.
5. Enter the API key and verified sender email.
6. Run `run-backend.bat`.
7. Start Angular with `cd web && npm start`.
8. Register at `http://localhost:4200/register`.

Required local variables:

```env
BREVO_API_URL=https://api.brevo.com/v3/smtp/email
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=thirumuruganofficial3@gmail.com
BREVO_SENDER_NAME=TripMate
```

Never commit `backend/.env` or a real Brevo API key.


## Invitation links on another device

For local testing on another phone or computer connected to the same Wi-Fi, run:

    start-network.bat

TripMate will detect the PC LAN IP, configure the invitation URL and backend CORS, then start the backend and Angular for network access.

For public internet users, deploy TripMate to a public HTTPS frontend URL and set `APP_FRONTEND_URL` / `APP_CORS_ALLOWED_ORIGINS` accordingly. See `DEPLOYMENT.md`.


## Public invitation testing

For invitation links that must open from another network or device, use:

    start-public.bat

This starts TripMate with a temporary public HTTPS development URL. Send a new invitation only after the script reports that public mode is ready. See `DEPLOYMENT.md` for details.



## Free managed cloud deployment

TripMate can also be deployed without managing a VM by using **Render + TiDB Cloud Starter**:

- Angular: Render Static Site
- Spring Boot: Render Free Web Service
- Database: TiDB Cloud Starter (MySQL-compatible)
- Deployment definition: `render.yaml`

See `RENDER_TIDB_DEPLOYMENT.md` for the complete deployment flow and `CLOUDFLARE_R2_SETUP.md` for private document/profile-photo storage. With R2 enabled, new uploads remain durable across Render restarts and redeploys.

## Self-hosted production deployment

TripMate is prepared for self-hosted deployment with **Coolify** using the repository-level `docker-compose.coolify.yml`.

The production stack contains:

- Angular + Nginx web frontend
- Spring Boot backend
- MySQL
- persistent MySQL storage
- persistent document/profile-upload storage

Only the web service needs a public HTTPS domain. Nginx proxies `/api/*` to the private backend container.

See `ORACLE_FREE_VM.md` to create a free Oracle Linux VM and bootstrap Coolify, then use `COOLIFY_DEPLOYMENT.md` for the TripMate application deployment, required Brevo variables, generated Coolify variables, health checks, persistence, and smoke-test steps.

## Destination Discovery

TripMate's **Explore India** catalogue discovers source-backed places, activities, food, stays, events and tour essentials for Indian destinations and can add them to a trip.

Example flow:

1. Open **Explore** from the main navigation to casually search any destination; no trip is required.
2. Enter any city, town, or destination.
3. Select one or more tourist places while still in browse-only mode.
4. When ready to save, choose an existing trip where you have Owner or Editor access.
5. Save the selected places to **Places**, or use **Save & Add to Itinerary**.
6. You can also open a trip's **Explore** tab, which starts with that trip's destination but still allows another destination to be searched.
7. Search with India-only autocomplete or use the browser's current location, within 5, 10, 25, 50, or 100 km.
8. Filter the complete catalogue by type, category, subcategory, price, verified/free status, open-now state, family suitability, difficulty, duration and licensed rating.
9. Optionally assign Day 1 / Day 2 / Day 3 (or any available trip day), or use the 1-day, 2-day, or 3-day suggested-plan buttons before saving.
10. Administrators can use **Verify Data** to add/update sourced records, verify or expire fees, resolve provider conflicts, attach exact licensed images, and disable incorrect listings.

Discovery uses Nominatim with Photon fallback for India-only geocoding, the configured Overpass/OpenStreetMap endpoints for nearby objects, Wikidata/Wikipedia for linked descriptions, and Wikimedia Commons for exact linked images. A Flyway-backed TripMate catalogue takes priority for administrator-verified official tourism/provider data. Geoapify is an optional licensed provider when an API key is configured. Coverage depends on source data and is not guaranteed to represent every real-world place or current commercial package.

Optional backend configuration:

```env
DISCOVERY_NOMINATIM_URL=https://nominatim.openstreetmap.org
DISCOVERY_PHOTON_URL=https://photon.komoot.io
DISCOVERY_OVERPASS_URLS=https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter
DISCOVERY_USER_AGENT=TripMate/1.0
DISCOVERY_GEOCODE_CACHE_HOURS=24
DISCOVERY_STATIC_CACHE_HOURS=6
DISCOVERY_PRICE_CACHE_MINUTES=60
DISCOVERY_PRICE_VERIFICATION_DAYS=30
DISCOVERY_MAX_RESULTS=200
DISCOVERY_GEOAPIFY_API_KEY=
```

For production, use a provider/service deployment suitable for your expected traffic and keep discovery calls behind the TripMate backend rather than calling map providers directly from Angular.
Every price and image remains traceable to its source. Missing fees display **Price not verified — check official website**, and prices/timings should always be reconfirmed with the official provider.
