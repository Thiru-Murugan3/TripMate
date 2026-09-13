@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-brevo.ps1"
if errorlevel 1 (
  echo.
  echo Brevo setup failed.
  exit /b 1
)
echo.
echo Brevo setup completed.
