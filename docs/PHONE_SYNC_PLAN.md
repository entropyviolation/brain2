# iPhone sync plan

_Last mapped: 2026-10-22_

Goal: Brain2 fills itself from the phone. Texts, calls and location come first. Health, Screen Time, DMs and email follow. Today every phone record is typed or shared by hand through BIM ([`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)). This plan makes it automatic.

Status: **Planned.** Steps 1 and 2 are written (this map and the briefs in [`phone-sync/`](phone-sync/README.md)). No code yet.

Build style: parallel agents, one per source, with fixed file owners. Same rules as [`analytics-plan/12-waves.md`](analytics-plan/12-waves.md): agents in one wave do not edit each other's files.

## What exists today

- `call:`, `text:`, `screen:` and `gps:` are BIM verbs ([`BIM_COMMANDS.md`](BIM_COMMANDS.md)). Each one is a manual Shortcut built by `scripts/build-iphone-phone-shortcuts.mjs`. All are stamped estimated.
- Telegram Live Location paints Location while a share is running.
- The Mac already reads two local sources from Electron: Apple Notes (`electron/apple-notes.js`, via `osascript`) and ActivityWatch (`electron/activitywatch.js`). New Mac readers follow that pattern.
- `npm run phone:hub` keeps the vault live. Hub merge unions Inbox and Plan entries by id (`lib/vault-guard.js`), so a new writer that stamps stable ids cannot drop or duplicate records.
- The iOS app (`ios/`, Capacitor, `com.cogs.mobile`) is a web shell. It has no native plugins yet.

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
- Each record carries a stable source id (message `ROWID` + GUID, call `Z_PK` + unique id, sample UUID) so re-reads never duplicate.
- Each record carries a new stamp, for example `generatedBy.kind === "phone-sync"` with `source: "messages" | "calls" | …`. The Phone room's allow-list ([`analytics-plan/07-phone.md`](analytics-plan/07-phone.md)) gains this stamp.

## Agents and file owners

Wave 1 (texts, calls, location) runs in parallel. Wave 2 follows.

| Agent | Wave | Owns (new files unless noted) |
| --- | --- | --- |
| Sync core | 0 | `lib/phone-sync/` (record types, id + stamp helpers, people matcher, write-to-vault adapter), Settings → Phone sync panel. Lands first so the others build on it. |
| Texts | 1 | `electron/messages-db.js`, `lib/phone-sync/messages.ts` + tests |
| Calls | 1 | `electron/call-history.js`, `lib/phone-sync/calls.ts` + tests |
| Location | 1 | iOS location plugin under `ios/App/App/`, `lib/phone-sync/location.ts`, hub endpoint |
| Health | 2 | iOS HealthKit plugin, `lib/phone-sync/health.ts` |
| Screen Time + DMs + email | 2 | Shortcuts automation in `scripts/build-iphone-phone-shortcuts.mjs` (edit), `lib/phone-sync/email.ts`, DM import |
| Phone plates | 2 | Analytics plates per [`analytics-plan/07-phone.md`](analytics-plan/07-phone.md) |

The sync core agent alone edits shared files (`lib/vault-guard.js`, Settings, the hub entry). Others ask it for hooks.

## Steps

1. **Source map.** This doc. ✅
2. **Agent briefs.** One brief per agent under [`phone-sync/`](phone-sync/README.md). ✅
3. **Wave 0 + 1.** Sync core, then texts, calls and location in parallel.
4. **Wave 2.** Health, Screen Time, DMs, email, phone plates.

## Decisions

_Last mapped: 2026-10-22_

- **Machines.** No always-on Mac yet. A Mac mini (not a Mac Studio; any Apple silicon is enough) becomes the always-on reader and hub. Until then the laptop reads Messages and call history whenever it is open; the Mac keeps full history, so each run catches up and nothing is lost.
- **Oracle stays the front door.** It cannot read Apple data, but it catches Telegram and the phone app's location and Health uploads while the Mac sleeps, all sealed to the public key.
- **Sideloading from Xcode** is OK.
- **Message bodies are kept**, in the local vault only.

## Open questions

- Encrypt backups ([`BIM_BACKUP.md`](BIM_BACKUP.md)) before message bodies land? Recommended yes.
- Free Apple ID (re-sign every 7 days) or paid developer account (a year)?
