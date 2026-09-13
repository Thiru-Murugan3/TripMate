@echo off
setlocal
echo Checking for existing process on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Killing PID %%a on port 8080...
    taskkill /PID %%a /F >nul 2>&1
)

cd /d "%~dp0backend"

rem Clear any stale inherited Brevo values before loading backend\.env
set "BREVO_API_URL="
set "BREVO_API_KEY="
set "BREVO_SENDER_EMAIL="
set "BREVO_SENDER_NAME="
set "TRIPMATE_BREVO_API_KEY="
set "TRIPMATE_BREVO_SENDER_EMAIL="
set "TRIPMATE_BREVO_SENDER_NAME="

if exist ".env" (
    echo Loading backend\.env...
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

if "%BREVO_API_KEY%"=="" (
    echo.
    echo TripMate Brevo API key is not configured.
    call "%~dp0setup-brevo.bat"
    if errorlevel 1 exit /b 1
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do if not "%%A"=="" set "%%A=%%B"
)

if "%BREVO_SENDER_EMAIL%"=="" (
    echo.
    echo TripMate Brevo sender email is not configured.
    call "%~dp0setup-brevo.bat"
    if errorlevel 1 exit /b 1
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do if not "%%A"=="" set "%%A=%%B"
)

rem Force Spring Boot to use the same validated values loaded from backend\.env
set "TRIPMATE_BREVO_API_KEY=%BREVO_API_KEY%"
set "TRIPMATE_BREVO_SENDER_EMAIL=%BREVO_SENDER_EMAIL%"
set "TRIPMATE_BREVO_SENDER_NAME=%BREVO_SENDER_NAME%"

echo.
echo Transactional email provider: Brevo
echo Sender: %TRIPMATE_BREVO_SENDER_EMAIL%
echo Starting TripMate Backend with backend\.env Brevo credentials...
mvn spring-boot:run
