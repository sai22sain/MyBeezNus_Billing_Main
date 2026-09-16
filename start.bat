@echo off
echo ========================================
echo MyBeezNus Business Billing Application
echo ========================================
echo.

echo Installing Backend Dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo Error installing backend dependencies
    pause
    exit /b 1
)

echo.
echo Installing Frontend Dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo Error installing frontend dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Starting Backend Server...
cd ..\backend
start cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
cd ..\frontend
start cmd /k "npm start"

echo.
echo ========================================
echo Application is starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window...
pause >nul
