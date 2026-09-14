# TripMate

TripMate is a smart trip planning and management platform.

## Stack
- Web: Angular + TypeScript
- Mobile: Flutter
- Backend: Java + Spring Boot
- Database: MySQL
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
BREVO_SENDER_EMAIL=verified_sender@example.com
BREVO_SENDER_NAME=TripMate
```

Never commit `backend/.env` or a real Brevo API key.


## Google Sign-In Setup

TripMate uses Google Identity Services on the Angular login page and verifies the Google ID token on the Spring Boot backend.

One-time local setup:
1. In Google Cloud / Google Auth Platform, create an OAuth 2.0 Client ID with application type **Web application**.
2. Add `http://localhost:4200` as an **Authorized JavaScript origin**.
3. Copy `backend/.env.example` to `backend/.env` if needed.
4. Set the public Web Client ID:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   ```
5. Restart the Spring Boot backend and Angular web app.
6. Open `http://localhost:4200/login` and use **Sign in with Google**.

The Google client secret is not required for this flow. The browser receives a Google ID token and the backend validates its signature, expiry, issuer, audience, verified email, and Google account subject before issuing TripMate access and refresh tokens.
