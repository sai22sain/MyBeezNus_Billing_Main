@echo off
echo ========================================
echo Building MyBeezNus Business Billing Application
echo ========================================
echo.

echo Building Frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo Error building frontend
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Starting Production Server...
cd ..\backend
call node server.production.js

pause
