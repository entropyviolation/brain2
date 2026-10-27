# iPhone sync plan

_Last mapped: 2026-10-22_

Goal: Brain2 fills itself from the phone. Texts, calls and location come first. Health, Screen Time, DMs and email follow. Today every phone record is typed or shared by hand through BIM ([`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)). This plan makes it automatic.

Status: Wave 0 (core) and Wave 1 (texts, calls, location) are built. Texts and calls run live on allie's MacBook. Location is built and installed on the iPhone but does not record yet: it waits on the Oracle box update. Wave 2 is **Planned**. Full state and next steps: **Status and handoff** below.

Build style: parallel agents, one per source, with fixed file owners. Same rules as [`analytics-plan/12-waves.md`](analytics-plan/12-waves.md): agents in one wave do not edit each other's files.

## What exists today

- `call:`, `text:`, `screen:` and `gps:` are BIM verbs ([`BIM_COMMANDS.md`](BIM_COMMANDS.md)). Each one is a manual Shortcut built by `scripts/build-iphone-phone-shortcuts.mjs`. All are stamped estimated.
- Telegram Live Location paints Location while a share is running.
- The Mac already reads two local sources from Electron: Apple Notes (`electron/apple-notes.js`, via `osascript`) and ActivityWatch (`electron/activitywatch.js`). New Mac readers follow that pattern.
- `npm run phone:hub` keeps the vault live. Hub merge unions Inbox and Plan entries by id (`lib/vault-guard.js`), so a new writer that stamps stable ids cannot drop or duplicate records.
- The iOS app (`ios/`, Capacitor, `com.cogs.mobile`) opens `/mobile/`. It has one native plugin, `BrainLocation` (`ios/App/App/LocationPlugin.swift`).

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

Every source writes through the same vault paths BIM uses, so Data, People I Know and Tracking see it with no new storage.

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
| Phone plates | 2 | Data plates per [`analytics-plan/07-phone.md`](analytics-plan/07-phone.md) |

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

## Status and handoff

_Last mapped: 2026-10-25_

Notes for the next agent. Read this before touching phone sync.

### Done

| Piece | State | Where |
| --- | --- | --- |
| Sync core | Built. Readers return records plus a cursor. The runner archives, applies, flushes the vault, then moves the cursor, so a crash re-reads and never skips. Settings → Phone sync shows each source and its last run, and can turn texts, calls, and location off. | `lib/phone-sync/runner.ts`, `components/Settings/PhoneSyncPanel.tsx` |
| Texts | **Live** on allie's MacBook (`~/brain2`). The Mac holds 302k texts back to 2018. Every text is archived to `data/phone-sync/messages.jsonl`; Tracking keeps only the last 30 days (`BRAIN2_PHONE_SYNC_TEXT_DAYS`), because localStorage holds about 5 MB. | `lib/phone-sync/messages*.ts`, `write.ts` |
| Calls | **Live.** 997 calls (since 2026-05-25). Calls count as time together with the person (`personTimePenIds`). | `lib/phone-sync/calls*.ts`, `lib/person-time.ts` |
| Hub | `npm run phone:hub` runs phone sync every 60 s and catches up in one tick. It fills localStorage from the vault, and phone sync and location push **only the Tracking key** back (`flushTracking`). Pushing every key sent stale copies of other stores, which the vault guard refused. | `scripts/phone-hub.ts`, `scripts/phone-hub-polyfill.mjs` |
| Location, phone side | Built, compiles in Xcode 26.6 with no changes, installed on the iPhone (free personal team). Significant-change plus visits, an offline queue, and sealed uploads. **On by default:** once the upload is set up and location is allowed, it starts and stays on across launches until Turn off. Each time the app comes to the front it asks for Always again while only While Using is granted. | `ios/App/App/LocationPlugin.swift`, `AppDelegate.swift` |
| Location card | On the phone's Home (`/mobile/`), iOS build only. Paste the upload URL, upload token and public key, then Save; it asks for location and starts. **Set to Always** opens iPhone Settings. | `components/Mobile/MobileLocationCard.tsx`, `lib/mobile/location-bridge.ts` |
| Location, hub side | Built. `startLocationDrain` pulls `GET /uploads?kind=location` from the box, opens with the private key, writes Location rows, then acks. Runs only when `BRAIN2_CAPTURE_BOX_URL` is set. | `lib/phone-sync/location-drain.ts`, `location.ts` |
| Box upload route | Built in the repo: `POST /upload` (phone, add-only token), `GET /uploads` and `POST /uploads/ack` (hub token). **Not deployed yet.** | `scripts/capture-upload.mjs`, `scripts/capture-box.mjs` |
| App reinstall | `scripts/ios-reinstall.mjs` plus the launchd job `com.brain2.ios-reinstall` (every 3 h). It reinstalls over Wi-Fi or cable once the install is 4 days old and retries until one works. From day 5 it reminds on the Mac and in Telegram. The Location card warns in the last 2 days (`appExpiresAt` from the build's provisioning profile). **Not installed on the Mac yet.** | `deploy/mac/README.md` |
| CI | Runs on Node 22 (the SQLite readers need `node:sqlite`). | `.github/workflows/ci.yml` |

### To do, in order

1. **Deploy the upload route to Oracle** (allie, or the Mac session over SSH with allie's yes). Copy `capture-box.mjs` and `capture-upload.mjs` to `/opt/brain2-capture/`, add `BRAIN2_CAPTURE_UPLOAD_TOKEN` (`openssl rand -hex 32`) to `/etc/brain2-capture.env`, restart `brain2-capture`. Steps: [`phone-sync/03-location.md`](phone-sync/03-location.md) → To switch it on. If the box was never set up, do [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md) → Setup first.
2. **Tailscale on the iPhone.** The box listens on the tailnet only, so the phone must be on the tailnet to upload. Same account as the Mac. The upload URL is `http://brain2-capture:8788/upload` (or the 100.x address).
3. **Hub drain on.** The Mac's `.env.local` needs `BRAIN2_CAPTURE_BOX_URL`, `BRAIN2_CAPTURE_TOKEN`, and `~/.brain2/capture-private.key`. Restart `npm run phone:hub`; it logs `location drain` at start.
4. **Reinstall the app** from the Mac (it now has the card and on-by-default). Fill in the card, allow location, pick Always.
5. **Check:** walk somewhere, open the app, tap Send now, and see a Location row in Tracking.
6. **Turn on the weekly reinstall.** Tick Connect via network for the iPhone in Xcode once, then install the launchd job. Steps: [`deploy/mac/README.md`](../deploy/mac/README.md) → iPhone app reinstall.
7. **Wave 2:** Health, Screen Time, DMs, email, and phone plates (briefs `04`–`06`). Settings → Phone sync is built (2026-10-25): it lists those sources as not built, and it can turn texts, calls, and location off.

### Known issues and watch items

- **Call pen is keyed by name** (`iphone-call-<slug(name)>`). A rename starts a new pen, and two people with one name share one. Follow-up: key it on a stable person id. See [`phone-sync/02-calls.md`](phone-sync/02-calls.md).
- **Renderer localStorage is near its limit.** The task store alone is about 3.7 MB. Tracking went from 0.8 to 1.5 MB with 30 days of texts. Do not raise the text window without moving Tracking off localStorage.
- **CI is red on main** from a slow test, not phone sync: `components/Home/home-moon-orrery.test.tsx` times out at 5 s on the runner. Fix: an explicit timeout of about 20 s on its two heavy tests.
- **Mac disk.** The iOS platform takes about 8 GB. The MacBook ran out of space once; keep 10 GB or more free for the hub, the vault and Xcode.
- **Swiping the app away** in the app switcher may stop iOS from relaunching it for location until it is opened again. Leave it in the background.
- **Keys.** `~/.brain2/capture-private.key` stays on the Mac (the hub needs it), backed up offline. `~/.brain2/backup-private.key` should be copied offline and deleted from the Mac.

## Open questions

- None open. Decided 2026-10-22: stay on the free Apple ID and keep the app alive with the automatic reinstall plus reminders. The paid Developer Program ($99 a year, builds last a year) stays the fallback if the reinstall proves unreliable.
