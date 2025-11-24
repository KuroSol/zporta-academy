# Restart Development Servers
# This script helps restart both Django and Next.js cleanly

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Zporta Academy - Development Server Restart" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Step 1: Stop any running servers
Write-Host "`n[Step 1] Stopping existing servers..." -ForegroundColor Yellow

$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*manage.py*runserver*" }
if ($pythonProcesses) {
    Write-Host "  Stopping Django server..." -ForegroundColor Gray
    $pythonProcesses | Stop-Process -Force
    Write-Host "  Django stopped" -ForegroundColor Green
} else {
    Write-Host "  No Django server running" -ForegroundColor Gray
}

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*dev*" }
if ($nodeProcesses) {
    Write-Host "  Stopping Next.js server..." -ForegroundColor Gray
    $nodeProcesses | Stop-Process -Force
    Write-Host "  Next.js stopped" -ForegroundColor Green
} else {
    Write-Host "  No Next.js server running" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Step 2: Clear Next.js cache
Write-Host "`n[Step 2] Clearing Next.js cache..." -ForegroundColor Yellow

$nextPath = "C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend\.next"
if (Test-Path $nextPath) {
    Remove-Item $nextPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Next.js cache cleared" -ForegroundColor Green
} else {
    Write-Host "  Cache already clean" -ForegroundColor Gray
}

# Step 3: Instructions
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Servers Stopped - Ready to Restart" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor White

Write-Host "`n1. Start Django Backend (Port 8001):" -ForegroundColor Yellow
Write-Host "   cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend" -ForegroundColor Gray
Write-Host "   .\run_server.ps1" -ForegroundColor Cyan

Write-Host "`n2. Start Next.js Frontend (Port 3000) - In NEW Terminal:" -ForegroundColor Yellow
Write-Host "   cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Cyan

Write-Host "`n3. Access Your App:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor Cyan

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Tip: Keep both terminal windows open!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
