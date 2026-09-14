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

rem Force Spring Boot to use only the same values loaded from backend\.env
set "TRIPMATE_BREVO_API_KEY=%BREVO_API_KEY%"
set "TRIPMATE_BREVO_SENDER_EMAIL=%BREVO_SENDER_EMAIL%"
set "TRIPMATE_BREVO_SENDER_NAME=%BREVO_SENDER_NAME%"

echo.
echo Validating the exact Brevo API key that Spring Boot will use...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { Invoke-RestMethod -Uri 'https://api.brevo.com/v3/account' -Method Get -Headers @{'api-key'=$env:TRIPMATE_BREVO_API_KEY;'accept'='application/json'} -TimeoutSec 15 | Out-Null; $sha=[Security.Cryptography.SHA256]::Create(); $bytes=[Text.Encoding]::UTF8.GetBytes($env:TRIPMATE_BREVO_API_KEY); $hash=$sha.ComputeHash($bytes); $fp=([BitConverter]::ToString($hash)).Replace('-','').ToLower().Substring(0,12); Write-Host ('Brevo preflight SUCCESS. API key fingerprint: ' + $fp) -ForegroundColor Green } catch { Write-Host 'Brevo preflight FAILED. The API key loaded from backend\.env is not accepted.' -ForegroundColor Red; if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow }; exit 1 }"
if errorlevel 1 (
    echo.
    echo Backend was NOT started because Brevo authentication failed.
    echo Run setup-brevo.bat again with the API key that succeeds in test-brevo.bat.
    exit /b 1
)

echo.
echo Transactional email provider: Brevo
echo Sender: %TRIPMATE_BREVO_SENDER_EMAIL%

echo.
echo Checking whether the known Flyway V7 history mismatch needs safe repair...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-flyway-v7.ps1"
if errorlevel 1 (
    echo.
    echo Backend was NOT started because the Flyway V7 repair guard failed.
    echo No database history was changed unless the schema matched the expected V7 structure exactly.
    exit /b 1
)

echo.
echo Starting TripMate Backend with the validated backend\.env configuration...
mvn spring-boot:run
