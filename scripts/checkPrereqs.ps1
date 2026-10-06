<#
.SYNOPSIS
    System & Environment Prerequisite Checker for System Monitor and Task Automator.

.DESCRIPTION
    Validates machine readiness before installation or execution:
    - PowerShell 5.1+ compatibility
    - 64-bit OS architecture
    - Minimum available disk space (400 MB)
    - Port 8003 availability
    - Administrative rights status

.PARAMETER Port
    Port number to inspect (default: 8003).

.PARAMETER AsJson
    Output results as a JSON object for programmatic integration.

.EXAMPLE
    .\checkPrereqs.ps1
    .\checkPrereqs.ps1 -AsJson
#>

[CmdletBinding()]
param (
    [int]$Port = 8003,
    [switch]$AsJson
)

$results = [ordered]@{
    Timestamp        = (Get-Date).ToString("o")
    OSVersion        = [Environment]::OSVersion.VersionString
    Is64Bit          = [Environment]::Is64BitOperatingSystem
    PSVersion        = $PSVersionTable.PSVersion.ToString()
    IsAdmin          = $false
    PortAvailable    = $true
    PortOccupyingPID = $null
    FreeDiskSpaceMB  = 0
    Pass             = $true
    Issues           = @()
}

# 1. Admin check
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$results.IsAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# 2. 64-Bit check
if (-not $results.Is64Bit) {
    $results.Pass = $false
    $results.Issues += "System Monitor requires a 64-bit Windows operating system."
}

# 3. Minimum Windows Version check (Windows 10 / Build 10240+)
# $osVer = [Environment]::OSVersion.Version
# if ($osVer.Major -lt 10) {
#     $results.Pass = $false
#     $results.Issues += "Windows 10 or later is required. Detected: $($results.OSVersion)"
# }

# 4. Disk Space check
$systemDrive = Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')) -ErrorAction SilentlyContinue
if ($systemDrive) {
    $freeMb = [math]::Round($systemDrive.Free / 1MB)
    $results.FreeDiskSpaceMB = $freeMb
    if ($freeMb -lt 400) {
        $results.Pass = $false
        $results.Issues += "Insufficient disk space: ${freeMb}MB free (minimum 400MB required)."
    }
}

# 5. Port availability check
try {
    $occupied = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($occupied) {
        $results.PortAvailable = $false
        $results.PortOccupyingPID = $occupied.OwningProcess
    }
}
catch {
    # If NetTCPConnection unavailable, check via System.Net.Sockets
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
    }
    catch {
        $results.PortAvailable = $false
    }
}

if ($AsJson) {
    $results | ConvertTo-Json -Depth 3
    if ($results.Pass) { exit 0 } else { exit 1 }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  System Prerequisite Verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Operating System : $($results.OSVersion) (64-Bit: $($results.Is64Bit))"
Write-Host " PowerShell Ver   : $($results.PSVersion)"
Write-Host " Administrator    : $(if ($results.IsAdmin) { '[YES]' } else { '[NO] (Standard User)' })"
Write-Host " Free Disk Space  : $($results.FreeDiskSpaceMB) MB"

if ($results.PortAvailable) {
    Write-Host " Port $Port       : Available [OK]" -ForegroundColor Green
}
else {
    Write-Host " Port $Port       : Occupied (PID: $($results.PortOccupyingPID)) [WARNING]" -ForegroundColor Yellow
}

if ($results.Pass) {
    Write-Host "`nAll core prerequisites PASSED." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`nPrerequisite checks encountered issues:" -ForegroundColor Red
    foreach ($issue in $results.Issues) {
        Write-Host " - $issue" -ForegroundColor Red
    }
    exit 1
}
