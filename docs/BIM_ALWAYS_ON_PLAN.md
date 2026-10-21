# BIM always-on — plan of action

_Last mapped: 2026-10-20_

Goal: BIM stores every text even with your computer off, nothing readable by
Oracle, an alert when it goes down, and a clean move to your own device later.
Design and threat table: [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md).
Alternatives: [`BIM_HOSTING_OPTIONS.md`](BIM_HOSTING_OPTIONS.md).

Decisions so far: Oracle Free VM as a sealed capture box · Healthchecks.io
messages Telegram when pings stop · **Tailscale** for the VM↔Mac link (no public port)
· only keep texts from **your chat id**.

## Done

- Vault API bearer token (`COGS_PHONE_HUB_TOKEN`)
- Sealed box crypto, capture box, key generator, device drain in `phone:hub`
- Healthchecks ping from the box

## Workstreams (all four built 2026-10-20, untested on real Telegram/Oracle)

| # | Stream | Owns | Done when |
| --- | --- | --- | --- |
| A | Box hardening: require `COGS_CAPTURE_CHAT_IDS` (opt-out only by an explicit flag); bind address `COGS_CAPTURE_BIND` for the tailnet IP | `scripts/capture-box.mjs`, new `scripts/capture-filter.mjs` + test | Box refuses to start without chat ids; filter unit-tested |
| B | Tailscale: setup steps, close public 8788, systemd bound to the tailnet IP, env example, README of the VM side | `docs/ORACLE_CAPTURE_BOX.md`, `deploy/oracle/*` | A reader can go from blank VM to working tailnet queue |
| C | Drain quality: late-reply policy for old texts; drain heartbeat (second Healthchecks check) so a dead Mac drain alerts you | `scripts/phone-hub.ts`, new `lib/ingest/drain-*.ts` + tests | Old texts are applied with a clear reply policy; heartbeat pings |
| D | Backup: nightly copy of `data/` and the private key reminder, via launchd on the Mac | new `scripts/backup-data.mjs`, `deploy/mac/*`, `docs/BIM_BACKUP.md` | Backup runs, keeps N copies, tested |

## You do (cannot be automated)

1. `node scripts/capture-keygen.mjs`; back up the private key.
2. Healthchecks.io: two checks (box, drain), Telegram integration.
3. Oracle account + VM; Tailscale on VM and Mac.
4. Find your chat id (Settings → Message ingest).

## After the streams

Integration pass (me): merge doc changes, run the full ingest tests, one dry run
of box → drain against a fake Telegram, then your VM go-live checklist.
Later: move the box to a device you own (same two files).
