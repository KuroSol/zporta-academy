# AI Core System - Quick Setup Script

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "AI CORE SYSTEM - SETUP WIZARD" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Add ai_core to INSTALLED_APPS" -ForegroundColor White
Write-Host "  2. Run migrations" -ForegroundColor White
Write-Host "  3. Populate AI provider configs" -ForegroundColor White
Write-Host "  4. Verify setup`n" -ForegroundColor White

$continue = Read-Host "Continue? (Y/N)"
if ($continue -ne "Y" -and $continue -ne "y") {
    Write-Host "Setup cancelled." -ForegroundColor Red
    exit
}

# Step 1: Check if ai_core is in INSTALLED_APPS
Write-Host "`n[1/4] Checking INSTALLED_APPS..." -ForegroundColor Cyan
$settingsFile = "zporta_academy_backend\settings\base.py"

if (Test-Path $settingsFile) {
    $content = Get-Content $settingsFile -Raw
    if ($content -match "'ai_core'") {
        Write-Host "  ✓ ai_core already in INSTALLED_APPS" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠️  ai_core NOT in INSTALLED_APPS" -ForegroundColor Yellow
        Write-Host "  Please add 'ai_core' to INSTALLED_APPS in $settingsFile" -ForegroundColor Yellow
        Write-Host "  Example:" -ForegroundColor Gray
        Write-Host "    INSTALLED_APPS = [" -ForegroundColor Gray
        Write-Host "        # ... existing apps ..." -ForegroundColor Gray
        Write-Host "        'dailycast'," -ForegroundColor Gray
        Write-Host "        'ai_core',  # <-- Add this line" -ForegroundColor Gray
        Write-Host "    ]" -ForegroundColor Gray
        
        $addNow = Read-Host "`nAdd it now automatically? (Y/N)"
        if ($addNow -eq "Y" -or $addNow -eq "y") {
            # Backup first
            Copy-Item $settingsFile "$settingsFile.backup" -Force
            Write-Host "  ✓ Backup created: $settingsFile.backup" -ForegroundColor Green
            
            # Add ai_core after dailycast
            $content = $content -replace "('dailycast',)", "`$1`n    'ai_core',"
            Set-Content $settingsFile $content
            Write-Host "  ✓ Added ai_core to INSTALLED_APPS" -ForegroundColor Green
        }
        else {
            Write-Host "  Please add manually and run this script again." -ForegroundColor Red
            exit
        }
    }
}
else {
    Write-Host "  ✗ Could not find $settingsFile" -ForegroundColor Red
    exit
}

# Step 2: Run migrations
Write-Host "`n[2/4] Running migrations..." -ForegroundColor Cyan
cd zporta_academy_backend

# Activate virtual environment
if (Test-Path "env\Scripts\Activate.ps1") {
    Write-Host "  Activating virtual environment..." -ForegroundColor Gray
    & ".\env\Scripts\Activate.ps1"
}
else {
    Write-Host "  ⚠️  Virtual environment not found, continuing anyway..." -ForegroundColor Yellow
}

Write-Host "  Creating migrations..." -ForegroundColor Gray
python manage.py makemigrations ai_core

Write-Host "  Applying migrations..." -ForegroundColor Gray
python manage.py migrate ai_core

Write-Host "  ✓ Migrations complete" -ForegroundColor Green

# Step 3: Populate provider configs
Write-Host "`n[3/4] Populating AI provider configurations..." -ForegroundColor Cyan
python manage.py setup_ai_providers

# Step 4: Verify
Write-Host "`n[4/4] Verifying setup..." -ForegroundColor Cyan

# Check if models are accessible
$checkCmd = @"
from ai_core.models import AiProviderConfig, AiMemory, AiUsageLog
print('✓ Models imported successfully')
print(f'✓ Provider configs: {AiProviderConfig.objects.count()}')
print(f'✓ Memory cache: {AiMemory.objects.count()}')
print(f'✓ Usage logs: {AiUsageLog.objects.count()}')
"@

Write-Host "  Checking models..." -ForegroundColor Gray
python -c $checkCmd

Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ AI CORE SYSTEM SETUP COMPLETE!                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Start Django: python manage.py runserver" -ForegroundColor White
Write-Host "  2. Visit Admin: http://localhost:8000/admin/ai_core/" -ForegroundColor White
Write-Host "  3. Check AI Provider Configs (should see 11 entries)" -ForegroundColor White
Write-Host "  4. Test AI generation:" -ForegroundColor White
Write-Host "     from ai_core.services import generate_text" -ForegroundColor Gray
Write-Host "     result, provider = generate_text(" -ForegroundColor Gray
Write-Host "         request_type='test'," -ForegroundColor Gray
Write-Host "         prompt='Hello AI!'" -ForegroundColor Gray
Write-Host "     )" -ForegroundColor Gray
Write-Host "`n  📖 Full Guide: AI_CORE_IMPLEMENTATION_GUIDE.md`n" -ForegroundColor Yellow
