# Storage move — one SQLite owner, operations, a cursor

_Last mapped: 2026-11-11_

Everything here is **Planned** unless a line says **Built**. This is the step-by-step plan for section 2.1 of [`AUDIT_2026-11-11.md`](AUDIT_2026-11-11.md). It continues the row store stages in [`ORACLE_INTERIM_SYNC.md`](ORACLE_INTERIM_SYNC.md) (Row store) and does not replace them.

## The goal in three sentences

One SQLite database on the Mac owns the data. Every client (Electron, the Chrome tab, the iPhone, the phone hub's own ingest) keeps a cache, sends small operations, and pulls changes by cursor. A client can never send its whole state as a write, so an empty or stale client can no longer remove anything.

## Where it stands today

Measured on the live hub file on 2026-11-11.

- `data/shared-persist.json` is 34 MB on disk. It holds 1,353 keys. 870 are canonical and total 15.9 MB. The other 483 are `cogs-*` and unprefixed twins.
- Two vaults are 81% of the bytes: `brain2-task-storage` (7.3 MB, about 42,000 rows) and `brain2-timegrid-store` (5.6 MB). 860 of the 870 keys are under 50 KB.
- 80 files call Zustand `persist`. Each has its own version and migrations.
- `lib/persist-storage.ts` (`cogsStateStorage`) writes the whole blob to `localStorage`, runs the guards, then POSTs the whole blob to `/api/persist`.
- `lib/vault-guard.js` (2,611 lines) is imported by 11 runtime files: the item, tracking, habits, affirmation, ingest and feed stores, `persist-storage.ts`, `lib/data/backup.ts`, `lib/phone-sync/ids.ts`, `scripts/persist-api.mjs` and `electron/preload.js`.
- `services/item-mutation-service.ts` (`dispatchItemMutation`) has 11 call sites. Most writes still go straight to a store.

Pieces of the target that are already **Built**:

| Piece | File | State |
| --- | --- | --- |
| Every vault in SQLite | `scripts/vault-store.mjs` | Running in `shadow` mode. The JSON file is still the truth. |
| Task vault as rows with a `seq` cursor and tombstones | `scripts/row-store.mjs`, `lib/row-vault.js` | A mirror derived from the blob. |
| Pull by cursor | `GET /api/persist/rows?since=` | The phone uses it. The desktop does not. |
| Row patches with an id | `POST /api/persist { name, patch, patchId, baseCursor }` | The phone only. Retries are ignored by `patchId`. Stale rows are named. |
| Patch appliers for ten vaults | `applyVaultPatch` in `lib/vault-guard.js` | tasks, timegrid, planned actions, ingest, feed, habits, sleep, goals, health, plan text. |
| A client outbox | `lib/phone-window.ts`, `lib/phone-window-outbox` | The phone only. |
| Whole-store writes refused | `handlePhonePersistPost` | The phone only. |

So the phone is already a rough version of the final client. The plan is to finish that model on the server and then move the desktop onto it. It is not a rewrite.

## Decisions

1. **Build on the row store. Do not adopt a sync engine.** There is one user, one server and three clients. Replicache, Electric, PowerSync and the CRDT libraries all assume their own client store, which would mean rewriting 80 Zustand stores first. The server orders every write, so a CRDT's main benefit (merging with no server) is not needed.
2. **The hub process is the only owner.** Electron, Chrome and the phone all talk to it over HTTP. Electron does not open the database itself. Electron 33 ships a Node version older than the one that added `node:sqlite`, so check this before considering direct access. One client path is also simpler.
3. **Operations are row-level by default.** An operation is "set these fields on row `id`", "remove row `id`", or "append this entry". Named operations are added only where a field write is wrong: counters, append-only logs and habit cells. This is the existing `{ upserts, removedIds }` patch with one op per row.
4. **The server's `seq` decides order.** Client clocks are not trusted. `appearanceRev` and `contentRev` (wall-clock stamps) go away at the end.
5. **A row is removed only by a `remove` operation.** A row that is missing from a client means nothing. This one rule replaces the shrink guards.

## Target shape

One file, `data/brain2.sqlite`, opened with `node:sqlite`, WAL on.

| Table | Columns | Holds |
| --- | --- | --- |
| `rows` | `owner, vault, kind, id, json, version, seq, updated_at, deleted_at, device_id` | One row per item, list, folder, time entry, pen, habit, habit cell, night, goal and so on. `version` counts edits to that row. |
| `kv` | `owner, key, value, version, seq, updated_at, device_id` | The 860 small vaults: prefs, plan text, UI state. One row per key, or per field where two devices edit the same key. |
| `ops` | `op_id, device_id, received_at, vault, kind, target_id, payload, base_version, result_seq, outcome` | Every operation as received. Idempotent by `op_id`. Kept 90 days. |
| `blobs` | `hash, bytes, mime, created_at` | Attachments and Docs HTML, by hash. Stage 7. |
| `meta` | `key, value` | `schema_version`, `epoch`, `next_seq`. |

API, all behind the hub token:

- `POST /api/ops { deviceId, ops: [...] }` applies a batch in one transaction. It returns `{ cursor, results: [{ opId, outcome, seq }] }`. Outcomes: `applied`, `duplicate`, `merged` (another device changed a different field first), `superseded` (another device changed the same field after this op's base; this op still wins and the earlier value is in `ops`), `refused` (with a reason).
- `GET /api/changes?since=<seq>&limit=` returns rows and `kv` entries changed after the cursor, oldest first, with tombstones.
- `GET /api/snapshot` returns the first full download for a new client, plus the cursor it is valid at.

Conflict rules:

- Fields merge last-writer-wins by server `seq` (`mergeRowFields` does this today).
- List order is its own row, so reordering and editing an item never collide.
- Append-only logs (tracking entries, points, reviews, metrics, regret, activity) only take `append` and `remove`. Two appends never conflict.
- A tombstone keeps the last JSON. A row comes back only through an explicit upsert whose base is at or after the tombstone.

## Stages

Each stage ships alone and leaves the app working. Sizes are relative: S is days, M is a week or two, L is several weeks.

### Stage 0 — Make it safe to change (S)

1. Do audit section 2.2 first: bind to `127.0.0.1` by default and require the token on `/api/persist*` and `/api/recovery-backups`. A new write door should not open on an open network.
2. Add a nightly `VACUUM INTO data/snapshots/brain2-YYYY-MM-DD.sqlite`. Keep 14.
3. Turn the three recorded wipes into tests that post the same payloads: the empty profile with 15 items against 2,455 (2026-09-21), the phone patch that removed 881 lists and 25 habits (2026-10-30), and the 45 `habit-done-*` rows. They pass today because of guards. They must still pass after each stage.
4. Remove the stale files in `data/`: three `shared-persist.json.*.tmp` (46 MB, from 2026-11-01) and, after checking nothing reads it, `mobile-sync.json` (61 MB, 2026-10-28).

Done when: the tests exist and pass, and a snapshot restores in a dry run.

### Stage 1 — Flip the hub to SQLite (S)

This is stage 4a's step 4 in `ORACLE_INTERIM_SYNC.md`. It is built and waits on a decision.

1. Run `npm run store:check` until it is clean for a week.
2. Set `BRAIN2_STORE=sqlite`. The JSON file becomes an export written every few minutes.
3. Move the direct readers of the JSON file to the API, one at a time: `electron/preload.js`, `electron/persist-hub-cache.js`, `scripts/backup-data.mjs`, `scripts/bim-screentime-*.py`, `scripts/dump-chrome-localstorage.mjs`, and the mtime watch in `scripts/phone-hub.ts`.

Done when: nothing reads `shared-persist.json` and a save no longer rewrites 34 MB.

### Stage 2 — Rows become the truth for the task vault (M)

Today the blob is the truth and `rows.sqlite` is derived from it. Invert that.

1. Merge the two SQLite files into `data/brain2.sqlite` with the tables above. Import once from the vault store.
2. A task-vault write applies to `rows` first. The blob for `brain2-task-storage` is rebuilt from rows when a client asks for it.
3. Add `npm run rows:check`: rebuild the blob from rows and compare it with the last blob by id and content.
4. Whole-blob writes to the task vault are diffed on the server against the rows and stored as upserts only. Rows missing from the blob are logged, not removed. Removal needs an id in `removedTaskIds`, as it does now.

Done when: `rows:check` is clean for a week and the Stage 0 tests pass with `shouldRejectVaultShrink` switched off for this vault.

### Stage 3 — The operations door (M)

1. Add `POST /api/ops` and `GET /api/changes`. `/api/ops` reuses `applyVaultPatch` internally at first, so the ten patchable vaults work on day one.
2. Record every op in `ops`. Move `applied_patches` into it.
3. Switch the phone outbox from `POST /api/persist { patch }` to `/api/ops`. The payload is nearly the same.
4. Run the old guards in report-only mode on each applied op and write hits to `data/guard-alarms.log`. They no longer block.

Done when: the phone runs on `/api/ops` for two weeks with no alarm that was a real loss.

### Stage 4 — The desktop becomes a client (L)

This is the stage that removes the "several copies" problem. The desktop stops being a second source of truth.

1. Lift the phone window into a shared client: `lib/sync-client/` with the memory map, the outbox, the cursor pull and the diff (`diffPersist`). `lib/phone-window.ts` becomes a thin caller. Split the 1,092-line file as part of this.
2. `cogsStateStorage` gets a third mode. For a migrated vault, `setItem` diffs against the last synced value and queues ops, and `getItem` reads the client cache. It does not write `localStorage` and does not POST a blob.
3. The client cache is IndexedDB (`lib/phone-window-cache.ts` already does this for the phone). This removes the 5 MB ceiling and the `cogs-*` twins.
4. Turn it on per vault with a flag, in this order: the task vault, then `brain2-timegrid-store`. Those two are 81% of the bytes and both already have patch appliers.
5. The phone hub's own stores (`scripts/phone-hub.ts` fills a `localStorage` polyfill and calls `mergeSharedPersistItems`) become an in-process client of the same op door. Telegram ingest then writes ops, not blobs.
6. For each migrated vault the hub refuses `{ name, value }` from every source, as it refuses the phone today.
7. The app shows a sync state: saved, queued (with a count), offline. The outbox makes this cheap.

Done when: Electron and Chrome can both be open, each edits the same list, and both converge with no guard firing. Starting Chrome on an empty profile downloads a snapshot and writes nothing.

### Stage 5 — The remaining vaults (M)

In this order, each behind its own flag:

1. `brain2-habits-store`. Habit cells become rows keyed `habitId:period` (`applyHabitCells` already treats them this way). This removes `mergeCompletionMaps` and `contentRev`.
2. The other patchable vaults: planned actions, sleep, goals, health import, ingest, telegram feed, plan text.
3. Append-only logs: `points-store`, reviews, metrics, regret, affirmation log, item activity. Each entry is a row. Only `append` and `remove` are accepted.
4. The 860 small keys go to `kv`. A write carries the version it read. Theme and appearance keys are per-device by default, which removes the appearance pins and `appearanceRev`.
5. Friend photos and other bytes already live in IndexedDB. They move in Stage 7.

Done when: no vault accepts a whole-blob write and `/api/persist` `PUT` and `POST { name, value }` are deleted.

### Stage 6 — Retire the guard (S, after two quiet weeks)

Delete by group once the stage that replaces it is done.

| Guard group in `lib/vault-guard.js` | Replaced by | Deleted after |
| --- | --- | --- |
| `shouldRejectVaultShrink*`, `shouldRejectHubLogShrink`, `rowsMissingMass`, `patchRemovesMass`, `tombstonesReplayMass` | Removal only by `remove` op | Stage 5 |
| `shouldRejectInboxResurrection*`, `overlayClarifiedTasks` | Field merge on the row | Stage 4 |
| `unionPersistSnapshots*`, `unionRowsById`, `unionScopeList`, `unionEntryIds`, `unionIngestEvents`, `unionTelegramFeedRows`, `unionPlanTextSnapshots` | Rows and appends never need a union | Stage 5 |
| `mergeCompletionMaps`, `overlayHabitCompletions*`, `contentRev*`, `shouldRejectContentDowngrade*` | Habit cell rows with `version` | Stage 5.1 |
| `appearanceRev*`, `stampAppearancePins*`, `applyAppearancePins`, `overlayLocalUserPrefs`, `shouldRejectAppearanceDowngrade*` | Per-device `kv` | Stage 5.4 |
| `pickPersistItem`, `mergePersistSnapshots`, `overlayLocalTrackingNotes` | One owner, so there is nothing to pick between | Stage 4 |
| Ingest allowlist merges | `kv` with versions | Stage 5.2 |
| Friend photo reconcile and dismissals | Rows per card | Stage 5 |
| `applyVaultPatch` and the `apply*Patch` functions | Kept. Moved to `lib/sync-server/apply.js` as the op appliers. | — |
| `foldInstagramAccountCopies` | Kept as a one-time repair script. | — |

Also deleted: the hub seeding in `electron/preload.js`, `electron/persist-hub-cache.js`, the hub-follow and stamp-poll code in `lib/persist-storage.ts`, `lib/hub-stamp-watch.ts`, `lib/mobile-sync.ts` with `scripts/sync-api.mjs` (the `admin`/`admin` route), and the `cogs-*` dual writes in `lib/storage-keys.ts`.

The hourly `auto-<vault>-<hour>.json` journal is replaced by the `ops` table plus nightly snapshots. Restore to any point is a snapshot plus a replay of ops up to that time. Settings → Restore keeps reading the old files.

### Stage 7 — One schema, bytes, and stores that emit ops (L, can wait)

1. One `schema_version` in `meta` and one migration runner on the server. A store's `persist` version stops changing once its vault is migrated. A client older than the server's minimum is told to update and can still read.
2. Attachments, Docs HTML and images go to `blobs` by hash.
3. Stores send named ops directly instead of the diff producing them. Start with `dispatchItemMutation` and grow it into the one write door. Undo (`action-history.rememberWorld`) becomes "send the inverse ops", and "BIM did this" becomes a query on `ops`.

Stage 7.3 is the command bus in the audit. It is not needed to retire the guard, because the diff already yields correct row-level ops. It is what makes undo, traces and the activity log fall out of one table.

## Risks

- **Derived syncs write in bursts.** `habit-tracking-sync`, `sleep-sync` and `people-sync` recompute after stores fill. On a half-loaded client they produced the 2026-10-30 patch. Keep the phone's rule in the shared client: ops stay off until the first snapshot has landed and the derived syncs have settled (`settleWithoutPatches`).
- **Two processes open the hub today** (the dev server and `phone:hub` both import `persist-api.mjs`). With SQLite both may open the file, but `seq` must come from the database inside the transaction, never from memory.
- **Old clients.** A phone build from before a stage will still send the old patch shape. Keep `POST /api/persist { patch }` as an alias of `/api/ops` until the phone app is reinstalled.
- **Undo across stores** can remove dozens of rows at once. That is now legal. It is logged, not blocked.
- **The Mac asleep.** Nothing here changes that the phone needs the Mac or the relay. The outbox already covers writes. Offline reads use the IndexedDB cache. The home server in `ORACLE_INTERIM_SYNC.md` is still the fix.
- **Moving the owner later.** The database is one file. Moving it to the home server is a copy plus a new `epoch`, which makes every client take a fresh snapshot.

## Open questions for you

1. Flip `BRAIN2_STORE=sqlite` now (Stage 1)? The doc leaves this to you.
2. Should theme and appearance be per-device (Stage 5.4), or follow you across devices?
3. How long to keep `ops`: 90 days, or forever (it is small next to the vault)?
