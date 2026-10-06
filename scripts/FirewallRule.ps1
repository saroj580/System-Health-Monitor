<#
.SYNOPSIS
    Configures Windows Defender Firewall rules for System Monitor and Task Automator.

.DESCRIPTION
    Adds, removes, or verifies Windows Defender Firewall rules for port 8003 / backend executable.
    Requires Administrator privileges. If run without elevation in interactive mode, prompts for UAC elevation.

.PARAMETER Action
    The action to perform: "Add", "Remove", or "Verify". Default is "Add".

.PARAMETER RuleName
    The display name for the firewall rule. Default: "System Monitor & Task Automator Backend"

.PARAMETER Port
    The local port number to allow (default: 8003).

.PARAMETER Protocol
    Protocol to allow: "TCP" or "UDP" (default: "TCP").

.PARAMETER ProgramPath
    Optional absolute path to the backend executable or main application executable.

.PARAMETER Direction
    Direction of traffic: "Inbound", "Outbound", or "Both" (default: "Inbound").

.EXAMPLE
    .\FirewallRule.ps1 -Action Add -Port 8003
    .\FirewallRule.ps1 -Action Remove
    .\FirewallRule.ps1 -Action Verify
#>

[CmdletBinding()]
param (
    [ValidateSet("Add", "Remove", "Verify")]
    [string]$Action = "Add",

    [string]$RuleName = "System Monitor & Task Automator Backend",
    [int]$Port = 8003,
    [ValidateSet("TCP", "UDP")]
    [string]$Protocol = "TCP",
    [string]$ProgramPath = "",
    [ValidateSet("Inbound", "Outbound", "Both")]
    [string]$Direction = "Inbound"
)

# Function to check Administrator privileges
function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Auto-elevate if not admin
if (-not (Test-IsAdmin)) {
    Write-Warning "Administrator privileges required to manage Windows Firewall."
    if ([Environment]::UserInteractive) {
        Write-Host "Requesting UAC Administrator elevation..." -ForegroundColor Cyan
        $arguments = "-ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`" -Action $Action -RuleName `"$RuleName`" -Port $Port -Protocol $Protocol -Direction $Direction"
        if ($ProgramPath) { $arguments += " -ProgramPath `"$ProgramPath`"" }
        
        try {
            Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait
            exit $LASTEXITCODE
        }
        catch {
            Write-Error "Failed to elevate process: $_"
            exit 1
        }
    } else {
        Write-Error "FirewallRule.ps1 requires administrative privileges. Please run as Administrator."
        exit 1
    }
}

Write-Host "==> [FirewallRule.ps1] Action: $Action | Rule: '$RuleName' | Port: $Port ($Protocol)" -ForegroundColor Cyan

function Add-AppFirewallRule {
    param([string]$Dir)
    
    $ruleFullName = if ($Dir -eq "Outbound") { "$RuleName (Outbound)" } else { "$RuleName (Inbound)" }
    Write-Host "Configuring $Dir firewall rule: '$ruleFullName' on port $Port ($Protocol)..." -ForegroundColor Yellow

    # Check if NetSecurity module is available
    if (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue) {
        # Clean existing rule if present
        Get-NetFirewallRule -DisplayName $ruleFullName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

        $params = @{
            DisplayName = $ruleFullName
            Direction   = $Dir
            Action      = "Allow"
            Protocol    = $Protocol
            LocalPort   = $Port
            Profile     = "Any"
            Description = "Allows API and WebSocket communication for System Monitor & Task Automator"
        }

        if ($ProgramPath -and (Test-Path $ProgramPath)) {
            $params["Program"] = $ProgramPath
        }

        New-NetFirewallRule @params | Out-Null
        Write-Host "[OK] Firewall rule '$ruleFullName' added successfully via NetSecurity." -ForegroundColor Green
    }
    else {
        # Fallback to netsh advfirewall for legacy or constrained environments
        $netshDir = if ($Dir -eq "Outbound") { "out" } else { "in" }
        $cmd = "advfirewall firewall add rule name=`"$ruleFullName`" dir=$netshDir action=allow protocol=$Protocol localport=$Port"
        if ($ProgramPath -and (Test-Path $ProgramPath)) {
            $cmd += " program=`"$ProgramPath`""
        }
        
        & netsh.exe $cmd.Split(" ") | Out-Null
        Write-Host "[OK] Firewall rule '$ruleFullName' added successfully via netsh." -ForegroundColor Green
    }
}

function Remove-AppFirewallRule {
    param([string]$Dir)
    
    $ruleFullName = if ($Dir -eq "Outbound") { "$RuleName (Outbound)" } else { "$RuleName (Inbound)" }
    Write-Host "Removing $Dir firewall rule: '$ruleFullName'..." -ForegroundColor Yellow

    if (Get-Command Remove-NetFirewallRule -ErrorAction SilentlyContinue) {
        $existing = Get-NetFirewallRule -DisplayName $ruleFullName -ErrorAction SilentlyContinue
        if ($existing) {
            $existing | Remove-NetFirewallRule -ErrorAction SilentlyContinue
            Write-Host "[OK] Removed rule '$ruleFullName' via NetSecurity." -ForegroundColor Green
        } else {
            Write-Host "[INFO] Rule '$ruleFullName' does not exist." -ForegroundColor Gray
        }
    }
    else {
        & netsh.exe advfirewall firewall delete rule name="$ruleFullName" | Out-Null
        Write-Host "[OK] Executed netsh rule removal for '$ruleFullName'." -ForegroundColor Green
    }
}

function Verify-AppFirewallRule {
    param([string]$Dir)
    
    $ruleFullName = if ($Dir -eq "Outbound") { "$RuleName (Outbound)" } else { "$RuleName (Inbound)" }
    
    if (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue) {
        $rule = Get-NetFirewallRule -DisplayName $ruleFullName -ErrorAction SilentlyContinue
        if ($rule) {
            $portFilter = $rule | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
            Write-Host "[FOUND] Rule '$ruleFullName' is active (Enabled: $($rule.Enabled), Direction: $($rule.Direction), Port: $($portFilter.LocalPort))." -ForegroundColor Green
            return $true
        } else {
            Write-Host "[MISSING] Rule '$ruleFullName' was not found." -ForegroundColor DarkYellow
            return $false
        }
    } else {
        $output = & netsh.exe advfirewall firewall show rule name="$ruleFullName"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[FOUND] Rule '$ruleFullName' confirmed via netsh." -ForegroundColor Green
            return $true
        } else {
            Write-Host "[MISSING] Rule '$ruleFullName' not found in netsh." -ForegroundColor DarkYellow
            return $false
        }
    }
}

# Execute requested action
switch ($Action) {
    "Add" {
        if ($Direction -eq "Both" -or $Direction -eq "Inbound") { Add-AppFirewallRule -Dir "Inbound" }
        if ($Direction -eq "Both" -or $Direction -eq "Outbound") { Add-AppFirewallRule -Dir "Outbound" }
    }
    "Remove" {
        Remove-AppFirewallRule -Dir "Inbound"
        Remove-AppFirewallRule -Dir "Outbound"
    }
    "Verify" {
        $inOk = Verify-AppFirewallRule -Dir "Inbound"
        $outOk = Verify-AppFirewallRule -Dir "Outbound"
        if (-not ($inOk -or $outOk)) {
            exit 2 # Non-zero indicating missing rules
        }
    }
}

Write-Host "==> [FirewallRule.ps1] Complete.`n" -ForegroundColor Cyan
exit 0
