<#
.SYNOPSIS
    Deep uninstallation and cleanup service for System Monitor and Task Automator.

.DESCRIPTION
    Performs full teardown of the application:
    1. Kills active application and background processes (System Monitor.exe, backend.exe, port 8000 listeners).
    2. Stops and unregisters any background Windows Services or Scheduled Tasks.
    3. Removes Windows Firewall rules for port 8000.
    4. Purges Start Menu, Desktop, and Startup shortcuts.
    5. Cleans Windows Registry entries (Add/Remove Programs, application state).
    6. Removes the installed program files and directory.

.PARAMETER AppName
    The name of the application (default: "System Monitor and Task Automator").

.PARAMETER InstallDir
    The installation directory path to clean up.

.PARAMETER KeepUserData
    If specified, preserves local user data (SQLite database, custom configurations, license cache).

.PARAMETER Silent
    Suppresses interactive confirmation prompts.

.EXAMPLE
    .\uninstallService.ps1 -Silent
    .\uninstallService.ps1 -KeepUserData
#>

[CmdletBinding()]
param (
    [string]$AppName = "System Monitor and Task Automator",
    [string]$InstallDir = "",
    [switch]$KeepUserData,
    [switch]$Silent
)

# Test Administrator privileges
function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "================================================================" -ForegroundColor Red
Write-Host "  $AppName - Uninstallation & Cleanup Service" -ForegroundColor Red
Write-Host "================================================================" -ForegroundColor Red

# Resolve InstallDir if not provided
if (-not $InstallDir) {
    # Check HKCU uninstall registry
    $regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
    if (Test-Path $regKey) {
        $InstallDir = (Get-ItemProperty -Path $regKey -Name "InstallLocation" -ErrorAction SilentlyContinue).InstallLocation
    }
    
    if (-not $InstallDir) {
        # Check HKLM
        $regKeyLM = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
        if (Test-Path $regKeyLM) {
            $InstallDir = (Get-ItemProperty -Path $regKeyLM -Name "InstallLocation" -ErrorAction SilentlyContinue).InstallLocation
        }
    }

    if (-not $InstallDir) {
        # Fallback to standard LOCALAPPDATA path
        $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\$AppName"
    }
}

Write-Host "Target Installation Directory: $InstallDir" -ForegroundColor Yellow

if (-not $Silent) {
    $title = "Confirm Uninstallation"
    $message = "Are you sure you want to permanently remove $AppName and its components from your system?"
    $yes = New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Uninstall the application."
    $no = New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Cancel uninstallation."
    $options = [System.Management.Automation.Host.ChoiceDescription[]]($yes, $no)
    $result = $host.ui.PromptForChoice($title, $message, $options, 1)
    if ($result -ne 0) {
        Write-Host "Uninstallation aborted by user." -ForegroundColor Yellow
        exit 0
    }
}

# ---------------------------------------------------------
# STEP 1: Terminate Running Application Processes
# ---------------------------------------------------------
Write-Host "`n[1/6] Stopping active application processes..." -ForegroundColor Cyan

$processNames = @("System Monitor", "backend", "electron")
foreach ($procName in $processNames) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($p in $procs) {
            try {
                Write-Host " Terminating process: $($p.Name) (PID: $($p.Id))..." -ForegroundColor Yellow
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Warning "Failed to stop process $($p.Id): $_"
            }
        }
    }
}

# Check for lingering processes listening on port 8000
try {
    $portListeners = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($portListeners) {
        foreach ($pidToKill in $portListeners) {
            if ($pidToKill -gt 0) {
                Write-Host " Freeing port 8000 (Killing PID: $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {
    # Ignore if NetTCPConnection is unsupported on older OS
}

# ---------------------------------------------------------
# STEP 2: Stop and Unregister Services or Scheduled Tasks
# ---------------------------------------------------------
Write-Host "`n[2/6] Checking for registered Windows Services or Scheduled Tasks..." -ForegroundColor Cyan

$serviceName = "SystemMonitorAgent"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host " Stopping Windows Service '$serviceName'..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $serviceName | Out-Null
    Write-Host " [OK] Removed Windows Service '$serviceName'." -ForegroundColor Green
}

$taskName = "SystemMonitorStartup"
$scheduledTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($scheduledTask) {
    Write-Host " Unregistering Scheduled Task '$taskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host " [OK] Removed Scheduled Task '$taskName'." -ForegroundColor Green
}

# ---------------------------------------------------------
# STEP 3: Remove Windows Firewall Rules
# ---------------------------------------------------------
Write-Host "`n[3/6] Removing Windows Defender Firewall rules..." -ForegroundColor Cyan
$scriptsDir = $PSScriptRoot
$firewallScript = Join-Path $scriptsDir "FirewallRule.ps1"
if (Test-Path $firewallScript) {
    try {
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $firewallScript -Action Remove -Port 8000
    } catch {
        Write-Warning "Could not run FirewallRule.ps1 directly: $_"
    }
} else {
    # Fallback inline removal
    if (Get-Command Remove-NetFirewallRule -ErrorAction SilentlyContinue) {
        Get-NetFirewallRule -DisplayName "*System Monitor & Task Automator*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    } else {
        & netsh.exe advfirewall firewall delete rule name="System Monitor & Task Automator Backend (Inbound)" | Out-Null
        & netsh.exe advfirewall firewall delete rule name="System Monitor & Task Automator Backend (Outbound)" | Out-Null
    }
    Write-Host " [OK] Firewall rules cleaned up." -ForegroundColor Green
}

# ---------------------------------------------------------
# STEP 4: Remove Shortcuts
# ---------------------------------------------------------
Write-Host "`n[4/6] Removing application shortcuts..." -ForegroundColor Cyan
$removerScript = Join-Path $scriptsDir "shortcutRemover.ps1"
if (Test-Path $removerScript) {
    & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $removerScript -AppName $AppName
} else {
    # Fallback shortcut cleanup
    $desktops = @(
        [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory),
        [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory)
    )
    foreach ($d in $desktops) {
        $f = Join-Path $d "$AppName.lnk"
        if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
    }
    $programs = @(
        [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs),
        [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonPrograms)
    )
    foreach ($p in $programs) {
        $folder = Join-Path $p $AppName
        if (Test-Path $folder) { Remove-Item $folder -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Write-Host " [OK] Shortcuts removed." -ForegroundColor Green
}

# ---------------------------------------------------------
# STEP 5: Clean Registry Settings
# ---------------------------------------------------------
Write-Host "`n[5/6] Cleaning Windows Registry entries..." -ForegroundColor Cyan

$regKeysToClean = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName",
    "HKCU:\Software\$AppName",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName",
    "HKLM:\Software\$AppName"
)

foreach ($key in $regKeysToClean) {
    if (Test-Path $key) {
        try {
            Remove-Item -Path $key -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host " [REMOVED REGISTRY] $key" -ForegroundColor Green
        } catch {
            Write-Warning "Could not delete registry key $key : $_"
        }
    }
}

# ---------------------------------------------------------
# STEP 6: Remove Installation Directory
# ---------------------------------------------------------
Write-Host "`n[6/6] Purging installed files..." -ForegroundColor Cyan

if ($InstallDir -and (Test-Path $InstallDir)) {
    if ($KeepUserData) {
        Write-Host " Preserving user data and database files..." -ForegroundColor Yellow
        $items = Get-ChildItem -Path $InstallDir -Exclude "*.db", "*.sqlite", "license*", "config.json"
        foreach ($item in $items) {
            Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Host " [OK] Application binaries removed. User data retained in: $InstallDir" -ForegroundColor Green
    } else {
        # If uninstall script is running from inside InstallDir, schedule a self-delete cmd job
        $currentScriptPath = $MyInvocation.MyCommand.Path
        $isInsideInstallDir = $currentScriptPath -and $currentScriptPath.StartsWith($InstallDir, [System.StringComparison]::OrdinalIgnoreCase)

        if ($isInsideInstallDir) {
            Write-Host " Scheduling post-exit directory purge..." -ForegroundColor Yellow
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c timeout /t 2 /nobreak > nul & rmdir /s /q `"$InstallDir`"" -WindowStyle Hidden
            Write-Host " [OK] Background folder removal scheduled." -ForegroundColor Green
        } else {
            try {
                Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction Stop
                Write-Host " [OK] Successfully removed directory: $InstallDir" -ForegroundColor Green
            } catch {
                # Fallback to cmd rmdir
                & cmd.exe /c "rmdir /s /q `"$InstallDir`"" | Out-Null
                Write-Host " [OK] Folder purge executed." -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host " [INFO] Installation directory does not exist or was already removed." -ForegroundColor Gray
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  Uninstallation Complete!" -ForegroundColor Green
Write-Host "================================================================`n" -ForegroundColor Green
