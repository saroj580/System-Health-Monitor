# build.ps1 — Automated compilation orchestrator for System Monitor & Task Automator
# Powershell script to build Backend (PyInstaller), Frontend (Vite/TS), Electron bundle, and NSIS Installer.

param (
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend\react-ts"
$DistAppDir = Join-Path $RootDir "dist-app"
$DistInstallerDir = Join-Path $RootDir "dist-installer"

Write-Host "  System Monitor & Task Automator - Build Pipeline" -ForegroundColor Cyan

# 1. Clean / prepare output directories
Write-Host "`n[1/4] Preparing directories..." -ForegroundColor Yellow
if (-not (Test-Path $DistAppDir)) {
    New-Item -ItemType Directory -Path $DistAppDir -Force | Out-Null
}
if (-not (Test-Path $DistInstallerDir)) {
    New-Item -ItemType Directory -Path $DistInstallerDir -Force | Out-Null
}

# 2. Build Python backend with PyInstaller
if (-not $SkipBackend) {
    Write-Host "`n[2/4] Building Backend with PyInstaller..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        # Check requirements
        pip install -r requirements.txt --quiet
        
        # Compile standalone backend.exe
        pyinstaller --noconfirm `
            --onedir `
            --windowed `
            --name "backend" `
            --add-data "app;app" `
            --hidden-import "uvicorn" `
            --hidden-import "fastapi" `
            --hidden-import "psutil" `
            --hidden-import "cryptography" `
            --hidden-import "jwt" `
            run.py
        
        Write-Host "Backend built successfully: backend/dist/backend/" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "`n[2/4] Skipping Backend build (--SkipBackend set)" -ForegroundColor Gray
}

# 3. Build Frontend with Vite + TypeScript
if (-not $SkipFrontend) {
    Write-Host "`n[3/4] Building Frontend (React + TypeScript + Tailwind)..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm run build
        Write-Host "Frontend built successfully: frontend/react-ts/dist/" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "`n[3/4] Skipping Frontend build (--SkipFrontend set)" -ForegroundColor Gray
}

# Assemble distribution package
Write-Host "`n[*] Assembling application bundle into dist-app..." -ForegroundColor Yellow
$BackendSource = Join-Path $BackendDir "dist\backend"
$BackendDest = Join-Path $DistAppDir "resources\backend"
if (Test-Path $BackendSource) {
    if (-not (Test-Path $BackendDest)) {
        New-Item -ItemType Directory -Path $BackendDest -Force | Out-Null
    }
    Copy-Item -Path "$BackendSource\*" -Destination $BackendDest -Recurse -Force
}

$FrontendDist = Join-Path $FrontendDir "dist"
$FrontendDest = Join-Path $DistAppDir "dist"
if (Test-Path $FrontendDist) {
    if (-not (Test-Path $FrontendDest)) {
        New-Item -ItemType Directory -Path $FrontendDest -Force | Out-Null
    }
    Copy-Item -Path "$FrontendDist\*" -Destination $FrontendDest -Recurse -Force
}

$ElectronSource = Join-Path $FrontendDir "electron"
$ElectronDest = Join-Path $DistAppDir "electron"
if (Test-Path $ElectronSource) {
    if (-not (Test-Path $ElectronDest)) {
        New-Item -ItemType Directory -Path $ElectronDest -Force | Out-Null
    }
    Copy-Item -Path "$ElectronSource\*" -Destination $ElectronDest -Recurse -Force
}

$ScriptsSource = Join-Path $RootDir "scripts"
$ScriptsDest = Join-Path $DistAppDir "scripts"
if (Test-Path $ScriptsSource) {
    if (-not (Test-Path $ScriptsDest)) {
        New-Item -ItemType Directory -Path $ScriptsDest -Force | Out-Null
    }
    Copy-Item -Path "$ScriptsSource\*" -Destination $ScriptsDest -Recurse -Force
}

# 4. Compile NSIS installer
if (-not $SkipInstaller) {
    Write-Host "`n[4/4] Compiling NSIS Installer..." -ForegroundColor Yellow
    $Makensis = Get-Command "makensis" -ErrorAction SilentlyContinue
    if ($Makensis) {
        & makensis setup.nsi
        Write-Host "Installer compiled successfully in dist-installer/" -ForegroundColor Green
    }
    else {
        Write-Host "makensis not found in PATH. Skipping installer compilation." -ForegroundColor DarkYellow
        Write-Host "To compile manually, install NSIS and run: makensis setup.nsi" -ForegroundColor DarkYellow
    }
}
else {
    Write-Host "`n[4/4] Skipping Installer compilation (--SkipInstaller set)" -ForegroundColor Gray
}
Write-Host "  Build Pipeline Complete!" -ForegroundColor Green
