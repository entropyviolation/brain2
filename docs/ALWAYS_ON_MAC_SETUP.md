# Brain2 on the always-on Mac: step by step

_Last mapped: 2026-10-30_

Do these in order on the always-on Mac. Each step says how you know it worked.
Paths use `~/brain2`. Every command goes in Terminal (Cmd+Space, type Terminal).

## 0. What you need

- 40 GB free, 60 GB is comfortable (models 12 GB, repo and build 3 GB, Homebrew 3 GB, backups and growth the rest).
- The Mac plugged in, on Wi-Fi, with an admin account.
- The other Mac (the main one) nearby, for the secrets in step 5.

## 1. Wipe the old laptop (skip if already clean)

1. Copy off anything you want to keep.
2. System Settings → General → Transfer or Reset → Erase All Content and Settings. It signs out of iCloud and Find My for you.
3. At setup, make a local user and skip iCloud sign-in.

No Erase option? Hold Cmd+R at startup → Disk Utility → erase the disk as APFS → Reinstall macOS.

## 2. Tools

Command line tools (gives `git`). Click Install in the popup and wait:

```bash
xcode-select --install
```

Homebrew. At the end it prints "Next steps": run the two lines it shows so `brew` works in new windows:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Check: `brew --version` prints a version.

## 3. Get the code

The repo is public, so no sign-in is needed.

```bash
git clone https://github.com/entropyviolation/brain2.git ~/brain2
```

```bash
cd ~/brain2
```

Check: `ls deploy/mac` lists `install-always-on.sh`.

## 4. Dry run

Prints what the installer would do and changes nothing.

```bash
bash deploy/mac/install-always-on.sh --dry-run
```

## 5. Secrets and data (from the main Mac)

Git does not carry these. `.env.local` and the keys are secrets: AirDrop them, never email or chat them.

On the **main** Mac, AirDrop or copy these to the always-on Mac:

| From the main Mac | To the always-on Mac |
|---|---|
| `~/brain2/.env.local` | `~/brain2/.env.local` |
| `~/brain2/data/` (whole folder, about 280 MB) | `~/brain2/data/` |
| `~/.brain2/capture-private.key` | `~/.brain2/capture-private.key` |
| `~/.brain2/backup-private.key` and `backup-public.key` | `~/.brain2/` |

`.env.local` holds `BRAIN2_TELEGRAM_BOT_TOKEN`, `BRAIN2_CAPTURE_TOKEN`, `BRAIN2_PHONE_HUB_TOKEN` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. In Finder, press Cmd+Shift+. to show hidden files so you can find `.env.local` and `.brain2`.

On the always-on Mac, make the folder first so the files have somewhere to land:

```bash
mkdir -p ~/.brain2
```

Check: `ls -a ~/brain2/.env.local ~/brain2/data ~/.brain2` lists them.

Stop the Telegram hub on the main Mac first (or two machines will both answer the bot): `launchctl bootout gui/$(id -u)/com.brain2.hub` if it runs there, or just quit `npm run phone:hub`.

## 6. Install

Installs node, Ollama and ActivityWatch with Homebrew, pulls three models (about 12 GB), builds the app, and loads four launchd jobs. Takes a while. Safe to run again.

```bash
bash deploy/mac/install-always-on.sh
```

Check, at the end: `app: up on http://127.0.0.1:3000` and `ollama: up`.

Flags: `--skip-models`, `--skip-build`, `--no-backup`, `--uninstall` (removes the jobs, keeps models and data).

## 7. By hand (cannot be scripted)

1. System Settings → Energy (Battery on a laptop → Options): turn on "Prevent automatic sleeping on power adapter" and "Start up automatically after a power failure".
2. Open ActivityWatch once from Applications. Allow Accessibility and Screen Recording when asked. It then starts at login.
3. Make sure you are logged in and the lid stays open (or use an external display). The jobs are login-level, so they only run while a user is logged in.
4. Make the backup key, if you did not copy one in step 5, and store it somewhere safe off this Mac:

```bash
node scripts/backup-keygen.mjs
```

## 8. Check it works

```bash
launchctl list | grep com.brain2
```

You want `com.brain2.web`, `hub`, `awake` and `backup`. Open http://127.0.0.1:3000 in Safari. Send your Telegram bot a message.

Logs: `~/Library/Logs/brain2-web.log`, `brain2-hub.log`, `brain2-awake.log`, `brain2-backup.log`.

After editing `.env.local`, restart the hub:

```bash
launchctl kickstart -k gui/$(id -u)/com.brain2.hub
```

Run the backup once to test it:

```bash
launchctl kickstart gui/$(id -u)/com.brain2.backup
```

## 9. Reaching it from your phone and other devices

The app listens on this Mac at port 3000. To reach it from elsewhere, use Tailscale (see `docs/BIM_SETUP_FOR_BEGINNERS.md`, Part 3), not an open router port.

## Fixes

- **`app: not answering`**: read `~/Library/Logs/brain2-web.log`. Most often the build did not finish. Run `npm run build` in `~/brain2`, then `launchctl kickstart -k gui/$(id -u)/com.brain2.web`.
- **Only N GB free, need about 20**: clear more space (step 1), then re-run step 6.
- **Hub does not answer Telegram**: check `.env.local` has the bot token, and that the hub is not also running on the main Mac.
- **Reinstall the iPhone app from this Mac**: not done by the installer. It needs Xcode (large). Leave that on the main Mac.
- **Undo everything**: `bash deploy/mac/install-always-on.sh --uninstall`.
