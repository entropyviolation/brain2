#!/usr/bin/env bash
# deploy/mac/install-always-on.sh — Set up an always-on Mac to run Brain2 and its local models
#
#   bash deploy/mac/install-always-on.sh              install everything, safe to run again
#   bash deploy/mac/install-always-on.sh --dry-run    print what it would do
#   bash deploy/mac/install-always-on.sh --uninstall  stop and remove the launchd jobs (keeps models and data)
#   flags: --skip-models  --skip-build  --no-backup
#
# Installs (Homebrew): node, ollama. Pulls the models BIM's flow uses. No ActivityWatch: screen
# activity that matters is on the Mac you use, not this server.
# Then installs launchd jobs that start at login and restart when they die:
#   com.brain2.web     the app and its /api on :3000 (scripts/cogs-prod-server.mjs, from out/)
#   com.brain2.hub     Telegram + phone hub (scripts/phone-hub.mjs)
#   com.brain2.awake   caffeinate, so the Mac stays up on power
#   com.brain2.backup  nightly vault backup (needs BRAIN2_BACKUP_DIR, default ~/Brain2Backups)
# Ollama runs as a brew service. Secrets (bot token, tokens) stay in the repo's .env.local: this script never writes them.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODELS=("qwen2.5:14b-instruct" "qwen2.5:3b-instruct" "nomic-embed-text")
JOBS=(web hub awake backup)
DRY=0; UNINSTALL=0; SKIP_MODELS=0; SKIP_BUILD=0; NO_BACKUP=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;; --uninstall) UNINSTALL=1 ;; --skip-models) SKIP_MODELS=1 ;;
    --skip-build) SKIP_BUILD=1 ;; --no-backup) NO_BACKUP=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

say() { printf '\n== %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi; }
UIDN="$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"

if [ "$UNINSTALL" = 1 ]; then
  say "Removing launchd jobs"
  for j in "${JOBS[@]}"; do
    run launchctl bootout "gui/$UIDN/com.brain2.$j" 2>/dev/null || true
    run rm -f "$AGENTS/com.brain2.$j.plist"
  done
  echo "Ollama (brew services stop ollama), models, and data are left alone."
  exit 0
fi

[ "$(uname)" = "Darwin" ] || { echo "This is for macOS." >&2; exit 1; }

say "Homebrew"
if ! command -v brew >/dev/null; then
  echo "Homebrew is missing. Install it from https://brew.sh, then run this again." >&2
  exit 1
fi

say "Packages"
command -v node >/dev/null || run brew install node
command -v ollama >/dev/null || run brew install ollama
echo "node $(node -v 2>/dev/null || echo '?') · ollama $(ollama --version 2>/dev/null | tail -1 || echo '?')"

say "Ollama service"
run brew services start ollama
if [ "$DRY" = 0 ]; then
  for _ in $(seq 1 30); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
  curl -fs http://127.0.0.1:11434/api/tags >/dev/null || { echo "Ollama did not answer on 127.0.0.1:11434." >&2; exit 1; }
fi

if [ "$SKIP_MODELS" = 0 ]; then
  say "Models (about 12 GB the first time)"
  FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
  [ "${FREE_GB:-0}" -ge 20 ] || { echo "Only ${FREE_GB} GB free; need about 20 GB." >&2; [ "$DRY" = 1 ] || exit 1; }
  HAVE="$(ollama list 2>/dev/null || true)"
  for m in "${MODELS[@]}"; do
    if grep -q "^$m" <<<"$HAVE"; then echo "have $m"; else run ollama pull "$m"; fi
  done
fi

say "App dependencies and build"
cd "$REPO"
[ -d node_modules ] || run npm ci
if [ "$SKIP_BUILD" = 0 ]; then run npm run build; fi
[ -f .env.local ] || echo "NOTE: no .env.local in $REPO. Add BRAIN2_TELEGRAM_BOT_TOKEN etc. there, then: launchctl kickstart -k gui/$UIDN/com.brain2.hub"

say "launchd jobs"
mkdir -p "$AGENTS" "$HOME/Library/Logs"
NODE="$(command -v node)"
BACKUP_DIR="${BRAIN2_BACKUP_DIR:-$HOME/Brain2Backups}"
for j in "${JOBS[@]}"; do
  [ "$j" = backup ] && [ "$NO_BACKUP" = 1 ] && continue
  src="$REPO/deploy/mac/com.brain2.$j.plist"
  dst="$AGENTS/com.brain2.$j.plist"
  if [ "$DRY" = 1 ]; then echo "   [dry-run] write $dst and (re)load it"; continue; fi
  sed -e "s|__NODE_PATH__|$NODE|g" -e "s|__REPO_PATH__|$REPO|g" -e "s|__BACKUP_DIR__|$BACKUP_DIR|g" \
      -e "s|__HOME__|$HOME|g" -e "s|__PATH__|$PATH|g" "$src" > "$dst"
  plutil -lint "$dst" >/dev/null
  launchctl bootout "gui/$UIDN/com.brain2.$j" 2>/dev/null || true
  launchctl bootstrap "gui/$UIDN" "$dst"
  echo "loaded com.brain2.$j"
done

say "Check"
if [ "$DRY" = 0 ]; then
  sleep 5
  curl -fs -o /dev/null http://127.0.0.1:3000/ && echo "app: up on http://127.0.0.1:3000" || echo "app: not answering yet (see ~/Library/Logs/brain2-web.log)"
  curl -fs http://127.0.0.1:11434/api/tags >/dev/null && echo "ollama: up"
  launchctl list | grep com.brain2 || true
fi
cat <<EOF

Still by hand (cannot be scripted):
 - System Settings → Energy: turn on "Prevent automatic sleeping on power adapter" and "Start up automatically after a power failure".
 - Put BRAIN2_TELEGRAM_BOT_TOKEN and the other secrets in $REPO/.env.local (see docs/BIM_SETUP_FOR_BEGINNERS.md).
 - Back up the key from: node scripts/backup-keygen.mjs (see docs/BIM_BACKUP.md).
Logs: ~/Library/Logs/brain2-{web,hub,awake,backup}.log
EOF
