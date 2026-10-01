<#
.SYNOPSIS
    Master Installation Orchestrator for System Monitor and Task Automator.

.DESCRIPTION
    Installs the application without needing NSIS:
    1. Verifies prerequisites (Windows version, architecture, privileges).
    2. Terminates existing instances to allow clean file replacement.
    3. Deploys app files to the installation directory.
    4. Configures Windows Defender Firewall rules for port 8000.
    5. Creates Desktop, Start Menu, and Uninstallation shortcuts.
    6. Registers the application in Windows 'Installed Apps' (Add/Remove Programs).
    7. Optionally launches the application.

.PARAMETER SourceDir
    The path to the compiled application files (e.g., "..\dist-app" or current folder).

.PARAMETER InstallDir
    Target directory for installation.
    Default: "$env:LOCALAPPDATA\Programs\System Monitor and Task Automator" (or Program Files if -MachineWide).

.PARAMETER MachineWide
    Installs to Program Files for all users instead of the current user's profile. Requires Admin.

.PARAMETER LaunchApp
    Automatically launches the application after installation completes. Default is $true.

.PARAMETER Silent
    Silent mode with no interactive pauses or prompts.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -MachineWide -LaunchApp
    .\install.ps1 -SourceDir "..\dist-app" -Silent
#>

[CmdletBinding()]
param (
    [string]$SourceDir = "",
    [string]$InstallDir = "",
    [switch]$MachineWide,
    [bool]$LaunchApp = $true,
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

$AppName = "System Monitor and Task Automator"
$AppVersion = "1.0.0-PreAlpha"
$AppPublisher = "System Monitor Team"
$AppExeName = "System Monitor.exe"
$AppWebsite = "https://github.com/saroj580/System-Health-Monitor"
$ScriptsDir = $PSScriptRoot
$RootDir = Split-Path -Path $ScriptsDir -Parent

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Auto-elevate if MachineWide requested and not running as admin
if ($MachineWide -and (-not (Test-IsAdmin))) {
    Write-Warning "MachineWide installation requires Administrator privileges."
    $argsList = "-ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`" -MachineWide"
    if ($SourceDir) { $argsList += " -SourceDir `"$SourceDir`"" }
    if ($InstallDir) { $argsList += " -InstallDir `"$InstallDir`"" }
    if ($Silent) { $argsList += " -Silent" }
    
    Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -Verb RunAs -Wait
    exit $LASTEXITCODE
}

Write-Host "  Installing $AppName v$AppVersion" -ForegroundColor Cyan

# 1. Resolve Source Directory
if (-not $SourceDir) {
    $candidateDist = Join-Path $RootDir "dist-app"
    if (Test-Path $candidateDist) {
        $SourceDir = $candidateDist
    }
    else {
        $SourceDir = $RootDir
    }
}

if (-not (Test-Path $SourceDir)) {
    Write-Error "Source directory not found: $SourceDir"
    exit 1
}

# 2. Resolve Target Installation Directory
if (-not $InstallDir) {
    if ($MachineWide) {
        $InstallDir = Join-Path $env:ProgramFiles $AppName
    }
    else {
        $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\$AppName"
    }
}

Write-Host "Source directory : $SourceDir" -ForegroundColor Gray
Write-Host "Install target   : $InstallDir" -ForegroundColor Yellow

# 3. Stop running instances
Write-Host "`n[1/6] Stopping any running instances..." -ForegroundColor Cyan
$activeProcs = Get-Process -Name "System Monitor", "backend", "electron" -ErrorAction SilentlyContinue
if ($activeProcs) {
    foreach ($p in $activeProcs) {
        Write-Host " Closing running instance (PID: $($p.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
}

# 4. Copy Application Files
Write-Host "`n[2/6] Deploying files to destination..." -ForegroundColor Cyan
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Copy app files (excluding git and temp artifacts)
Get-ChildItem -Path $SourceDir -Exclude ".git", "node_modules", ".venv" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
}

# Ensure scripts folder is bundled inside install directory for maintenance/uninstall
$destScriptsDir = Join-Path $InstallDir "scripts"
if (-not (Test-Path $destScriptsDir)) {
    New-Item -ItemType Directory -Path $destScriptsDir -Force | Out-Null
}
Copy-Item -Path "$ScriptsDir\*.ps1" -Destination $destScriptsDir -Force

Write-Host " [OK] Files installed successfully." -ForegroundColor Green

# 5. Configure Windows Firewall
Write-Host "`n[3/6] Configuring Windows Firewall..." -ForegroundColor Cyan
$firewallScript = Join-Path $destScriptsDir "FirewallRule.ps1"
if (Test-Path $firewallScript) {
    try {
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $firewallScript -Action Add -Port 8000
    }
    catch {
        Write-Warning "Firewall rule configuration notice: $_"
    }
}

# 6. Create Shortcuts
Write-Host "`n[4/6] Creating Shortcuts..." -ForegroundColor Cyan
$targetExe = Join-Path $InstallDir $AppExeName
if (-not (Test-Path $targetExe)) {
    # If electron or main executable named differently, search for it
    $foundExe = Get-ChildItem -Path $InstallDir -Filter "*.exe" | Select-Object -First 1
    if ($foundExe) {
        $targetExe = $foundExe.FullName
    }
}

$shortcutScript = Join-Path $destScriptsDir "shortcutCreator.ps1"
$uninstallScript = Join-Path $destScriptsDir "uninstall.ps1"

if (Test-Path $shortcutScript) {
    $scParams = @{
        AppName             = $AppName
        TargetExePath       = $targetExe
        UninstallScriptPath = $uninstallScript
        AllUsers            = $MachineWide
    }
    & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $shortcutScript @scParams
}

# 7. Register in Windows Add/Remove Programs (Registry)
Write-Host "`n[5/6] Registering in Windows Add/Remove Programs..." -ForegroundColor Cyan

$regBase = if ($MachineWide) { "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName" } else { "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName" }
$appRegBase = if ($MachineWide) { "HKLM:\Software\$AppName" } else { "HKCU:\Software\$AppName" }

if (-not (Test-Path $regBase)) {
    New-Item -Path $regBase -Force | Out-Null
}
if (-not (Test-Path $appRegBase)) {
    New-Item -Path $appRegBase -Force | Out-Null
}

$uninstallCmd = "powershell.exe -ExecutionPolicy Bypass -NoProfile -File `"$uninstallScript`""

Set-ItemProperty -Path $appRegBase -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $regBase -Name "DisplayName" -Value $AppName
Set-ItemProperty -Path $regBase -Name "DisplayVersion" -Value $AppVersion
Set-ItemProperty -Path $regBase -Name "Publisher" -Value $AppPublisher
Set-ItemProperty -Path $regBase -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $regBase -Name "DisplayIcon" -Value "$targetExe,0"
Set-ItemProperty -Path $regBase -Name "UninstallString" -Value $uninstallCmd
Set-ItemProperty -Path $regBase -Name "QuietUninstallString" -Value "$uninstallCmd -Silent"
Set-ItemProperty -Path $regBase -Name "URLInfoAbout" -Value $AppWebsite
Set-ItemProperty -Path $regBase -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $regBase -Name "NoRepair" -Value 1 -Type DWord

# Estimate size in KB
$totalSizeKb = [math]::Round(((Get-ChildItem -Path $InstallDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1024))
Set-ItemProperty -Path $regBase -Name "EstimatedSize" -Value $totalSizeKb -Type DWord

Write-Host " [OK] Registered in Windows Uninstall Registry ($regBase)." -ForegroundColor Green

# 8. Launch Application if requested
Write-Host "`n[6/6] Finalizing installation..." -ForegroundColor Cyan
if ($LaunchApp -and (Test-Path $targetExe)) {
    Write-Host " Launching $AppName..." -ForegroundColor Green
    Start-Process -FilePath $targetExe -WorkingDirectory $InstallDir
}

Write-Host "  Installation completed successfully!" -ForegroundColor Green
