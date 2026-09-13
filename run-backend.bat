@echo off
setlocal
echo Checking for existing process on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Killing PID %%a on port 8080...
    taskkill /PID %%a /F >nul 2>&1
)

cd /d "%~dp0backend"

if exist ".env" (
    echo Loading backend.env...
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
) else (
    echo WARNING: backend.env was not found.
    echo Copy backend.env.example to backend.env and configure DB, JWT, and MAIL values.
)

echo Starting TripMate Backend...
mvn spring-boot:run
