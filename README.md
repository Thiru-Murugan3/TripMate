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


## Invitation links on another device

For local testing on another phone or computer connected to the same Wi-Fi, run:

    start-network.bat

TripMate will detect the PC LAN IP, configure the invitation URL and backend CORS, then start the backend and Angular for network access.

For public internet users, deploy TripMate to a public HTTPS frontend URL and set `APP_FRONTEND_URL` / `APP_CORS_ALLOWED_ORIGINS` accordingly. See `DEPLOYMENT.md`.


## Public invitation testing

For invitation links that must open from another network or device, use:

    start-public.bat

This starts TripMate with a temporary public HTTPS development URL. Send a new invitation only after the script reports that public mode is ready. See `DEPLOYMENT.md` for details.
