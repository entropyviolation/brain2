# BIM backup

_Last mapped: 2026-10-20_

Nightly copy of the vault. Script: `scripts/backup-data.mjs`. Schedule: `deploy/mac/`.

## What is backed up

- Everything in `data/`: `shared-persist.json`, `mobile-sync.json`, `message-ingest.json`, the Telegram and drain offset files, `recovery-backups/`.
- `data/chrome-idb-snapshot/`, only while it is under 50 MB (`IDB_SNAPSHOT_MAX_BYTES` in the script).
- Output is one `brain2-data-YYYYMMDD-HHMMSS.tar.gz` per run, in `COGS_BACKUP_DIR` (or argv 1, default `~/Brain2Backups`).
- The tar is written as `.partial` and renamed when done. A crash never leaves a half file that looks real.
- The newest `COGS_BACKUP_KEEP` (default 14) are kept. Older ones are deleted.

## What is not backed up

- `capture-private.key`, anywhere. It is excluded by name, and it lives outside `data/` anyway. A backup that left the machine with the key inside would undo the sealed box.
- `node_modules` and `.DS_Store` under `data/`.
- An oversized `chrome-idb-snapshot/`. It is a rebuildable cache.
- Code. That is in git.

The script refuses to run when `data/shared-persist.json` is missing or empty. That stops an empty vault from rotating good backups out.

## Try it

```bash
node scripts/backup-data.mjs /tmp/b2-test
tar -tzf /tmp/b2-test/brain2-data-*.tar.gz | head
```

Scheduling: see `deploy/mac/README.md`.

## Restore

1. Stop the app and `npm run phone:hub`.
2. Move the current `data/` aside: `mv data data.old`.
3. Unpack from the repo root: `tar -xzf ~/Brain2Backups/brain2-data-YYYYMMDD-HHMMSS.tar.gz`. It creates `data/`.
4. Check `data/shared-persist.json` opens, then start the app.
5. Keep `data.old` until you are sure.

The offset files come back too. The hub resumes from the saved Telegram position, so messages are not replayed.

## The private key

- `~/.brain2/capture-private.key` opens the sealed capture messages. Lose it and the sealed messages stay sealed.
- Keep one copy offline: a USB stick or a printed copy in a safe place.
- Do not put it in iCloud, the backup folder, or any cloud sync, unless it is first encrypted with a passphrase you remember.
- The script prints a reminder after each run while the key file exists.
