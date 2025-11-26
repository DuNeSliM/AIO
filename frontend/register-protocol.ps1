# Register aio:// protocol for AIO Game Library
# Run this script to register the protocol

param(
    [switch]$Dev
)

# Try to find the executable (check both debug and release)
# The executable name has spaces: "AIO Game Library.exe"
$debugPath = "$PSScriptRoot\src-tauri\target\debug\AIO Game Library.exe"
$releasePath = "$PSScriptRoot\src-tauri\target\release\AIO Game Library.exe"

if ($Dev) {
    Write-Host "Registering for DEVELOPMENT mode" -ForegroundColor Yellow
    $appPath = $debugPath
    # If debug doesn't exist, try release
    if (-not (Test-Path $appPath)) {
        if (Test-Path $releasePath) {
            Write-Host "Debug build not found, using release build instead" -ForegroundColor Yellow
            $appPath = $releasePath
        }
    }
} else {
    Write-Host "Registering for RELEASE mode" -ForegroundColor Green
    $appPath = $releasePath
    # If release doesn't exist, try debug
    if (-not (Test-Path $appPath)) {
        if (Test-Path $debugPath) {
            Write-Host "Release build not found, using debug build instead" -ForegroundColor Yellow
            $appPath = $debugPath
        }
    }
}

# Check if executable exists
if (-not (Test-Path $appPath)) {
    Write-Host "ERROR: Executable not found!" -ForegroundColor Red
    Write-Host "Checked locations:" -ForegroundColor Yellow
    Write-Host "  - $debugPath" -ForegroundColor Gray
    Write-Host "  - $releasePath" -ForegroundColor Gray
    Write-Host "`nBuild the app first with: npm run tauri build (or dev)" -ForegroundColor Yellow
    exit 1
}

# Create registry entries for aio:// protocol
$registryPath = "HKCU:\Software\Classes\aio"

Write-Host "Creating registry entries..." -ForegroundColor Cyan

# Create main protocol key
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(Default)" -Value "URL:AIO Protocol"
Set-ItemProperty -Path $registryPath -Name "URL Protocol" -Value ""

# Create command key
New-Item -Path "$registryPath\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$registryPath\shell\open\command" -Name "(Default)" -Value "`"$appPath`" `"%1`""

Write-Host "`nProtocol registered successfully!" -ForegroundColor Green
Write-Host "App path: $appPath" -ForegroundColor Gray
Write-Host "`nTest with: start aio://auth-callback?token=test&store=steam" -ForegroundColor Yellow
Write-Host "This should open your AIO app!`n" -ForegroundColor Cyan
