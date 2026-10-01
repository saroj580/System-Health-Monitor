<#
.SYNOPSIS
    Creates Windows Desktop, Start Menu, and Startup shortcuts for System Monitor and Task Automator.

.DESCRIPTION
    Uses the Windows Script Host (WScript.Shell) COM object to reliably create .lnk shortcuts
    with target paths, icons, hotkeys, and working directories.

.PARAMETER AppName
    The display name of the application (e.g., "System Monitor and Task Automator").

.PARAMETER TargetExePath
    The absolute path to the main application executable (e.g., "C:\Program Files\...\System Monitor.exe").

.PARAMETER WorkingDirectory
    The working directory for the application. If omitted, uses the folder containing TargetExePath.

.PARAMETER IconPath
    Path to an icon file (.ico) or executable containing the icon resource. Defaults to TargetExePath.

.PARAMETER Description
    Tooltip description displayed when hovering over the shortcut.

.PARAMETER CreateDesktop
    Create shortcut on the Desktop. Default is $true.

.PARAMETER CreateStartMenu
    Create Start Menu program folder and shortcut. Default is $true.

.PARAMETER CreateUninstallShortcut
    Create an uninstallation shortcut in the Start Menu folder. Default is $true.

.PARAMETER UninstallScriptPath
    Path to the uninstaller script or executable (e.g., uninstall.ps1).

.PARAMETER AddToStartup
    Create a shortcut in the Windows Startup folder so it boots with Windows. Default is $false.

.PARAMETER AllUsers
    If specified, creates shortcuts for All Users (Public Desktop & Common Start Menu). Requires Admin.

.EXAMPLE
    .\shortcutCreator.ps1 -TargetExePath "C:\Users\User\AppData\Local\Programs\System Monitor\System Monitor.exe"
#>

[CmdletBinding()]
param (
    [string]$AppName = "System Monitor and Task Automator",
    
    [Parameter(Mandatory = $true)]
    [string]$TargetExePath,

    [string]$WorkingDirectory = "",
    [string]$IconPath = "",
    [string]$Description = "Real-time system monitoring, hardware telemetry, and automated task management.",

    [bool]$CreateDesktop = $true,
    [bool]$CreateStartMenu = $true,
    [bool]$CreateUninstallShortcut = $true,
    [string]$UninstallScriptPath = "",
    [switch]$AddToStartup,
    [switch]$AllUsers
)

$ErrorActionPreference = "Stop"

Write-Host "==> [shortcutCreator.ps1] Configuring shortcuts for: $AppName" -ForegroundColor Cyan

# Validate target executable
if (-not (Test-Path $TargetExePath)) {
    Write-Error "Target executable does not exist at: $TargetExePath"
    exit 1
}

# Resolve working directory
if (-not $WorkingDirectory) {
    $WorkingDirectory = Split-Path -Path $TargetExePath -Parent
}

# Resolve icon path
if (-not $IconPath) {
    $IconPath = $TargetExePath
}

# Initialize WScript.Shell COM Object
$WshShell = New-Object -ComObject WScript.Shell

# Determine Special Folder Paths
if ($AllUsers) {
    $DesktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory)
    $StartMenuDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::CommonPrograms)) $AppName
    $StartupDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonStartup)
} else {
    $DesktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
    $StartMenuDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::Programs)) $AppName
    $StartupDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
}

function New-WindowsShortcut {
    param (
        [string]$ShortcutPath,
        [string]$Target,
        [string]$Arguments = "",
        [string]$WorkDir,
        [string]$Icon,
        [string]$Comment
    )

    $parent = Split-Path -Path $ShortcutPath -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $Target
    if ($Arguments) { $shortcut.Arguments = $Arguments }
    $shortcut.WorkingDirectory = $WorkDir
    $shortcut.IconLocation = $Icon
    $shortcut.Description = $Comment
    $shortcut.Save()

    Write-Host " [OK] Created shortcut: $ShortcutPath" -ForegroundColor Green
}

# 1. Desktop Shortcut
if ($CreateDesktop) {
    $desktopShortcutPath = Join-Path $DesktopDir "$AppName.lnk"
    New-WindowsShortcut -ShortcutPath $desktopShortcutPath `
                         -Target $TargetExePath `
                         -WorkDir $WorkingDirectory `
                         -Icon $IconPath `
                         -Comment $Description
}

# 2. Start Menu Folder & App Shortcut
if ($CreateStartMenu) {
    if (-not (Test-Path $StartMenuDir)) {
        New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
    }

    $startShortcutPath = Join-Path $StartMenuDir "$AppName.lnk"
    New-WindowsShortcut -ShortcutPath $startShortcutPath `
                         -Target $TargetExePath `
                         -WorkDir $WorkingDirectory `
                         -Icon $IconPath `
                         -Comment $Description

    # Uninstaller shortcut in Start Menu
    if ($CreateUninstallShortcut) {
        $uninstallLnk = Join-Path $StartMenuDir "Uninstall $AppName.lnk"
        
        if ($UninstallScriptPath -and (Test-Path $UninstallScriptPath)) {
            if ($UninstallScriptPath.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
                # Launch PowerShell with bypass policy for the uninstall script
                $psExe = (Get-Process -Id $PID).Path
                if (-not $psExe) { $psExe = "powershell.exe" }
                
                New-WindowsShortcut -ShortcutPath $uninstallLnk `
                                     -Target $psExe `
                                     -Arguments "-ExecutionPolicy Bypass -NoProfile -File `"$UninstallScriptPath`"" `
                                     -WorkDir (Split-Path -Path $UninstallScriptPath -Parent) `
                                     -Icon "$env:SystemRoot\System32\shell32.dll,238" `
                                     -Comment "Uninstall $AppName"
            } else {
                New-WindowsShortcut -ShortcutPath $uninstallLnk `
                                     -Target $UninstallScriptPath `
                                     -WorkDir (Split-Path -Path $UninstallScriptPath -Parent) `
                                     -Icon $UninstallScriptPath `
                                     -Comment "Uninstall $AppName"
            }
        }
    }
}

# 3. Startup Folder Shortcut (Optional)
if ($AddToStartup) {
    $startupShortcutPath = Join-Path $StartupDir "$AppName.lnk"
    New-WindowsShortcut -ShortcutPath $startupShortcutPath `
                         -Target $TargetExePath `
                         -WorkDir $WorkingDirectory `
                         -Icon $IconPath `
                         -Comment "$AppName Background Agent"
}

# Clean COM object
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($WshShell) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host "==> [shortcutCreator.ps1] All shortcuts generated successfully.`n" -ForegroundColor Cyan
