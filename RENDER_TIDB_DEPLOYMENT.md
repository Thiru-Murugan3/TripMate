# TripMate — Render + TiDB Cloud Starter Free Deployment

This is the managed-cloud alternative to the Coolify/VM deployment.

## Architecture

```text
Browser
  |
  +--> Render Static Site: Angular
  |        |
  |        +--> HTTPS API calls
  |
  +--> Render Free Web Service: Spring Boot
           |
           +--> TLS MySQL connection
                    |
                    +--> TiDB Cloud Starter
```

The frontend is a Render Static Site. The backend is one Render Free Web Service. The database is TiDB Cloud Starter.

## Important free-tier behavior

Render Free web services spin down after inactivity and cold-start on the next request. The backend filesystem is ephemeral, so uploaded documents and profile photos stored under `uploads/` are not durable on the free Render service.

Database records are persistent in TiDB Cloud. File-upload persistence must be moved to object storage before relying on document/profile-photo uploads for long-term production use.

## 1. Create TiDB Cloud Starter

1. Sign in to TiDB Cloud.
2. Create a **TiDB Cloud Starter** instance.
3. Open the instance and click **Connect**.
4. Use:
   - Connection Type: **Public**
   - Branch: **main**
   - Connect With: **General**
5. Generate a database password.
6. Copy the host, port, username and password.

TiDB Cloud Starter requires TLS.

For the simplest first deployment, use the default `test` database. TripMate Flyway migrations will create the application tables there.

Prepare these three Render values:

```env
DB_URL=jdbc:mysql://YOUR_TIDB_HOST:4000/test?sslMode=VERIFY_IDENTITY&serverTimezone=UTC
DB_USERNAME=YOUR_PREFIX.root
DB_PASSWORD=YOUR_TIDB_PASSWORD
```

Do not commit the password or paste it into GitHub.

## 2. Create the Render Blueprint

1. Sign in to Render.
2. Connect your GitHub account.
3. Allow Render access to the private repository:
   `Thiru-Murugan3/TripMate`
4. In Render, create a **Blueprint**.
5. Select the TripMate repository.
6. Use the repository-root `render.yaml`.
7. Confirm the branch is `development`.

The Blueprint creates:

- `tripmate-api-thiru-murugan3` — Docker-based Spring Boot free web service
- `tripmate-web-thiru-murugan3` — Angular static site

The Angular build automatically receives the backend's Render public URL and writes it into `public/config.js` before the production build.

## 3. Enter the secret values

During the initial Blueprint creation, Render prompts for variables marked `sync: false`.

Enter:

```text
DB_URL
DB_USERNAME
DB_PASSWORD
TRIPMATE_BREVO_API_KEY
TRIPMATE_BREVO_SENDER_EMAIL
```

Do not add real values to `render.yaml`.

`JWT_SECRET` is generated automatically by Render.

## 4. Deploy

Deploy the Blueprint.

The backend must complete these startup stages:

1. Connect to TiDB over TLS.
2. Run Flyway migrations V1 through the latest migration.
3. Validate the Hibernate schema.
4. Start Spring Boot on Render's `PORT`.
5. Pass `/api/v1/health`.

The frontend then builds and is published as a Render Static Site.

Expected public URLs are based on the service names:

```text
https://tripmate-api-thiru-murugan3.onrender.com
https://tripmate-web-thiru-murugan3.onrender.com
```

If Render changes the frontend service name/URL, update both backend environment variables below to the actual frontend URL and redeploy the backend:

```text
APP_FRONTEND_URL
APP_CORS_ALLOWED_ORIGINS
```

## 5. Verify the backend

Open:

```text
https://tripmate-api-thiru-murugan3.onrender.com/api/v1/health
```

Expected JSON includes:

```json
{
  "status": "UP",
  "service": "tripmate-backend"
}
```

The first request after inactivity can take noticeably longer because the free backend may need to wake up.

## 6. Verify the frontend

Open:

```text
https://tripmate-web-thiru-murugan3.onrender.com
```

Check:

1. Login page loads.
2. Register a test user.
3. OTP email arrives through Brevo.
4. Verify OTP.
5. Login.
6. Refresh the page on `/dashboard`.
7. Create a test trip.
8. Test Explore/destination discovery.
9. Test invitation email/link.
10. Wait for token refresh and verify the session still works.

## 7. TiDB checks

After first backend startup, connect to TiDB and verify Flyway and TripMate tables exist. At minimum, verify:

```sql
SHOW TABLES;
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

If Flyway fails, inspect the Render backend deploy log before changing the database manually.

## 8. File-upload limitation

The current backend stores files in:

```text
uploads/
```

Render Free web services do not provide persistent disks. Files can disappear after a restart, redeploy, or spin-down.

Until object storage is added, treat these as non-durable on the Render free deployment:

- trip documents
- profile photos

Core relational data such as users, trips, itineraries, expenses, bookings, notifications and invitations remains stored in TiDB.

## 9. Staying at ₹0/month

To avoid accidental charges:

- keep the Render backend on the `free` plan
- keep the frontend as a static site
- do not attach a paid Render persistent disk
- keep TiDB Cloud Starter spending limit unset/at the free-only behavior
- monitor TiDB request/storage quota
- monitor Render free instance hours, bandwidth and build usage

## 10. Release workflow

Initial deployment tracks `development`.

Recommended flow:

```text
feature branch
   -> pull request
   -> CI
   -> development
   -> Render auto-deploy after checks pass
```

After the production flow is stable, you can switch Render to `main` if you want releases to happen only after promoting development to main.
