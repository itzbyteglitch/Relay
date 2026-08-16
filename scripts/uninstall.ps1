<#
.SYNOPSIS
    Relay uninstaller — Windows PowerShell
.DESCRIPTION
    Removes relay-cli and ~/.relay config directory.
    Usage: & ([scriptblock]::Create((irm "https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/uninstall.ps1")))
    Usage with auto-confirm: & ([scriptblock]::Create((irm "https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/uninstall.ps1"))) -Yes
#>

[CmdletBinding()]
param(
    [switch]$Yes
)

# Colors
$Red = [ConsoleColor]::Red
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Cyan = [ConsoleColor]::Cyan
$Reset = [ConsoleColor]::Reset

function Write-Step { param([string]$Msg) Write-Host "==> $Msg" -ForegroundColor $Cyan }
function Write-Warn { param([string]$Msg) Write-Host "WARNING: $Msg" -ForegroundColor $Yellow }
function Write-ErrorMsg { param([string]$Msg) Write-Host "ERROR: $Msg" -ForegroundColor $Red; exit 1 }
function Write-Success { param([string]$Msg) Write-Host "✓ $Msg" -ForegroundColor $Green }

$RELAY_DIR = Join-Path $env:USERPROFILE ".relay"

# What will be removed
Write-Step "The following will be removed:"
Write-Host "  • relay-cli (via uv tool uninstall)"
Write-Host "  • $RELAY_DIR (config directory)"
Write-Host ""
Write-Host "The following will NOT be touched:"
Write-Host "  • uv (and its packages)"
Write-Host "  • Python"
Write-Host "  • Claude Code"
Write-Host "  • Any other system tools"
Write-Host ""

# Confirm
if (-not $Yes) {
    $choice = Read-Host "Continue? [y/N]"
    if ($choice -notmatch '^[yY]') {
        Write-Host "Aborted."
        exit 0
    }
}

# Uninstall relay-cli
Write-Step "Uninstalling relay-cli..."
if (Get-Command "uv" -ErrorAction SilentlyContinue) {
    try {
        uv tool uninstall relay-cli 2>$null
        Write-Success "relay-cli uninstalled"
    } catch {
        Write-Warn "relay-cli was not installed (or already removed)"
    }
} else {
    Write-Warn "uv not found — skipping relay-cli uninstall"
}

# Remove config directory
Write-Step "Removing config directory..."
if (Test-Path $RELAY_DIR) {
    Remove-Item -Recurse -Force $RELAY_DIR
    Write-Success "Removed $RELAY_DIR"
} else {
    Write-Success "Config directory $RELAY_DIR already removed"
}

Write-Host ""
Write-Success "Uninstall complete — Relay removed."