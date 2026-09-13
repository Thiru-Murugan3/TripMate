@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-brevo.ps1"
if errorlevel 1 (
  echo.
  echo Brevo test failed.
  exit /b 1
)
echo.
echo Brevo test completed.
