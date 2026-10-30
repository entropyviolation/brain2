#!/usr/bin/env bash
# Sets up an always-on Mac to run Brain2: Homebrew tools, local Ollama models,
# a production build, and launchd jobs that restart on crash and start at login.
#
#   bash deploy/mac/install-always-on.sh [--dry-run] [--skip-models] [--skip-build] [--no-backup] [--uninstall]
#
# Safe to re-run: each step checks what is already there.
# No ActivityWatch here: screen activity is tracked on the Mac you use, not this server.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
BACKUP_DIR="${BRAIN2_BACKUP_DIR:-$HOME/Brain2Backups}"
MODELS=(qwen2.5:14b-instruct qwen2.5:3b-instruct nomic-embed-text)
JOBS=(web hub awake)

DRY=0 SKIP_MODELS=0 SKIP_BUILD=0 BACKUP=1 UNINSTALL=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --skip-models) SKIP_MODELS=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --no-backup) BACKUP=0 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

log() { printf '[always-on] %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then printf '[dry-run] %s\n' "$*"; else "$@"; fi; }

[ "$(uname)" = Darwin ] || { echo "macOS only" >&2; exit 1; }
[ "$BACKUP" = 1 ] && JOBS+=(backup)
UID_DOMAIN="gui/$(id -u)"

unload() {
  local label="com.brain2.$1"
  launchctl print "$UID_DOMAIN/$label" >/dev/null 2>&1 && run launchctl bootout "$UID_DOMAIN/$label" || true
}

if [ "$UNINSTALL" = 1 ]; then
  for j in web hub awake backup; do
    unload "$j"
    run rm -f "$AGENTS/com.brain2.$j.plist"
  done
  log "removed launchd jobs. Homebrew tools and Ollama models are left in place."
  exit 0
fi

# 1. Homebrew and tools
if ! command -v brew >/dev/null 2>&1; then
  log "installing Homebrew"
  run /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi
for f in node ollama; do
  brew list --formula "$f" >/dev/null 2>&1 || { log "brew install $f"; run brew install "$f"; }
done

# 2. Ollama as a login service, then models
log "starting Ollama service"
run brew services start ollama
if [ "$SKIP_MODELS" = 0 ]; then
  if [ "$DRY" = 0 ]; then
    for _ in $(seq 1 30); do curl -sf http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
  fi
  for m in "${MODELS[@]}"; do
    if [ "$DRY" = 0 ] && ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$m\(:latest\)\?"; then
      log "model $m already pulled"
    else
      log "pulling $m"; run ollama pull "$m"
    fi
  done
fi

# 3. Dependencies and production build (out/)
cd "$REPO"
log "npm ci"
run npm ci
if [ "$SKIP_BUILD" = 0 ]; then
  log "npm run build"
  run npm run build
fi

# 4. launchd jobs
NODE_PATH="$(command -v node || echo /opt/homebrew/bin/node)"
run mkdir -p "$AGENTS" "$HOME/Library/Logs"
[ "$BACKUP" = 1 ] && run mkdir -p "$BACKUP_DIR"
for j in "${JOBS[@]}"; do
  src="$REPO/deploy/mac/com.brain2.$j.plist"
  dst="$AGENTS/com.brain2.$j.plist"
  log "installing com.brain2.$j"
  unload "$j"
  if [ "$DRY" = 1 ]; then
    printf '[dry-run] render %s -> %s\n' "$src" "$dst"
  else
    sed -e "s|__NODE_PATH__|$NODE_PATH|g" -e "s|__REPO_PATH__|$REPO|g" -e "s|__HOME__|$HOME|g" \
        -e "s|__PATH__|$PATH|g" -e "s|__BACKUP_DIR__|$BACKUP_DIR|g" "$src" > "$dst"
  fi
  run launchctl bootstrap "$UID_DOMAIN" "$dst"
done

# 5. Things a script cannot do
cat <<EOF

[always-on] done. By hand, once:
  - System Settings > Energy: prevent automatic sleep on power adapter; start up after a power failure.
  - Put Telegram and other secrets in $REPO/.env.local, then: launchctl kickstart -k $UID_DOMAIN/com.brain2.hub
  - Backup key (encrypted runs): node scripts/backup-keygen.mjs
Logs: ~/Library/Logs/brain2-{web,hub,awake,backup}.log   App: http://localhost:3000
EOF
