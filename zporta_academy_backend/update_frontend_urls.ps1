# Automatic URL Replacement Script
# This script updates hardcoded 127.0.0.1:8000 to use environment variables

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Updating Frontend API URLs" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$frontendPath = "C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend"

if (-not (Test-Path $frontendPath)) {
    Write-Host "`nERROR: Frontend directory not found!" -ForegroundColor Red
    exit 1
}

# Step 1: Create .env.local file
Write-Host "`n[Step 1] Creating .env.local file..." -ForegroundColor Yellow

$envLocalContent = @"
# Local Development API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api

# Backend URLs (if used)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_DJANGO_URL=http://localhost:8001

# WebSocket (if used)
NEXT_PUBLIC_WS_URL=ws://localhost:8001
"@

$envLocalPath = Join-Path $frontendPath ".env.local"

if (Test-Path $envLocalPath) {
    Write-Host "  .env.local already exists. Creating backup..." -ForegroundColor Gray
    Copy-Item $envLocalPath "$envLocalPath.backup"
}

Set-Content -Path $envLocalPath -Value $envLocalContent -Encoding UTF8
Write-Host "  Created: $envLocalPath" -ForegroundColor Green

# Step 2: Create .env.production file
Write-Host "`n[Step 2] Creating .env.production file..." -ForegroundColor Yellow

$envProdContent = @"
# Production API Configuration
NEXT_PUBLIC_API_URL=https://zportaacademy.com
NEXT_PUBLIC_API_BASE_URL=https://zportaacademy.com/api

# Backend URLs
NEXT_PUBLIC_BACKEND_URL=https://zportaacademy.com
NEXT_PUBLIC_DJANGO_URL=https://zportaacademy.com

# WebSocket (if used)
NEXT_PUBLIC_WS_URL=wss://zportaacademy.com
"@

$envProdPath = Join-Path $frontendPath ".env.production"
Set-Content -Path $envProdPath -Value $envProdContent -Encoding UTF8
Write-Host "  Created: $envProdPath" -ForegroundColor Green

# Step 3: Find and update source files
Write-Host "`n[Step 3] Updating source files..." -ForegroundColor Yellow

$srcPath = Join-Path $frontendPath "src"
$filesToUpdate = @(
    "src\pages\courses\[username]\[date]\[subject]\[slug]\index.js",
    "src\pages\lessons\[username]\[subject]\[date]\[lessonSlug]\index.js",
    "src\pages\quizzes\[username]\[subject]\[date]\[slug]\index.js"
)

$updatedCount = 0

foreach ($relPath in $filesToUpdate) {
    $filePath = Join-Path $frontendPath $relPath
    
    if (Test-Path $filePath) {
        Write-Host "  Processing: $relPath" -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        $originalContent = $content
        
        # Replace hardcoded URLs with environment variable
        $content = $content -replace 'http://127\.0\.0\.1:8000', '${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}'
        $content = $content -replace "'http://127\.0\.0\.1:8000'", "(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001')"
        $content = $content -replace '"http://127\.0\.0\.1:8000"', '(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001")'
        $content = $content -replace '`http://127\.0\.0\.1:8000`', '(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001")'
        
        if ($content -ne $originalContent) {
            # Create backup
            Copy-Item $filePath "$filePath.backup"
            
            # Save updated content
            Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
            Write-Host "    Updated (backup created)" -ForegroundColor Green
            $updatedCount++
        } else {
            Write-Host "    - No changes needed" -ForegroundColor Gray
        }
    } else {
        Write-Host "    ! File not found: $relPath" -ForegroundColor Yellow
    }
}

# Step 4: Delete Next.js build cache
Write-Host "`n[Step 4] Clearing Next.js build cache..." -ForegroundColor Yellow

$nextPath = Join-Path $frontendPath ".next"
if (Test-Path $nextPath) {
    try {
        Remove-Item -Path $nextPath -Recurse -Force -ErrorAction Stop
        Write-Host "  Deleted .next folder (will be rebuilt on next start)" -ForegroundColor Green
    } catch {
        Write-Host "  ! Could not delete .next folder (Next.js might be running)" -ForegroundColor Yellow
        Write-Host "    Please stop Next.js and delete it manually" -ForegroundColor Gray
    }
} else {
    Write-Host "  - No .next folder found (already clean)" -ForegroundColor Gray
}

# Summary
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  UPDATE COMPLETE!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

Write-Host "`nSummary:" -ForegroundColor White
Write-Host "  Environment files created: 2" -ForegroundColor Gray
Write-Host "  Source files updated: $updatedCount" -ForegroundColor Gray
Write-Host "  Backups created: $updatedCount" -ForegroundColor Gray

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`n1. Start Django backend on port 8001:" -ForegroundColor White
Write-Host "   .\run_server.ps1" -ForegroundColor Gray

Write-Host "`n2. Start Next.js frontend (in new terminal):" -ForegroundColor White
Write-Host "   cd ..\zporta_academy_frontend\next-frontend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray

Write-Host "`n3. Test in browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Gray

Write-Host "`n4. Verify API connection:" -ForegroundColor White
Write-Host "   Check browser console for API calls to localhost:8001" -ForegroundColor Gray

Write-Host ""
