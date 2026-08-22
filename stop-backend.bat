@echo off
echo Stopping any process on port 8080...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo   Killing PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)
echo Done.
