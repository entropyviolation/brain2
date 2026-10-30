# Phone window

_Last mapped: 2026-10-29_

The iPhone app and the Electron app on the coding Mac should show one vault. The phone is a window onto the Mac's file. It keeps a small local cache for what it paints often, and for a short time when the Mac does not answer. It does not keep a second full vault in the web-storage box.

_Last mapped: 2026-10-30._ Phases 1–3 are built. The phone loads the file into memory, keeps a small cache, and sends field patches. Phases 4 and 5 are **Planned**. Texts, calls, and location stay on the path in [`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md). That plan fills the vault from the phone. This plan lets the phone see and edit the vault.

## Decision

_Last mapped: 2026-10-29_

The file of record is `data/shared-persist.json`, served by the persist API that already exists (`GET` / `POST` / `PUT` `/api/persist` in `scripts/persist-api.mjs`). One always-on Mac runs `npm run phone:hub` (port 8787) and owns that file, Telegram, and the vault guards. The phone loads that file into Zustand memory for the session and does not write it into `localStorage`. A later write from the phone is a patch of rows it changed. The hub folds the patch in with the union and the shrink guards that already protect the file. The coding Mac's Electron keeps its own `localStorage` in `~/Library/Application Support/cogs` and meets the file through Settings → Sync vault (`lib/ingest/vault-push.ts`) and the same union (`mergeHubIntoStores` in `lib/persist-storage.ts`).

The other doors lose. `data/mobile-sync.json` (`/api/sync`) is a whole-snapshot copy that the phone then restores into `localStorage` (`pullAndRestoreMobileSync` in `lib/mobile-sync.ts`, `mode: "replace"`). That is the thin pull this plan leaves behind. MongoDB Atlas is unwired scaffolding (`lib/README.md`). A new sync protocol would skip `lib/vault-guard.js`, which is the code that already refuses a wipe. Moving the desktop stores into IndexedDB is a separate redesign (`docs/PERF_PLAN.md`, the "Later" note; `docs/PLAN_OF_ACTION.md`). The phone window does not need that move. Electron on the desk stays one JSON blob per store.

## What lives where

_Last mapped: 2026-10-29_

**On the Mac, in the file.** Every Zustand persist key the desk has pushed: items, lists, folders, habits, the time grid, sleep, goals, events, kitchen, modules, item types, plan text, and the rest of `data/shared-persist.json`. Attachment bytes stay in IndexedDB on the machine that saved them (`lib/attachments.ts`, database `cogs-attachments`, URI `idb:`). They are not in the JSON. Message bodies stay in `data/phone-sync/messages.jsonl` (`lib/phone-sync/archive.ts`). That module is Node-only. Years of texts do not ride the JSON, and they do not ride the phone.

**In phone memory, for the session.** The full persist snapshot, one `brain2-*` key each, parsed into the same Zustand stores the screens already read (`useTaskStore` and the others). Home, Lists, and Inventory already mount those stores (`components/Mobile/MobileApp.tsx`). A full item in memory is how notes, attributes, and the whole time grid show up. RAM is not the 5 MB box.

**In phone `localStorage`, and only these.** Pins that are already small: the hub URL, NFC chips (`brain2-nfc-hub`, `brain2-nfc-chips`), the data-profile flag, and the login mark in `sessionStorage` (`components/Mobile/lib/mobile-auth.ts`). The task vault and the time grid do not land here. `slimPhonePersistValue` (`lib/phone-storage.ts`) is what writes the short names and the week of blocks today. The window path does not call it.

**In a phone IndexedDB cache, once phase 2 exists.** The slices the shell paints on launch: the task store (Lists and Inventory scan it), habits, goals, sleep, settings, theme, and the time-grid entries those screens ask for. Open a photo, a doc, or a thread, and that one object can join the cache. The message archive does not. Both key aliases do not. The cache is disposable. A free Apple ID install lasts about 7 days (`docs/PHONE_SYNC_PLAN.md`, `deploy/mac`). The reinstall wipes the app container, so WKWebView `localStorage` and IndexedDB go with it. The baked `public/mobile-hub.json` in the new build is how the shell finds the Mac again. NFC's hub URL lives in `localStorage` (`components/Mobile/nfc/MobileNfcCard.tsx`), so a reinstall asks for it again unless the bake already points at the spare.

IndexedDB is already in the app (`cogs-attachments`, `cogs-docs` in `lib/doc-persist.ts`, the vocab cache). It is a different box from the origin's ~5 MB `localStorage`. No Capacitor Filesystem plugin is installed. `package.json` has `@capacitor/core`, `@capacitor/ios`, and `@capacitor/barcode-scanner`. The Podfile matches that. Native Swift beside those pods is location, Health, and NFC (`ios/App/App/LocationPlugin.swift`, `HealthPlugin.swift`, `NfcPlugin.swift`). This plan adds no dependency. `Info.plist` already allows local-network HTTP (`NSAllowsLocalNetworking`), which is how the current pull reaches the Mac.

## How a screen reads

_Last mapped: 2026-10-29_

Screens do not fetch. They subscribe to Zustand, the same as the desk. `HomeDashboard`, Lists, and `InventoryPhoneScreen` already do.

`hubEnabled()` in `lib/persist-storage.ts` (~214) is true only for `http://localhost` and `http://127.0.0.1`. A phone on `capacitor://localhost`, on `/mobile`, or on the Mac's LAN address never reads `/api/persist`. Today it reads `/api/sync/pull`, and `lib/phone-hub-view.mjs` cuts that snapshot (`PHONE_PULL_BUDGET` ~2.5 MB, short titles, list ids, about seven days of the grid). The server ignores `?full=1` when the user agent is an iPhone (`requestWantsFullPull`). The client cuts again (`pullBackupView`). That cut is why photos, notes, and attributes stay on the Mac.

_Last mapped: 2026-10-30._ Built. After login, the shell fetches `GET /api/persist?canon=1` from the hub URL (phase 1 adds the `canon` flag so the reply is one key per vault; the file on disk still stores the `cogs-*` alias). The fetch fills an in-memory map. Each store rehydrates from that map. `mergeHubIntoStores` (~378) is the desk version of this, and it writes the chosen string back to `localStorage` (`writeChosenLocal`). The phone path skips that write. `setItem` for a vault key updates the memory map and returns. It does not call `localStorage.setItem`, and it does not call `postHub`.

While the process lives, a later screen reads the memory. Kill the app and the memory is gone. Phase 1 then shows an offline line and the pins. It does not paint a leftover slim vault as if it were the file. Phase 2 fills memory from the IndexedDB cache when the fetch fails, and the shell says the copy is stale.

`capacitor://localhost` is already a trusted browser origin (`lib/ingest/request-origin.mjs`). An `Origin: null` is refused. Phase 1 checks that the sideload's fetch is allowed. Safari opened at `http://<mac-lan>:3000/mobile/` is same-origin with that server and can use the same fetch.

## How a phone edit writes

_Last mapped: 2026-10-29_

Phase 1 does not write the file. An edit in that build lives in memory until the process ends.

From phase 3, a save records a patch: the row ids that changed, the fields that changed, and any tombstone. The flush sends that patch to the existing persist route. The hub applies it on the stored blob.

Whole-blob replace is the wrong merge for a phone. `unionPersistSnapshots` (`lib/vault-guard.js`, `isUnionedVaultId` ~808) already folds two snapshots by id for five stores: `cogs-task-storage`, `cogs-timegrid-store`, `cogs-planned-actions`, `cogs-ingest-store`, and `cogs-telegram-feed`. Plan-text keys (`dayPlan-*`, `weekPlan-*`, `monthPlan-*`) union by entry id on their own. Ids only one side has are kept. Tombstones stay deleted: `removedTaskIds`, `restoredTaskIds`, `removedListIds`, `removedEntryIds`.

A union is still a whole-row replace when both sides have the id. `preferTaskRow` (~583) keeps the row that left Inbox, then the newer `createdAt`, then the incoming row. `Task.modifiedAt` (~499 in `lib/types.ts`) is the last content edit, and this stamp ignores it. A slim phone row with the same `createdAt` would replace the Mac row and drop notes, attributes, and body. The shrink guard would not notice: the id count did not fall. Append-only logs fail the other way. `shouldRejectHubLogShrink` keeps the stored copy when the incoming log is shorter, so a week of the time grid posted as the whole store cannot update the Mac's grid. It is refused, and the new block is dropped.

_Last mapped: 2026-10-30._ Built. A phone patch upserts only the rows it names. A field present on the patch replaces that field. A field absent stays as the file has it. A delete is a tombstone, the same ids the union already honors. The result then runs through the guards that already wrap a hub write (`mergeIntoHub` in `scripts/persist-api.mjs`): shrink (`shouldRejectVaultShrink`, `VAULT_RECORD_FIELDS` ~130, half the rows, and a floor of `MIN_GUARDED_RECORDS`), append-only refusal, Inbox resurrection, habit `contentRev`, theme `appearanceRev`, ingest `allowlistRev`. A phone request whose body is a whole store (`{ name, value }` with `source: "phone"`) is refused. Desktop `{ name, value }` from Electron and Chrome stays.

Habits, sleep, and goals take that same patch as of 2026-10-30. Events, kitchen, modules, and item types still show in the session and do not save.

The outbox is rows in the phase 2 IndexedDB database. When the Mac answers, the phone flushes the outbox. It never flushes by posting the slim `localStorage` copy. `if (!phone) postHub` (~691) stays. The patch flusher is a different call.

Two editors: the desk and the phone can change different fields of one item. Each patch names its fields, so the file keeps both. The same field edited on both sides since the phone last read: the flush that arrives later wins that field, and the recovery journal (`data/recovery-backups/`, `journalVaultSnapshot`) keeps the previous blob. The desk's own `localStorage` still unions on the way into the file, so a stale Sync vault push cannot drop a row the phone added.

## The two Macs

_Last mapped: 2026-10-29_

**Spare Mac, always on.** One `npm run phone:hub`. The vault file is `data/shared-persist.json` in that checkout. The process serves `/api/persist` on `0.0.0.0:8787`, hydrates its own stores from the file, and long-polls Telegram. Set `BRAIN2_PHONE_HUB_TOKEN`. Vault routes are open on the LAN when the token is empty (`lib/ingest/hub-auth.ts`); a home LAN should still set it, and the phone sends `Authorization: Bearer`. Oracle is a sealed capture box for location uploads (`docs/BIM_HOSTING_OPTIONS.md`, `docs/ORACLE_CAPTURE_BOX.md`). It is not required for this window. The spare is the host `BIM_HOSTING_OPTIONS.md` already calls the easy always-on machine.

**Coding Mac.** Electron `localStorage` under `~/Library/Application Support/cogs` stays the working copy while you edit (`electron/README.md`, data section). A rich profile on `http://localhost:3000` already POSTs each key to that machine's `data/shared-persist.json` (`postHub` in `lib/persist-storage.ts`). Settings → Sync vault is the other push: a full-map `PUT /api/persist` to the hub URL (`lib/ingest/vault-push.ts`), merged by the same guards. Friend-pic data URLs stay off that map.

Those are two files until the desk is aimed at the spare. **Planned** in phase 4: when the spare's `/api/ingest/status` says it is polling, the coding Mac pushes and pulls that URL, and it stops treating its own checkout's `data/shared-persist.json` as the phone's file. Pull is `mergeHubIntoStores`, which already unions. Push stays Sync vault. Seed-sized Electron snapshots still skip, so an empty profile cannot wipe the file.

**One Telegram poller.** The renderer already yields when the hub URL is polling (`hooks/useMessageIngest.ts`). Electron's main poller yields only when `data/phone-hub-status.json` in *this* checkout is fresh (`phoneHubOwnsTelegram` in `electron/telegram-ingest.js`, ~62, 45 seconds). A hub on the spare does not write that file on the coding Mac, so both would poll. Phase 4 makes the main process yield on the remote heartbeat too. `phone:hub` on the spare is the poller. The coding Mac does not run a second one.

**Texts and calls.** The readers open `~/Library/Messages/chat.db` and Call History on the machine that runs them (`lib/phone-sync/README.md`). They run inside `phone:hub`. If Messages is signed in on the spare, they stay in that one process. If Messages is signed in only on the coding Mac, the spare does not start those readers. The coding Mac pushes Tracking only, which is what `flushTracking` already does (`scripts/phone-hub.ts` ~777). A full flush from the hub was refused by the vault guard; that limit stays. New texts wait while the Messages Mac is asleep. They already do.

**While you are still developing, before the spare is the file.** One server on port 3000. `electron:dev` and `electron:local` both serve the APIs there (`BRAIN2_STRICT_PORT`). A packaged `app://` window has no `/api`. The phone never talks to `app://`.

1. On the coding Mac: `npm run electron:dev`. The dev server binds `0.0.0.0` (`scripts/cogs-dev-server.mjs`). Its `data/shared-persist.json` is the file for this test.
2. Sideload the iOS app (`BRAIN2_IOS_TEAM_ID=25YWDVDMKT npm run ios:reinstall -- --force`, or the usual Xcode run). The static build writes `public/mobile-hub.json` with this Mac's LAN address and port 3000 (`scripts/mobile-hub-hint.mjs`). Login on `/mobile` is `admin` / `admin`.
3. Safari on the phone, same Wi-Fi, `http://<lan>:3000/mobile/`, is the same shell without a rebuild. Use it to see a change before the next sideload.
4. Leave `npm run phone:hub` off during this test, unless you mean to exercise port 8787. Two processes can share one checkout's file (each re-reads on mtime), and they must not both poll Telegram.
5. When the spare takes the file, point the phone's hub URL at `http://<spare-lan>:8787`, put the token in, and rebuild or save that URL. `mobile-hub.json` is port 3000 until the hint learns otherwise. The spare's checkout is the one whose `data/` you back up (`docs/BIM_BACKUP.md`).

Demo profile (`brain2-data-profile=demo`) never touches the hub. Leave it that way.

## Phases

_Last mapped: 2026-10-29_

Each phase ships on its own. Later phases assume the earlier ones. Guards that must still pass after every phase: `shouldRejectVaultShrink`, `shouldRejectHubLogShrink`, Inbox resurrection, the tombstone ids above, `contentRev` / `appearanceRev` / `allowlistRev`, `flushTracking` pushing only the Tracking key, and no phone `postHub` of a slimmed store.

### Phase 1 — Read the file into memory

**Built 2026-10-30.** The phone is a window. Home, Lists, and Inventory show the Mac's full rows for this session: notes, attributes, lists, and the time grid past seven days. Nothing vault-sized is written to `localStorage`. Saves are the phase 3 patches, not a copy of the store.

Touches:

- `lib/phone-window.ts` — Fetch `/api/persist`, fill the memory map, rehydrate stores, skip `writeChosenLocal`. Uses the existing persist route.
- `lib/persist-storage.ts` — phone `getItem` reads the memory map; phone `setItem` on a vault key updates memory only.
- `scripts/persist-api.mjs` — `GET /api/persist?canon=1` omits the `cogs-*` twin on the wire.
- `components/Mobile/MobileApp.tsx` — start the fetch after login; an offline line when it fails.
- `components/Mobile/MobilePullCard.tsx` — this card no longer calls `pullAndRestoreMobileSync` on the phone. Refresh refetches memory. The `/api/sync` handlers stay for the desk until nothing calls them.
- Tests beside `lib/persist-storage` and the phone window: a phone `setItem` of the task store does not call `localStorage`, and a fixture hub hydrates a note that `slimTask` would have dropped.

Leave `lib/phone-hub-view.mjs` in place until this phase has replaced the pull. Do not point the window at `?full=1`.

### Phase 2 — A small cache for a short outage

**Built 2026-10-30.** After a good fetch, write the launch slices to IndexedDB (`brain2-phone-window`, same open pattern as `lib/attachments.ts`). On the next launch, if the Mac does not answer, hydrate from that cache and mark it stale. Saves stay off. The cache holds the task store, habits, goals, sleep, settings, theme, and the time-grid range the open shell needs. A doc, a module, a photo, and a message thread wait until the screen opens.

Touches: `lib/phone-window-cache.ts`, the phase 1 window module, a test that a failed fetch paints the cache and does not write `localStorage`.

A quota error drops the cache and stays on the live fetch. The cache is not a second file of record.

### Phase 3 — Patch writes

**Built 2026-10-30.** An edit on the phone flushes a patch. The file gains the row without losing fields the phone did not send. A whole store from the phone is refused. The outbox survives a short outage and flushes when the Mac answers. It does not flush while the cache is the only copy and the Mac has not answered, except to keep the outbox itself.

Touches:

- `lib/vault-guard.js` — apply a patch onto the stored blob; field present wins; field absent stays; tombstones unchanged; then the existing shrink and downgrade checks. Desktop union of two full snapshots stays.
- `lib/vault-guard.test.ts` — a slim row must not drop `notes` or attributes; a tombstone must not come back; a shorter time grid posted as a whole store must still be refused; a one-block patch must land.
- `scripts/persist-api.mjs` — accept `{ name, patch, source }`. Refuse `{ name, value }` when `source` is `phone`.
- `lib/persist-storage.ts` — phone saves append to the outbox. They do not call `postHub` or `slimPhonePersistValue`.
- `lib/phone-window-cache.ts` — the outbox lives here.

**Built 2026-10-30** for the five unioned stores, plan text, habits, sleep, and goals. Events, kitchen, and modules stay read-only.

### Phase 4 — The spare holds the file

**Planned.** One poller. One file. The coding Mac's Electron meets it by the existing Sync vault push and a focus pull (`mergeHubIntoStores`). Localhost `postHub` stands down while the spare is the hub, so the coding checkout's JSON is not a second phone vault.

Touches:

- `electron/telegram-ingest.js` — yield when the remote hub is polling, not only when the local status file is fresh.
- `lib/persist-storage.ts` — hub follow and `postHub` target the spare URL when that hub is the file.
- `lib/ingest/vault-push.ts` — keep the PUT. No second dump format.
- `scripts/phone-hub.ts` — Messages and call readers start only on the Mac that has those databases. Tracking-only flush stays.
- `scripts/mobile-hub-hint.mjs` — the baked URL can be the spare's `:8787` when that is the file.

You can run phases 1–3 against `electron:dev` on the coding Mac before this phase. The phone then works only while that Mac is awake and the dev server is up.

### Phase 5 — The rest of the app on the phone

**Planned.** The window already holds the stores. This phase mounts the rooms the shell still skips, and loads bytes when a screen opens them.

The desk tabs are Home, Lists, Docs, Scheduler, Operations, Modules, Inventory, and Data (`app/page.tsx`). The phone shell is Home, Lists, and Inventory (`MobileApp.tsx`). Docs, Scheduler, Operations, Modules, and Data are the same panels, with phone chrome from `docs/MOBILE_STYLE.md`.

Item detail is already `TaskDetailPopup` on this shell. Full fields show once phase 1 has loaded full tasks. Photo and file bytes are `idb:` URIs. **Planned:** the hub serves one attachment by id (the backup path in `lib/data/backup.ts` already knows the bytes). The phone writes that blob into `cogs-attachments` when the item opens.

A text thread is a read against `messages.jsonl` on the Mac, into session memory, when that screen opens. The jsonl is not copied down.

Kitchen and the inventory rooms already read `useTaskStore` and `useKitchenStore`. They show the file's rows once those keys are in memory. Item types do not ride the old `mobile-sync` snapshot (`lib/README.md`); they do ride `shared-persist.json`, so the window includes them.

Touches: `components/Mobile/MobileApp.tsx`, a small attachment read on the persist hub (`scripts/persist-api.mjs` or the phone hub's request handler), a thread read beside `lib/phone-sync/archive.ts` that stays Node-only on the server, and phone tests for one opened photo and one opened thread.

## What this will not do

_Last mapped: 2026-10-29_

- Put a second full vault in `localStorage`, including by flipping `?full=1` or by raising `PHONE_PULL_BUDGET`.
- POST the phone's slim copy (`slimStoredVault`) at the Mac.
- Stand up Atlas, a second database, or a new sync protocol beside `/api/persist`.
- Run two Telegram pollers.
- Move the desktop stores into IndexedDB. That redesign stays parked.
- Copy the vault onto the Oracle VM.
- Teach the phone to read `chat.db`. Texts still enter through the Mac.

## How to know a phase worked

_Last mapped: 2026-10-29_

**Phase 1.** On the phone, open an item whose note and attributes you can see on Electron. The phone shows them. The time grid shows a day older than a week. In Safari's or the WebView's storage, `brain2-task-storage` is absent or still the old pin, and its size is not the multi-megabyte vault. Electron's task count is unchanged after the phone has been open. Turn the Mac's server off, kill the app, relaunch: the shell says it cannot reach the Mac, and it does not show a short-name list as the vault.

**Phase 2.** Fetch once. Stop the server. Kill the app. Relaunch. Home and Lists show the cached rows, marked stale. A new item created on Electron while the server was down is absent on the phone until the server is back and you refresh. After refresh it is there. `localStorage` still has no full task blob.

**Phase 3.** On the phone, rename one item and add a sentence to its note. On Electron, within a focus pull, the new name and the sentence are there, and a field you did not touch (a photo URI, a list membership you did not edit) is still there. Delete an item on the phone. It stays deleted on the Mac after the desk pulls (`removedTaskIds`). Paint a block on the phone. The Mac's older days are still in the grid. Airplane mode on the phone, one edit, then the network back: the edit lands once, and a second flush does not duplicate it. A hand-built request that posts the whole slim task store comes back refused, and the file's record count is unchanged.

**Phase 4.** Stop Electron on the coding Mac. The spare's hub still answers `GET /api/persist` and still answers a BIM text. The coding Mac's Electron, reopened, pulls the BIM capture into `localStorage` through the union, and a list you edited on the desk is still there. Only one `getUpdates` poller is running (the spare). The coding checkout's `data/shared-persist.json` is not what the phone is reading.

**Phase 5.** Docs, Scheduler, Operations, Modules, and Data open on the phone and show the same rows as Electron. Open an item with a photo: the picture loads, and the JSON vault does not grow by the image's byte size. Open a text thread: the body comes from the Mac, and `messages.jsonl` is still only on the Mac.

**Mac asleep, any phase after 2.** Spare asleep, coding Mac awake: Electron still edits `localStorage`. The phone shows the cache and holds patches until the spare answers. Coding Mac asleep, spare awake: the phone reads and, after phase 3, writes the spare. The desk catches up on the next pull. Both asleep: the phone shows the cache, the outbox waits, and BIM waits.
