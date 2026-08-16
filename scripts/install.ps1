<#
.SYNOPSIS
    Relay installer — Windows PowerShell
.DESCRIPTION
    Installs uv, Claude Code, and Relay CLI.
    Usage: & ([scriptblock]::Create((irm "https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/install.ps1")))
#>

[CmdletBinding()]
param(
    [switch]$DryRun
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

function Invoke-Run {
    param([string]$Command)
    if ($DryRun) {
        Write-Host "  [dry-run] $Command" -ForegroundColor $Yellow
    } else {
        try {
            Invoke-Expression $Command
        } catch {
            Write-ErrorMsg "Command failed: $Command`n$_"
        }
    }
}

function Test-Command {
    param([string]$Name)
    return (Get-Command $Name -ErrorAction SilentlyContinue) -ne $null
}

function Add-ToPath {
    param([string]$Path)
    if ($env:Path -notlike "*$Path*") {
        $env:Path = "$Path;$env:Path"
    }
}

function Get-UvBinDir {
    $candidates = @(
        "$env:USERPROFILE\.cargo\bin",
        "$env:USERPROFILE\.local\bin",
        $env:XDG_BIN_HOME
    )
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path $dir)) { return $dir }
    }
    return "$env:USERPROFILE\.local\bin"
}

# --- Step 1: Install uv ---
Write-Step "Checking for uv..."
$uvBinDir = Get-UvBinDir
Add-ToPath $uvBinDir

if (-not (Test-Command "uv")) {
    Write-Step "Installing uv..."
    Invoke-Run "irm https://astral.sh/uv/install.ps1 | iex"
    Add-ToPath $uvBinDir
    if (-not (Test-Command "uv")) {
        Write-ErrorMsg "uv installation failed — not found in PATH after install"
    }
    Write-Success "uv installed"
} else {
    Write-Step "uv found, updating..."
    $updated = $false
    try {
        Invoke-Run "uv self update"
        $updated = $true
    } catch { }
    if (-not $updated -and (Test-Command "winget")) {
        try {
            Invoke-Run "winget upgrade --id Astral.uv"
            $updated = $true
        } catch { }
    }
    if (-not $updated -and (Test-Command "choco")) {
        try {
            Invoke-Run "choco upgrade uv"
            $updated = $true
        } catch { }
    }
    if (-not $updated) {
        Write-Warn "Could not auto-update uv; continuing with existing version"
    } else {
        Write-Success "uv updated"
    }
}

$uvVersion = (uv --version 2>$null).Split(' ')[1]
Write-Step "uv version: $uvVersion"

# --- Step 2: Install Claude Code ---
Write-Step "Checking for Claude Code..."
if (-not (Test-Command "claude")) {
    Write-Step "Installing Claude Code..."
    if (-not (Test-Command "npm")) {
        Write-ErrorMsg "npm not found — please install Node.js first (https://nodejs.org/)"
    }
    Invoke-Run "npm install -g @anthropic-ai/claude-code"
    if (-not (Test-Command "claude")) {
        Write-ErrorMsg "Claude Code installation failed — not found in PATH after install"
    }
    Write-Success "Claude Code installed"
} else {
    Write-Success "Claude Code found"
}

# --- Step 3: Install Relay CLI ---
Write-Step "Installing Relay CLI..."
$tempDir = [System.IO.Path]::GetTempPath() + "relay-install-" + [Guid]::NewGuid()
Invoke-Run "git clone --depth 1 https://github.com/itzbyteglitch/relay.git $tempDir"
Invoke-Run "uv tool install --force $tempDir\client"
Invoke-Run "Remove-Item -Recurse -Force $tempDir"
Write-Success "Relay CLI installed/updated"

# --- Done ---
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor $Green
Write-Host ""
Write-Host "Next step: run relay setup to configure your device."
Write-Host "For updates, simply re-run this installer."