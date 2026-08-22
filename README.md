# TripMate

TripMate is a smart trip planning and management platform.

## Stack
- Web: Angular + TypeScript
- Mobile: Ionic + Angular + Capacitor
- Backend: Java + Spring Boot
- Database: MySQL
- API: REST / OpenAPI
- Authentication: JWT + Refresh Token
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
1. Ensure MySQL database `tripmate` and your validated tables exist.
2. Set DB credentials in `backend/src/main/resources/application.yml` or environment variables.
3. Run `mvn spring-boot:run` inside `backend`.
4. Test `GET http://localhost:8080/api/v1/health`.

Next milestone: Register -> Login -> JWT -> Refresh Token -> Current User -> Create Trip -> Get My Trips.
