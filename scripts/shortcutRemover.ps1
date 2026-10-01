<#
.SYNOPSIS
    Removes Desktop, Start Menu, and Startup shortcuts for System Monitor and Task Automator.

.DESCRIPTION
    Safely locates and removes all .lnk shortcuts and application Start Menu directories created
    during installation. Inspects both Current User and All Users/Public locations.

.PARAMETER AppName
    The name of the application whose shortcuts should be removed (default: "System Monitor and Task Automator").

.PARAMETER CleanAllUsers
    Checks and removes shortcuts from Public/AllUsers folders in addition to the current user profile. Default is $true.

.EXAMPLE
    .\shortcutRemover.ps1
    .\shortcutRemover.ps1 -AppName "System Monitor and Task Automator"
#>

[CmdletBinding()]
param (
    [string]$AppName = "System Monitor and Task Automator",
    [bool]$CleanAllUsers = $true
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==> [shortcutRemover.ps1] Cleaning shortcuts for: $AppName" -ForegroundColor Cyan

$targets = @()

# Current User Paths
$userDesktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
$userPrograms = [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs)
$userStartup = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)

$targets += Join-Path $userDesktop "$AppName.lnk"
$targets += Join-Path $userPrograms "$AppName\$AppName.lnk"
$targets += Join-Path $userPrograms "$AppName\Uninstall $AppName.lnk"
$targets += Join-Path $userPrograms "$AppName" # directory
$targets += Join-Path $userStartup "$AppName.lnk"

# All Users / Public Paths
if ($CleanAllUsers) {
    $commonDesktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory)
    $commonPrograms = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonPrograms)
    $commonStartup = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonStartup)

    $targets += Join-Path $commonDesktop "$AppName.lnk"
    $targets += Join-Path $commonPrograms "$AppName\$AppName.lnk"
    $targets += Join-Path $commonPrograms "$AppName\Uninstall $AppName.lnk"
    $targets += Join-Path $commonPrograms "$AppName" # directory
    $targets += Join-Path $commonStartup "$AppName.lnk"
}

foreach ($target in $targets) {
    if (Test-Path $target) {
        try {
            Remove-Item -Path $target -Recurse -Force -ErrorAction Stop
            Write-Host " [REMOVED] $target" -ForegroundColor Green
        }
        catch {
            Write-Warning "Could not delete $target : $_"
        }
    }
}

Write-Host "==> [shortcutRemover.ps1] Shortcut cleanup finished.`n" -ForegroundColor Cyan
