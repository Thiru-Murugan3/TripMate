# TripMate Production Deployment on Railway

This deployment keeps the browser-facing Angular application public while the Spring Boot backend and MySQL database communicate through Railway private networking.

## Target services

Create one Railway project with these services:

1. **MySQL** — Railway MySQL database.
2. **backend** — GitHub source: this repository, root directory: `/backend`.
3. **web** — GitHub source: this repository, root directory: `/web`.

Use the service names **backend** and **web** exactly when following the variable examples below.

The frontend Nginx container serves the Angular production build and proxies `/api/*` to the backend over Railway private networking. The backend does not need a public domain.

## 1. Create MySQL

In the Railway project, add a MySQL database.

Railway provides values such as:

- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

Keep the database private unless you explicitly need external database access.

## 2. Create backend service

Connect the GitHub repository and set the service root directory to:

`/backend`

Railway will use `backend/Dockerfile` and `backend/railway.toml`.

Add these variables to the backend service:

```env
SERVER_PORT=8080
DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

JWT_SECRET=REPLACE_WITH_A_STRONG_BASE64_SECRET
JWT_ACCESS_EXPIRATION=900000
JWT_REFRESH_EXPIRATION=604800000

TRIPMATE_BREVO_API_KEY=REPLACE_WITH_YOUR_BREVO_API_KEY
TRIPMATE_BREVO_SENDER_EMAIL=REPLACE_WITH_YOUR_VERIFIED_SENDER
TRIPMATE_BREVO_SENDER_NAME=TripMate

JPA_DDL_AUTO=validate
JPA_SHOW_SQL=false
```

Do not create a public backend domain unless you specifically want a separate public API.

Flyway runs during backend startup and applies the database migrations before Hibernate validation.

## 3. Create web service

Connect the same GitHub repository and set the service root directory to:

`/web`

Railway will use `web/Dockerfile` and `web/railway.toml`.

Add this variable to the web service:

```env
BACKEND_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8080
```

Generate a public Railway domain for the **web** service.

The browser will call the Angular application's own `/api/v1` path. Nginx forwards those requests to Spring Boot through the private Railway network.

## 4. Complete frontend URL settings

After the **web** service has a generated public domain, add these variables to the backend service:

```env
APP_FRONTEND_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
APP_CORS_ALLOWED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
```

Redeploy the backend after adding them.

Invitation emails will then use the stable public web URL instead of localhost or a temporary tunnel.

## 5. Verify production

Test these flows against the public web domain:

- registration and email OTP
- login and JWT refresh
- trip creation
- invitations sent through Brevo
- invitation link opening and acceptance
- notifications
- Explore / destination discovery
- places and itinerary
- expenses
- bookings
- document upload

The backend health endpoint is:

`/api/v1/health`

The web container supports Angular SPA routes such as `/invite/:token` and proxies API/SSE traffic to the backend.

## Security notes

- Never commit Railway variables, JWT secrets, database passwords, or Brevo keys.
- Keep MySQL private.
- Keep the backend private when using the same-origin frontend proxy.
- Use Railway sealed variables for sensitive values where appropriate.
- Use a strong production JWT secret different from development.
