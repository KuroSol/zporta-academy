@echo off
echo ================================================
echo  Next.js Complete Clean Build
echo ================================================
echo.

cd /d "C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend"

echo [Step 1] Stopping Next.js...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

echo [Step 2] Removing build cache...
if exist .next (
    rmdir /s /q .next
    echo   - Removed .next folder
)
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo   - Removed node cache
)

echo [Step 3] Building Next.js application...
echo This will take 1-2 minutes. Please wait...
echo.

call npm run build

if errorlevel 1 (
    echo.
    echo ERROR: Build failed! Check the errors above.
    pause
    exit /b 1
)

echo.
echo [Step 4] Starting development server...
echo.
echo Starting Next.js on http://localhost:3000
echo Backend should be running on http://localhost:8001
echo.
echo Press Ctrl+C to stop the server
echo ================================================
echo.

npm run start
