# BIM backup

_Last mapped: 2026-10-20_

Nightly copy of the vault. Script: `scripts/backup-data.mjs`. Schedule: `deploy/mac/`.

## What is backed up

- Everything in `data/`: `shared-persist.json`, `mobile-sync.json`, `message-ingest.json`, the Telegram and drain offset files, `recovery-backups/`.
- `data/chrome-idb-snapshot/`, only while it is under 50 MB (`IDB_SNAPSHOT_MAX_BYTES` in the script).
- Output is one `brain2-data-YYYYMMDD-HHMMSS.tar.gz.b2enc` per run (encrypted; see below), in `COGS_BACKUP_DIR` (or argv 1, default `~/Brain2Backups`). With no backup key it is a plain `.tar.gz` and the run prints a warning.
- The tar is written as `.partial` and renamed when done. A crash never leaves a half file that looks real.
- The newest `COGS_BACKUP_KEEP` (default 14) are kept, plain and encrypted counted together by date. Older ones are deleted.

## What is not backed up

- `capture-private.key` and `backup-private.key`, anywhere. It is excluded by name, and it lives outside `data/` anyway. A backup that left the machine with the key inside would undo the sealed box.
- `node_modules` and `.DS_Store` under `data/`.
- An oversized `chrome-idb-snapshot/`. It is a rebuildable cache.
- Code. That is in git.

The script refuses to run when `data/shared-persist.json` is missing or empty. That stops an empty vault from rotating good backups out.

## Encryption

_Last mapped: 2026-10-22_

Decided 2026-10-22, before synced message bodies land in the vault. Backups are encrypted to a public key, so the 03:00 job needs no secret and a copy in iCloud or on a drive cannot be read without the private key.

- Make the keys once: `node scripts/backup-keygen.mjs`. It writes `~/.brain2/backup-public.key` and `~/.brain2/backup-private.key` (mode 600) and refuses to overwrite either.
- The job reads `COGS_BACKUP_PUBLIC_KEY`, else `~/.brain2/backup-public.key`. No key means a plain backup and a `WARNING` line in the log.
- Recipe: X25519 + HKDF-SHA256 + AES-256-GCM, streamed in 1 MB chunks (`scripts/backup-crypt.mjs`). Same idea as `scripts/sealed-box.mjs`, separate key and label (`brain2-backup-v1`).
- The plain tar exists only as a `.partial` while it is encrypted, then it is deleted.
- Plain `.tar.gz` backups from before the key keep their place in the rotation and age out after `COGS_BACKUP_KEEP` runs. Delete them by hand if you want them gone sooner.
- Keep an offline copy of `backup-private.key`. Lose it and every encrypted backup stays locked.

## Try it

```bash
node scripts/backup-data.mjs /tmp/b2-test
# With a backup key the file ends in .b2enc. Open it first (skip this line without a key):
node scripts/backup-open.mjs /tmp/b2-test/brain2-data-*.tar.gz.b2enc
tar -tzf /tmp/b2-test/brain2-data-*.tar.gz | head
```

Scheduling: see `deploy/mac/README.md`.

## Restore

1. Stop the app and `npm run phone:hub`.
2. Move the current `data/` aside: `mv data data.old`.
3. If the file ends in `.b2enc`, open it first: `node scripts/backup-open.mjs ~/Brain2Backups/brain2-data-YYYYMMDD-HHMMSS.tar.gz.b2enc [path/to/backup-private.key]`. It writes the `.tar.gz` beside it and refuses a wrong key without writing anything.
4. Unpack from the repo root: `tar -xzf ~/Brain2Backups/brain2-data-YYYYMMDD-HHMMSS.tar.gz`. It creates `data/`.
5. Check `data/shared-persist.json` opens, then start the app.
6. Keep `data.old` until you are sure.

The offset files come back too. The hub resumes from the saved Telegram position, so messages are not replayed.

## The private keys

The backup key (`~/.brain2/backup-private.key`) follows the same rules as the capture key below.

- `~/.brain2/capture-private.key` opens the sealed capture messages. Lose it and the sealed messages stay sealed.
- Keep one copy offline: a USB stick or a printed copy in a safe place.
- Do not put it in iCloud, the backup folder, or any cloud sync, unless it is first encrypted with a passphrase you remember.
- The script prints a reminder after each run while the key file exists.
