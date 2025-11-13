# PowerShell script to run Django development server
# Usage: .\run_server.ps1

Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& .\env\Scripts\Activate.ps1

Write-Host "`nChecking Django configuration..." -ForegroundColor Cyan
python manage.py check

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Starting Django Development Server..." -ForegroundColor Green
    Write-Host "Server will be available at: http://127.0.0.1:8000" -ForegroundColor Yellow
    Write-Host "Press CTRL+C to stop the server" -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Green
    
    python manage.py runserver
} else {
    Write-Host "`nERROR: Django check failed!" -ForegroundColor Red
    Write-Host "Please fix the errors above before starting the server." -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
