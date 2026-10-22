# iPhone sync plan

_Last mapped: 2026-10-22_

Goal: Brain2 fills itself from the phone. Texts, calls and location come first. Health, Screen Time, DMs and email follow. Today every phone record is typed or shared by hand through BIM ([`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)). This plan makes it automatic.

Status: Steps 1 and 2 are written (this map and the briefs in [`phone-sync/`](phone-sync/README.md)). Wave 0, the shared core, is built: [`lib/phone-sync/`](../lib/phone-sync/README.md). Wave 1: texts and calls are **live on allie's Mac** (2026-10-22). Location is **on the phone and waiting on the Oracle box**. Wave 2 is **Planned**. Done, open, and agent notes: [Handoff](#handoff).

Build style: parallel agents, one per source, with fixed file owners. Same rules as [`analytics-plan/12-waves.md`](analytics-plan/12-waves.md): agents in one wave do not edit each other's files.

## What exists today

- `call:`, `text:`, `screen:` and `gps:` are BIM verbs ([`BIM_COMMANDS.md`](BIM_COMMANDS.md)). Each one is a manual Shortcut built by `scripts/build-iphone-phone-shortcuts.mjs`. All are stamped estimated.
- Telegram Live Location paints Location while a share is running.
- The Mac already reads two local sources from Electron: Apple Notes (`electron/apple-notes.js`, via `osascript`) and ActivityWatch (`electron/activitywatch.js`). New Mac readers follow that pattern.
- `npm run phone:hub` keeps the vault live. Hub merge unions Inbox and Plan entries by id (`lib/vault-guard.js`), so a new writer that stamps stable ids cannot drop or duplicate records.
- The iOS app (`ios/`, Capacitor, `com.cogs.mobile`) is a web shell with one native plugin, `BrainLocation` (`ios/App/App/LocationPlugin.swift`).

## Source map

The honest route for each data type. iOS does not let any third-party app read the Messages or call history on the phone. Those two come through the Mac, which receives the same data through iCloud.

| Data | Route | Needs | Grain | Notes |
| --- | --- | --- | --- | --- |
| **Texts** (iMessage + SMS) | Mac reads `~/Library/Messages/chat.db` (SQLite, read-only) | Mac signed into the same Apple ID, Messages in iCloud on, "Text Message Forwarding" on for SMS. Full Disk Access for Brain2 / the hub. | Every message, both directions, with sender, time, thread, attachments path | Newer macOS keeps some bodies only in `attributedBody` (a binary blob); the reader must decode it. |
| **Calls** | Mac reads `~/Library/Application Support/CallHistoryDB/CallHistory.storedata` (SQLite) | Same Apple ID, iPhone calls synced to Mac (FaceTime → "Calls from iPhone"). Full Disk Access. | Every call: number, name, start, duration, incoming/outgoing/missed | Covers phone, FaceTime and many VoIP apps that use CallKit. |
| **Call recordings** | iOS 18.1+ built-in call recording. The recording and transcript land in Apple Notes. The existing Apple Notes reader picks them up. | iOS 18.1+. | Audio + transcript per recorded call | iOS plays a notice to everyone on the call. Some US states (for example California, Florida, Washington) require every party to agree. No automatic silent recording is possible on iPhone. |
| **Location** | Native background location in the iOS app (significant-change + visits), posting to the hub | A small Capacitor plugin. Location "Always" permission. | A point on every significant move and every arrival/departure, offline queue | Fallback with no app work: Telegram Live Location (already supported) or an OwnTracks/Overland app pointing at the hub. |
| **Health** (steps, walking/running distance, workouts, sleep) | HealthKit in the iOS app, daily and on-open | Capacitor HealthKit plugin. HealthKit permissions. | Daily totals plus samples | Fallback: the Health Auto Export app posting JSON to the hub. |
| **Screen Time** | No API returns raw usage to an app. Keep the `screen:` Shortcut and add a Shortcuts automation that sends app-open events. Mac side: ActivityWatch (already wired). | Shortcuts automations. | Per app open, estimated | Apple's DeviceActivity API only lets an app react to thresholds, not read totals. |
| **DMs** (Instagram, etc.) | Platform data downloads, imported on a schedule. Telegram via the existing bot only. | The person requests the download. | Per message, delayed | No live API exists for personal Instagram DMs. Instagram followers import already works this way. |
| **Email** | IMAP (Gmail with an app password) read by the hub, or the Mac's Mail.app store | IMAP credentials kept on the Mac only. | Per message: from, to, subject, time, optional body | Store headers by default; bodies only when asked. |

## Where it lands

Every source writes through the same vault paths BIM uses, so Analytics, People I Know and Tracking see it with no new storage.

- Texts and calls become **iPhone Texts** instants and **iPhone Calls** intervals, matched to People I Know by phone number or handle. Calls count as company time for that person.
- Location becomes Location instants, same as `gps:`. Known places become Location pens.
- Health becomes Tracking metrics by day.
- Each record carries one stable `sourceId` per source, so re-reads never duplicate: messages `message.guid`, calls `ZUNIQUE_ID`, Health samples their UUID. Cursors are separate and never part of identity: messages `ROWID`, calls `(ZDATE, ZUNIQUE_ID)`.
- Each record carries the stamp `generatedBy: { kind: "phone-sync", id: "<source>:<sourceId>" }`. The Phone room's allow-list ([`analytics-plan/07-phone.md`](analytics-plan/07-phone.md)) gains this stamp.

## Agents and file owners

Wave 1 (texts, calls, location) runs in parallel. Wave 2 follows.

| Agent | Wave | Owns (new files unless noted) |
| --- | --- | --- |
| Sync core | 0 | `lib/phone-sync/` (record types, id + stamp helpers, people matcher, write-to-vault adapter), Settings → Phone sync panel. Lands first so the others build on it. |
| Texts | 1 | `lib/phone-sync/messages-reader.ts`, `lib/phone-sync/messages.ts` + tests |
| Calls | 1 | `lib/phone-sync/calls-reader.ts`, `lib/phone-sync/calls.ts` + tests |
| Location | 1 | iOS location plugin under `ios/App/App/`, `lib/phone-sync/location.ts`, hub endpoint |
| Health | 2 | iOS HealthKit plugin, `lib/phone-sync/health.ts` |
| Screen Time + DMs + email | 2 | Shortcuts automation in `scripts/build-iphone-phone-shortcuts.mjs` (edit), `lib/phone-sync/email.ts`, DM import |
| Phone plates | 2 | Analytics plates per [`analytics-plan/07-phone.md`](analytics-plan/07-phone.md) |

The sync core agent alone edits shared files (`lib/vault-guard.js`, Settings, the hub entry). Others ask it for hooks.

## Steps

1. **Source map.** This doc. ✅
2. **Agent briefs.** One brief per agent under [`phone-sync/`](phone-sync/README.md). ✅
3. **Wave 0 + 1.** Sync core, then texts, calls and location in parallel. ✅ (Calls also count as time together: `personTimePenIds` in `lib/people-i-know.ts`.)
4. **Wave 2.** Health, Screen Time, DMs, email, phone plates.

## Decisions

_Last mapped: 2026-10-22_

- **Machines.** No always-on Mac yet. A Mac mini (not a Mac Studio; any Apple silicon is enough) becomes the always-on reader and hub. Until then the laptop reads Messages and call history whenever it is open; the Mac keeps full history, so each run catches up and nothing is lost.
- **Oracle stays the front door.** It cannot read Apple data, but it catches Telegram and the phone app's location and Health uploads while the Mac sleeps, all sealed to the public key.
- **Sideloading from Xcode** is OK.
- **Message bodies are kept**, in the local vault only.
- **Backups are encrypted** before bodies land (built 2026-10-22, [`BIM_BACKUP.md`](BIM_BACKUP.md) → Encryption).

## Open questions

- Free Apple ID (re-sign every 7 days) or paid developer account (a year)?

## Handoff

_Last mapped: 2026-10-22_

### Done

| Piece | State | Proof |
| --- | --- | --- |
| Texts reader | Live. `npm run phone:hub` in Terminal.app reads `chat.db` every 60 s. | Dry read: 302,224 messages, 2018-07-21 to today, 0 errors. All of them are in `data/phone-sync/messages.jsonl`. |
| Texts in Tracking | Last 30 days only (`COGS_PHONE_SYNC_TEXT_DAYS`). | iPhone Texts 1,413 rows. |
| Calls | Live. Every call the Mac keeps, which is about 5 months. | iPhone Calls 997 rows. |
| Hub saves Tracking | Fixed (PRs #17, #19, #21). | 5,578 Tracking entries survive with `npm run dev` running, 0 duplicate ids. |
| iOS app | Compiles in Xcode 26.6 (iOS 26.5 SDK) with no Swift changes. Installed on allie's iPhone. | Built and launched with `devicectl`. |
| Location card | `components/Mobile/MobileLocationCard.tsx` (PR #22): upload setup, Turn on / off, Send now. | Tests. |
| Location autostart | `lib/mobile/location-autostart.ts`: once the upload is set up, every app open asks for permission and starts recording. Turn off wins until Turn on. | Tests. Not seen on the phone yet, because the box is not up. |
| Backups | Key pair in `~/.brain2/` (`backup-*.key`, `capture-private.key`). | allie still has to copy the private keys offline. |

### Open, in order

1. **Oracle box.** Follow [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md) → Setup. As of 2026-10-22: no VM, no Tailscale on the Mac. `~/.brain2/vm-bundle/` predates `capture-upload.mjs`, so copy all four files fresh from `scripts/`. Location also needs `COGS_CAPTURE_UPLOAD_TOKEN` in the box env, and the Mac needs `COGS_CAPTURE_BOX_URL` in `.env.local` so the hub drains uploads.
2. **Tailscale on the iPhone.** The box listens only on its tailnet address, so the phone must be on the tailnet too. Install the Tailscale app, sign in to the same account, and leave the VPN on (on-demand). Without it, uploads fail and queue on the phone (5,000 events max, oldest dropped and counted).
3. **Phone setup.** In the app: Location → Upload setup → `http://brain2-capture:8788/upload` (or the 100.x address), the upload token, and the capture public key. Then iOS Settings → BRAIN2 → Location → Always.
4. **Check location end to end.** Card chip reads "sent N min ago". `npm run phone:hub` logs the drain. Location rows appear in Tracking.
5. **Wave 2.** Health, Screen Time, DMs, email, phone plates. Briefs in [`phone-sync/`](phone-sync/README.md).

### Notes for agents

- **Full Disk Access.** Only Terminal.app has it. Processes started inside the Claude app do not, until Claude restarts. Run the hub and any `chat.db` read through Terminal (`osascript -e 'tell application "Terminal" to do script "…"'`).
- **Never print message bodies.** Report counts. The archive holds every text in plain JSON. Do not copy it anywhere.
- **The hub loads the polyfill twice** (native ESM and jiti). Use `globalThis.localStorage` through `fillLocalStorage` / `dumpLocalStorage`, never a module-local map. That bug kept every hub store empty until PR #19.
- **Cursors.** `data/phone-sync/cursors.json`. Clearing it re-reads everything. That is safe: the archive and Tracking both skip known ids. Back it up first and ask allie, because the safety check treats it as destructive.
- **Vault guard.** A Tracking write that lacks an existing entry is refused whole (`timegridLosesProtectedEntry` in `lib/vault-guard.js`). Phone sync flushes only the Tracking key and rehydrates before each pass. A "refused" snapshot in `data/recovery-backups/` means the guard kept the vault, not that data was lost.
- **Free Apple team.** Team `25YWDVDMKT`, passed on the command line (`DEVELOPMENT_TEAM=… -allowProvisioningUpdates`), not saved in the project. The app expires every 7 days. Reinstall: `npm run build && npm run mobile:cap:sync`, then `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -destination 'id=<device>' DEVELOPMENT_TEAM=25YWDVDMKT build` and `xcrun devicectl device install app`.
- **Disk.** The iOS platform is about 8 GB, and the Mac ran out once. Check `df -h /` before Xcode work.
- **A local `capture-box.mjs`** has run from `~/brain2` on port 18788 since 2026-10-20. Do not start a second Telegram poller next to it and the hub (409 errors).
