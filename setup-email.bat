@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-email.ps1"
if errorlevel 1 (
    echo.
    echo Email setup failed.
    exit /b 1
)
echo.
echo Email setup completed.
