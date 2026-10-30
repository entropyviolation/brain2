# deploy/mac

_Last mapped: 2026-10-20_

launchd jobs: the nightly vault backup (`com.brain2.backup`, see `docs/BIM_BACKUP.md`) and the iPhone app reinstall (`com.brain2.ios-reinstall`, below).

## Install

_Last mapped: 2026-10-22_

The plist has four placeholders: `__NODE_PATH__`, `__REPO_PATH__`, `__BACKUP_DIR__`, `__HOME__`.

```bash
sed -e "s|__NODE_PATH__|$(command -v node)|" -e "s|__REPO_PATH__|$HOME/brain2|g" -e "s|__BACKUP_DIR__|$HOME/Brain2Backups|" -e "s|__HOME__|$HOME|g" deploy/mac/com.brain2.backup.plist > ~/Library/LaunchAgents/com.brain2.backup.plist
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.brain2.backup.plist
```

Make the backup key once so runs are encrypted (`docs/BIM_BACKUP.md` → Encryption):

```bash
node scripts/backup-keygen.mjs
```

Run it once now to check:

```bash
launchctl kickstart gui/$(id -u)/com.brain2.backup
```

Logs go to `~/Library/Logs/brain2-backup.log`.

## Uninstall

```bash
launchctl bootout gui/$(id -u)/com.brain2.backup
rm ~/Library/LaunchAgents/com.brain2.backup.plist
```

## Notes

- The destination is your choice. An iCloud Drive folder or an external drive both work. An external drive must be mounted at 03:00. If it is not, the run fails and logs the error.
- Under `~/Library/Mobile Documents/` or `~/Documents`, macOS may ask for file access. Allow `node` once.
- A Mac that is asleep at 03:00 runs the job on wake.
- Edit `BRAIN2_BACKUP_KEEP` in the plist to change how many backups are kept.

## iPhone app reinstall

_Last mapped: 2026-10-22_

A free Apple ID build stops opening after 7 days, and location stops with it. `scripts/ios-reinstall.mjs` keeps it alive. launchd runs it every 3 hours and at login. A run does nothing until the last good install is 4 days old (`BRAIN2_IOS_REINSTALL_DAYS`). Then it builds the app and installs it on the iPhone over Wi-Fi or cable, and keeps trying every 3 hours until one works. From day 5 (`BRAIN2_IOS_REMIND_DAYS`) it also reminds you, at most every 12 hours: a Mac notification, plus Telegram when `BRAIN2_TELEGRAM_BOT_TOKEN` and `BRAIN2_IOS_REMIND_CHAT_ID` are set in the plist. The Location card on the phone also warns when the app is 2 days from expiry. State lives in `~/.brain2/ios-reinstall.json`.

**Once, with the phone plugged in:** Xcode → Window → Devices and Simulators → select the iPhone → tick **Connect via network**. After that, the phone installs over Wi-Fi when it is unlocked, on the same network, and the Mac is awake.

Find your team id in Xcode → Settings → Accounts (the 10-character id), then:

```bash
sed -e "s|__NODE_PATH__|$(command -v node)|" -e "s|__REPO_PATH__|$HOME/brain2|g" -e "s|__HOME__|$HOME|g" -e "s|__PATH__|$PATH|" -e "s|__TEAM_ID__|YOURTEAMID|" deploy/mac/com.brain2.ios-reinstall.plist > ~/Library/LaunchAgents/com.brain2.ios-reinstall.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.brain2.ios-reinstall.plist
```

Install now to start the clock: `BRAIN2_IOS_TEAM_ID=YOURTEAMID npm run ios:reinstall -- --force`. Check without building: `-- --dry-run`. Logs: `~/Library/Logs/brain2-ios-reinstall.log`.

Uninstall: `launchctl bootout gui/$(id -u)/com.brain2.ios-reinstall` and delete the plist.

Notes:
- A build needs about 2 GB free (the cache lives in `~/Library/Caches/brain2-ios-build`).
- The build runs `npm run build` and `npx cap sync ios`, so it installs whatever `~/brain2` has checked out.
- `PATH` is baked into the plist at install time, so `npx`, `pod` and `xcodebuild` resolve under launchd. Reinstall the plist if you move Node or CocoaPods.
