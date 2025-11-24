# Search and Report Hardcoded API URLs in Frontend
# Run this script from the backend directory

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Searching for Hardcoded API URLs in Frontend  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$frontendPath = "C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend"

if (-not (Test-Path $frontendPath)) {
    Write-Host "`nERROR: Frontend directory not found at:" -ForegroundColor Red
    Write-Host $frontendPath -ForegroundColor Yellow
    exit 1
}

Write-Host "`nSearching in: $frontendPath" -ForegroundColor Green
Write-Host "`nLooking for patterns:" -ForegroundColor Yellow
Write-Host "  - localhost:8000" -ForegroundColor Gray
Write-Host "  - 127.0.0.1:8000" -ForegroundColor Gray
Write-Host "  - http://localhost:8000" -ForegroundColor Gray
Write-Host ""

$patterns = @(
    "localhost:8000",
    "127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
)

$foundFiles = @()

foreach ($pattern in $patterns) {
    Write-Host "Searching for: $pattern" -ForegroundColor Cyan
    
    $matches = Get-ChildItem -Path $frontendPath -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.json -ErrorAction SilentlyContinue |
        Select-String -Pattern $pattern -SimpleMatch |
        Group-Object Path |
        Select-Object Name, Count
    
    if ($matches) {
        $foundFiles += $matches
        foreach ($match in $matches) {
            Write-Host "  FOUND in:" -ForegroundColor Yellow -NoNewline
            Write-Host " $($match.Name)" -ForegroundColor White
            Write-Host "    Occurrences: $($match.Count)" -ForegroundColor Gray
        }
    }
}

if ($foundFiles.Count -gt 0) {
    Write-Host "`n==================================================" -ForegroundColor Yellow
    Write-Host "  ACTION REQUIRED" -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Yellow
    Write-Host "`nFound hardcoded API URLs in $($foundFiles.Count) file(s)." -ForegroundColor Yellow
    Write-Host "`nPlease update these files to use environment variables:" -ForegroundColor White
    Write-Host "  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';" -ForegroundColor Cyan
} else {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "  SUCCESS" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "`nNo hardcoded localhost:8000 URLs found!" -ForegroundColor Green
    Write-Host "Your frontend is ready to use port 8001." -ForegroundColor Green
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "`n1. Copy .env.local.example to your frontend directory:" -ForegroundColor White
Write-Host "   cd ..\zporta_academy_frontend\next-frontend" -ForegroundColor Gray
Write-Host "   Copy-Item ..\..\zporta_academy_backend\.env.local.example .\.env.local" -ForegroundColor Gray

Write-Host "`n2. Restart your Next.js dev server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray

Write-Host "`n3. Start Django backend on port 8001:" -ForegroundColor White
Write-Host "   cd ..\..\zporta_academy_backend" -ForegroundColor Gray
Write-Host "   .\run_server.ps1" -ForegroundColor Gray

Write-Host ""
