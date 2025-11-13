@echo off
REM Activate virtual environment and run Django development server
REM Usage: Just double-click this file or run it from command prompt

cd /d %~dp0
echo Activating virtual environment...
call env\Scripts\activate.bat

echo.
echo Checking Django configuration...
python manage.py check

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Starting Django Development Server...
    echo Server will be available at: http://127.0.0.1:8000
    echo Press CTRL+C to stop the server
    echo ========================================
    echo.
    python manage.py runserver
) else (
    echo.
    echo ERROR: Django check failed!
    echo Please fix the errors above before starting the server.
    pause
)
