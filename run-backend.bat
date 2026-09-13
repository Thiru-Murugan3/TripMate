@echo off
setlocal
echo Checking for existing process on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Killing PID %%a on port 8080...
    taskkill /PID %%a /F >nul 2>&1
)

cd /d "%~dp0backend"

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

echo.
echo Transactional email provider: Brevo
echo Sender: %BREVO_SENDER_EMAIL%
echo Starting TripMate Backend...
mvn spring-boot:run
