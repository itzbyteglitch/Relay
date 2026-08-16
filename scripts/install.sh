#!/bin/sh
# Relay installer — macOS/Linux (POSIX sh)
# Usage: curl -fsSL https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/install.sh | sh

set -eu

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_ORG="itzbyteglitch"
REPO_NAME="relay"
INSTALL_DIR="${HOME}/.local/bin"
UV_VERSION_MIN="0.5.0"

# Dry-run support
DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
fi

# Helpers
step() {
    printf "${BLUE}==>${NC} %s\n" "$1"
}

warn() {
    printf "${YELLOW}WARNING:${NC} %s\n" "$1"
}

error() {
    printf "${RED}ERROR:${NC} %s\n" "$1"
    exit 1
}

success() {
    printf "${GREEN}✓${NC} %s\n" "$1"
}

run() {
    if [ "$DRY_RUN" = true ]; then
        printf "  [dry-run] %s\n" "$*"
    else
        eval "$@"
    fi
}

# Check if command exists
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Add to PATH for this script
add_to_path() {
    case ":$PATH:" in
        *":$1:"*) ;;
        *) export PATH="$1:$PATH" ;;
    esac
}

# Get uv install directory
get_uv_bin_dir() {
    if [ -d "$HOME/.cargo/bin" ]; then
        echo "$HOME/.cargo/bin"
    elif [ -d "$HOME/.local/bin" ]; then
        echo "$HOME/.local/bin"
    elif [ -n "${XDG_BIN_HOME:-}" ]; then
        echo "$XDG_BIN_HOME"
    else
        echo "$HOME/.local/bin"
    fi
}

# --- Step 1: Install uv ---
step "Checking for uv..."
UV_BIN_DIR=$(get_uv_bin_dir)
add_to_path "$UV_BIN_DIR"

if ! has_cmd uv; then
    step "Installing uv..."
    run "curl -LsSf https://astral.sh/uv/install.sh | sh"
    add_to_path "$UV_BIN_DIR"
    if ! has_cmd uv; then
        error "uv installation failed — not found in PATH after install"
    fi
    success "uv installed"
else
    step "uv found, updating..."
    if uv self update 2>/dev/null; then
        success "uv updated via self-update"
    elif has_cmd brew && brew list uv >/dev/null 2>&1; then
        run "brew upgrade uv"
        success "uv upgraded via Homebrew"
    elif has_cmd pipx && pipx list | grep -q uv; then
        run "pipx upgrade uv"
        success "uv upgraded via pipx"
    else
        warn "Could not auto-update uv; continuing with existing version"
    fi
fi

# Verify uv version meets minimum
UV_VERSION=$(uv --version 2>/dev/null | cut -d' ' -f2 || echo "0.0.0")
step "uv version: $UV_VERSION"

# --- Step 2: Install Claude Code ---
step "Checking for Claude Code..."
if ! has_cmd claude; then
    step "Installing Claude Code..."
    if ! has_cmd npm; then
        error "npm not found — please install Node.js first (https://nodejs.org/)"
    fi
    run "npm install -g @anthropic-ai/claude-code"
    if ! has_cmd claude; then
        error "Claude Code installation failed — not found in PATH after install"
    fi
    success "Claude Code installed"
else
    success "Claude Code found"
fi

# --- Step 3: Install Relay CLI ---
step "Installing Relay CLI..."
run "uv tool install --force relay-cli"
success "Relay CLI installed/updated"

# --- Done ---
echo
printf "${GREEN}Installation complete!${NC}\n"
echo
echo "Next step: run ${BLUE}relay setup${NC} to configure your device."
echo
echo "For updates, simply re-run this installer."