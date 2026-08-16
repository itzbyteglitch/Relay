#!/bin/sh
# Relay uninstaller — macOS/Linux (POSIX sh)
# Usage: curl -fsSL https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/uninstall.sh | sh
#        curl -fsSL https://raw.githubusercontent.com/itzbyteglitch/relay/main/scripts/uninstall.sh | sh -s -- --yes

set -eu

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

YES=false
if [ "${1:-}" = "--yes" ] || [ "${1:-}" = "-y" ]; then
    YES=true
fi

step() { printf "${BLUE}==>${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}WARNING:${NC} %s\n" "$1"; }
error() { printf "${RED}ERROR:${NC} %s\n" "$1"; exit 1; }
success() { printf "${GREEN}✓${NC} %s\n" "$1"; }

RELAY_DIR="${HOME}/.relay"

# What will be removed
step "The following will be removed:"
echo "  • relay-cli (via uv tool uninstall)"
echo "  • ${RELAY_DIR}/ (config directory)"
echo
echo "The following will NOT be touched:"
echo "  • uv (and its packages)"
echo "  • Python"
echo "  • Claude Code"
echo "  • Any other system tools"
echo

# Confirm
if [ "$YES" = false ]; then
    printf "Continue? [y/N] "
    read -r REPLY
    case "$REPLY" in
        [yY][eE][sS]|[yY]) ;;
        *) echo "Aborted."; exit 0 ;;
    esac
fi

# Uninstall relay-cli
step "Uninstalling relay-cli..."
if command -v uv >/dev/null 2>&1; then
    if uv tool uninstall relay-cli 2>/dev/null; then
        success "relay-cli uninstalled"
    else
        warn "relay-cli was not installed (or already removed)"
    fi
else
    warn "uv not found — skipping relay-cli uninstall"
fi

# Remove config directory
step "Removing config directory..."
if [ -d "$RELAY_DIR" ]; then
    rm -rf "$RELAY_DIR"
    success "Removed ${RELAY_DIR}"
else
    success "Config directory ${RELAY_DIR} already removed"
fi

echo
success "Uninstall complete — Relay removed."