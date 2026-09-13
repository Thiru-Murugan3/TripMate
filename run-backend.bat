@echo off
setlocal
echo Checking for existing process on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Killing PID %%a on port 8080...
    taskkill /PID %%a /F >nul 2>&1
)

cd /d "%~dp0backend"

if not exist ".env" (
    echo.
    echo TripMate email configuration was not found.
    echo Starting guided Gmail OTP setup...
    echo.
    call "%~dp0setup-email.bat"
    if errorlevel 1 exit /b 1
)

if exist ".env" (
    echo Loading backend\.env...
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

if "%MAIL_USERNAME%"=="" (
    echo.
    echo MAIL_USERNAME is missing. Running email setup...
    call "%~dp0setup-email.bat"
    if errorlevel 1 exit /b 1
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

if "%MAIL_PASSWORD%"=="" (
    echo.
    echo MAIL_PASSWORD is missing. Running email setup...
    call "%~dp0setup-email.bat"
    if errorlevel 1 exit /b 1
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

echo.
echo SMTP account: %MAIL_USERNAME%
echo Starting TripMate Backend...
mvn spring-boot:run
