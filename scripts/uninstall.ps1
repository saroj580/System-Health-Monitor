<#
.SYNOPSIS
    Master Uninstallation Entrypoint for System Monitor and Task Automator.

.DESCRIPTION
    Invoked when removing the application either manually or via Windows Add/Remove Programs.
    Calls uninstallService.ps1 to stop all services, clean registry, remove firewall rules,
    delete shortcuts, and purge files.

.PARAMETER Silent
    Run in non-interactive silent mode without prompting.

.PARAMETER KeepUserData
    Preserve SQLite database and user settings.

.EXAMPLE
    .\uninstall.ps1
    .\uninstall.ps1 -Silent
    .\uninstall.ps1 -KeepUserData
#>

[CmdletBinding()]
param (
    [switch]$Silent,
    [switch]$KeepUserData
)

$ScriptsDir = $PSScriptRoot
$uninstallService = Join-Path $ScriptsDir "uninstallService.ps1"

if (-not (Test-Path $uninstallService)) {
    Write-Error "uninstallService.ps1 not found in: $ScriptsDir"
    exit 1
}

$params = @{}
if ($Silent) { $params["Silent"] = $true }
if ($KeepUserData) { $params["KeepUserData"] = $true }

& powershell.exe -ExecutionPolicy Bypass -NoProfile -File $uninstallService @params
exit $LASTEXITCODE
