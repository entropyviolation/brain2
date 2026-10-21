# deploy/mac

_Last mapped: 2026-10-20_

launchd job for the nightly vault backup. See `docs/BIM_BACKUP.md` for what is and is not backed up.

## Install

The plist has four placeholders: `__NODE_PATH__`, `__REPO_PATH__`, `__BACKUP_DIR__`, `__HOME__`.

```bash
sed -e "s|__NODE_PATH__|$(command -v node)|" -e "s|__REPO_PATH__|$HOME/brain2|g" -e "s|__BACKUP_DIR__|$HOME/Brain2Backups|" -e "s|__HOME__|$HOME|g" deploy/mac/com.brain2.backup.plist > ~/Library/LaunchAgents/com.brain2.backup.plist
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.brain2.backup.plist
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
- Edit `COGS_BACKUP_KEEP` in the plist to change how many backups are kept.
