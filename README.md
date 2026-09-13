# TripMate

TripMate is a smart trip planning and management platform.

## Stack
- Web: Angular + TypeScript
- Mobile: Flutter
- Backend: Java + Spring Boot
- Database: MySQL
- API: REST / OpenAPI
- Authentication: JWT + Refresh Token + Email OTP verification
- Real-time: SSE
- CI/CD: GitHub Actions

## Repository Structure
```text
TripMate/
├── backend/
├── web/
├── mobile/
├── database/
├── docs/
├── docker/
└── .github/workflows/
```

## First Backend Run
1. Ensure MySQL is available and your local database settings are correct.
2. Configure local secrets in `backend/.env`. The file is ignored by Git.
3. Run `run-backend.bat` from the repository root.
4. Test `GET http://localhost:8080/api/v1/health`.

## Gmail OTP Setup

TripMate registration uses a 6-digit email OTP.

1. Enable 2-Step Verification on the Google account that will send TripMate emails.
2. Create a Google App Password for TripMate.
3. Run `setup-email.bat` from the repository root.
4. Enter the Gmail/Google Workspace email address and the 16-character App Password when prompted.
5. The script stores the values in `backend/.env`; it does not print the App Password.
6. Start the backend with `run-backend.bat`.
7. Start Angular with `cd web && npm start`.
8. Register at `http://localhost:4200/register`.

The backend returns an error if SMTP is not configured or Gmail rejects the message, so the UI will no longer falsely report that an OTP was sent.

Required local mail variables:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=yourgmail@gmail.com
MAIL_PASSWORD=your_16_character_google_app_password
MAIL_FROM=yourgmail@gmail.com
```

Never commit `backend/.env` or a real App Password.
