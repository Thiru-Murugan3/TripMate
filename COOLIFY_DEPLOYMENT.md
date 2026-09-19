# TripMate Self-Hosted Deployment with Coolify

TripMate is configured to deploy as one Git-based Docker Compose application on a self-hosted Coolify server.

## Architecture

Only the Angular/Nginx web container is public.

```text
Internet
   |
   v
Coolify Proxy / HTTPS
   |
   v
web (Angular + Nginx :8080)
   |
   | /api/*
   v
backend (Spring Boot :8080)
   |
   v
mysql (MySQL :3306)
```

The backend, database, and uploaded files stay inside the Compose stack. Nginx proxies browser API traffic to the backend so the browser uses the same public origin.

## Repository deployment file

Use:

`docker-compose.coolify.yml`

It builds the existing production Dockerfiles in:

- `backend/Dockerfile`
- `web/Dockerfile`

The stack also creates persistent Docker volumes for:

- MySQL data
- TripMate document/profile uploads

Do not remove these volumes during normal redeployments.

## 1. Install Coolify

Install the self-hosted open-source Coolify edition on a Linux server or VM that you control.

After Coolify is reachable, create a Project and a production Environment.

## 2. Connect the TripMate GitHub repository

Create a new Application from Git and select this repository.

Recommended settings:

- Branch: `development` while you are testing deployment
- Build Pack: **Docker Compose**
- Base Directory: `/`
- Docker Compose Location: `/docker-compose.coolify.yml`

For a private repository, connect GitHub through a Coolify GitHub App or another supported private-repository method.

Coolify reads the Compose definition from Git and can redeploy when the selected branch changes.

## 3. Required environment variables

The Compose file uses Coolify generated values for the MySQL user/password, MySQL root password, the public web URL, and the JWT secret.

You only need to supply the external Brevo values:

```env
TRIPMATE_BREVO_API_KEY=your_real_brevo_api_key
TRIPMATE_BREVO_SENDER_EMAIL=your_verified_sender@example.com
TRIPMATE_BREVO_SENDER_NAME=TripMate
```

Do not commit these values to Git.

Coolify should also show generated variables such as:

```text
SERVICE_USER_MYSQL
SERVICE_PASSWORD_64_MYSQL
SERVICE_PASSWORD_64_MYSQLROOT
SERVICE_REALBASE64_64_JWT
SERVICE_URL_WEB_8080
```

Keep the generated database/JWT values stable after the first deployment.

## 4. Public domain

The Compose file declares:

```text
SERVICE_URL_WEB_8080
```

for the `web` service. Configure or accept the Coolify-generated public domain for that service on internal port `8080`.

You can later replace it with your own domain such as:

```text
https://tripmate.example.com
```

Coolify's proxy handles HTTPS for the public web service.

The same generated URL is passed to the backend as:

- `APP_FRONTEND_URL`
- `APP_CORS_ALLOWED_ORIGINS`

This means invitation emails point back to the deployed TripMate frontend.

## 5. Database and Flyway

The MySQL database is not exposed publicly.

Spring Boot connects to:

```text
mysql:3306
```

inside the Compose network.

Flyway applies the TripMate migrations when the backend starts. Production Hibernate settings are:

```env
JPA_DDL_AUTO=validate
JPA_SHOW_SQL=false
```

This keeps Flyway as the schema migration source of truth instead of letting Hibernate modify production tables.

## 6. Persistent uploads

TripMate currently stores trip documents and profile images on the backend filesystem under `/app/uploads`.

The Coolify Compose stack mounts:

```text
uploads_data:/app/uploads
```

so uploaded files survive normal container replacements and redeployments.

Back up both `mysql_data` and `uploads_data` before destructive maintenance or server migration.

## 7. Health checks

The stack includes health checks for:

- MySQL
- Spring Boot: `/api/v1/health`
- Angular/Nginx: `/`

Coolify uses Compose health checks for Docker Compose applications.

## 8. Deploy

After saving the required Brevo variables and web domain, deploy the application.

Wait for all three services to become healthy:

```text
mysql   healthy
backend healthy
web     healthy
```

Then open the public `web` URL.

## 9. Production smoke test

Verify at least:

1. Registration + email OTP.
2. Login.
3. Access-token refresh.
4. Create a trip.
5. Send an email invitation.
6. Open the invitation link from another browser/device and accept it.
7. Notifications.
8. Explore destination discovery.
9. Save places / add itinerary items.
10. Expenses and bookings.
11. Upload and download a document.
12. Log out and log back in.

## Updating TripMate

When the application is connected to the Git repository, deploy a newer commit from Coolify or enable automatic deployment for the selected branch.

For a safer release process later, deploy from `main` instead of `development` after QA/UAT approval.

## Secrets and security

- Never commit Brevo keys, passwords, or JWT secrets.
- Expose only the `web` service publicly.
- Do not publish MySQL port 3306.
- Do not publish the backend directly unless you intentionally need a public API domain.
- Keep server SSH access restricted.
- Enable regular server, MySQL-volume, and uploads-volume backups.
