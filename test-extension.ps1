#!/usr/bin/env pwsh
# API Helper Extension - Comprehensive Test Script
# This script helps verify that the extension is working correctly

Write-Host "🚀 API Helper Extension - Comprehensive Test" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the extension root directory" -ForegroundColor Red
    exit 1
}

# Check if extension is compiled
Write-Host "📦 Checking extension compilation..." -ForegroundColor Yellow
if (-not (Test-Path "dist/extension.js")) {
    Write-Host "⚠️  Extension not compiled. Running compilation..." -ForegroundColor Yellow
    npm run compile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Compilation failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Extension compiled successfully" -ForegroundColor Green
}

# Check sample schemas
Write-Host "📄 Checking sample schemas..." -ForegroundColor Yellow
$schemas = @(
    "sample-schemas/petstore-api.json",
    "sample-schemas/weather-api.yaml"
)

foreach ($schema in $schemas) {
    if (Test-Path $schema) {
        $size = (Get-Item $schema).Length
        if ($size -gt 0) {
            Write-Host "✅ $schema (${size} bytes)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $schema is empty" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ $schema missing" -ForegroundColor Red
    }
}

# Check if VSIX package exists
Write-Host "📦 Checking VSIX package..." -ForegroundColor Yellow
$vsixFiles = Get-ChildItem -Name "*.vsix"
if ($vsixFiles.Count -gt 0) {
    Write-Host "✅ VSIX package found: $($vsixFiles[0])" -ForegroundColor Green
} else {
    Write-Host "⚠️  VSIX package not found. Creating one..." -ForegroundColor Yellow
    try {
        npx @vscode/vsce package
        Write-Host "✅ VSIX package created successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create VSIX package" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Testing Instructions:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. 🔧 Debug Mode Testing (Recommended):" -ForegroundColor White
Write-Host "   - Open VS Code in this directory: code ." -ForegroundColor Gray
Write-Host "   - Press F5 to launch Extension Development Host" -ForegroundColor Gray
Write-Host "   - Look for 'API Environments' in Explorer panel" -ForegroundColor Gray
Write-Host ""

Write-Host "2. 📦 Package Installation Testing:" -ForegroundColor White
Write-Host "   - Install VSIX: code --install-extension api-helper-extension-*.vsix" -ForegroundColor Gray
Write-Host "   - Reload VS Code window" -ForegroundColor Gray
Write-Host ""

Write-Host "3. 🧪 Functional Testing:" -ForegroundColor White
Write-Host "   Open Command Palette (Ctrl+Shift+P) and test these commands:" -ForegroundColor Gray
Write-Host "   - API Helper: Add Environment" -ForegroundColor Gray
Write-Host "   - API Helper: Load Schema from URL" -ForegroundColor Gray
Write-Host "   - API Helper: Load Schema from File" -ForegroundColor Gray
Write-Host "   - API Helper: List Environments" -ForegroundColor Gray
Write-Host ""

Write-Host "4. 🌐 Test with Sample Data:" -ForegroundColor White
Write-Host "   Environment: Swagger Petstore" -ForegroundColor Gray
Write-Host "   Base URL: https://petstore.swagger.io/v2" -ForegroundColor Gray
Write-Host "   Schema URL: https://petstore.swagger.io/v2/swagger.json" -ForegroundColor Gray
Write-Host "   Auth: None" -ForegroundColor Gray
Write-Host ""

Write-Host "5. 🏗️ Tree View Testing:" -ForegroundColor White
Write-Host "   - Check Explorer panel for 'API Environments'" -ForegroundColor Gray
Write-Host "   - Expand environment nodes" -ForegroundColor Gray
Write-Host "   - Click on endpoints to see details" -ForegroundColor Gray
Write-Host "   - Right-click for context menus" -ForegroundColor Gray
Write-Host ""

Write-Host "6. ⚙️ Settings Testing:" -ForegroundColor White
Write-Host "   - Go to File > Preferences > Settings" -ForegroundColor Gray
Write-Host "   - Search for 'API Helper'" -ForegroundColor Gray
Write-Host "   - Verify extension settings are available" -ForegroundColor Gray
Write-Host ""

Write-Host "🔍 Expected Results:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "✅ Tree view shows 'API Environments' in Explorer" -ForegroundColor Green
Write-Host "✅ Commands appear in Command Palette" -ForegroundColor Green
Write-Host "✅ Can add environments and load schemas" -ForegroundColor Green
Write-Host "✅ Endpoints grouped by tags in tree view" -ForegroundColor Green
Write-Host "✅ Click handlers show endpoint details" -ForegroundColor Green
Write-Host "✅ Settings panel shows extension configuration" -ForegroundColor Green
Write-Host ""

Write-Host "🚨 Troubleshooting:" -ForegroundColor Red
Write-Host "==================" -ForegroundColor Red
Write-Host "❌ Tree view not visible: Check Explorer panel, look for 'API Environments'" -ForegroundColor Yellow
Write-Host "❌ Commands not found: Ensure extension is activated" -ForegroundColor Yellow
Write-Host "❌ Schema loading fails: Check URL accessibility and format" -ForegroundColor Yellow
Write-Host "❌ No endpoints shown: Verify schema has valid paths" -ForegroundColor Yellow
Write-Host ""

Write-Host "📊 Extension Status: READY FOR TESTING" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
