# `lib/data/mongo/` — MongoDB Atlas cloud sync target (Phase 11 groundwork)

Driver-agnostic scaffolding for COGS's future **cloud sync target**: **MongoDB
Atlas** (spec §3, replacing the original SQLite suggestion). Nothing here imports a
Mongo driver yet — these are the document model (`collections.ts`), the
`DataSource` skeleton (`mongo-data-source.ts`), and this index/transaction plan.

> **Direction (see [`../../../docs/ROADMAP.md`](../../../docs/ROADMAP.md)).** COGS
> is **offline-first**: the local store on each client is the working source of
> truth. Mongo is **not** a desktop-local datastore and does **not** replace
> localStorage — it is the **remote** side of an opportunistic `SyncingDataSource`
> that reconciles in the background when online so devices (including a future
> mobile app) converge. Conflict resolution starts as per-field last-write-wins
> (upgradeable to RxDB / PowerSync / Atlas Device Sync). `MongoDataSource` is the
> `RemoteDataSource` impl; it can be reached over any transport (e.g. the existing
> Electron IPC bridge in `electron/ipc/`, repurposed for the remote side), never
> as the app's primary store.

## Files

| File | Purpose |
|------|---------|
| `collections.ts` | Collection names, document shapes (`_id` strategy), and the index plan. No driver import. |
| `mongo-data-source.ts` | `DataSource` skeleton; every method stubbed with `// TODO(phase-11):` notes. No driver import. |
| `README.md` | This migration/index/transaction plan. |

## Collections & document mapping

One collection per entity family (`tasks`, `categories`, `folders`, `reviews`,
`points`, `plans`). COGS entities are already document-shaped (flexible
`attributes`, embedded `links`/`subtasks`), so the Mongo document is essentially
the domain object with the app's existing **string `id` promoted to `_id`**. We
do **not** use `ObjectId`: ids already appear in `links.targetId`,
`dependencies`, `parentTaskId`, and `categories[]`, so reusing them keeps every
cross-reference valid with no translation table.

- `plans` unifies the discrete localStorage plan keys (`dayPlan-*`, `weekPlan-*`,
  `monthPlan-*` from `lib/plan-text.ts`) into one collection, `_id =
  `${period}:${periodKey}`` (upsert in place).
- `points` stays one document per ledger entry to preserve the append-only audit
  trail.

## Validation at the boundary

Reuse the existing Zod schemas (`lib/data/schemas.ts`: `taskSchema`,
`taskCategorySchema`, `categoryFolderSchema`, `parseOrThrow`) on every write
before it hits a collection — the same schemas the renderer and backup/restore
already use. `dateLike` coercion means ISO strings or `Date`s both validate, so
BSON dates and JSON-over-IPC payloads are handled uniformly.

## Index plan (see `INDEXES` in `collections.ts`)

- **tasks**: `tags` (multikey, powers `byTag`); `links.targetId + links.relation`
  (backlinks / linked items); `category + completed` (lifecycle); `categories`
  (list membership); `scheduledDate` and coarse `scheduledWeek/Month/Year`
  (Scheduler); `deadline`; `dependencies`; plus a **text index** on
  `description/title/notes` for global fuzzy search (spec §3).
- **reviews** & **plans**: unique `{ period, periodKey }`.
- **points**: `date`, `taskId`. **folders**: `parentFolderId`, `categoryIds`.

## Transaction plan

`DataSource.transaction(fn)` becomes a real Mongo session
(`session.withTransaction`). The handle (`DataSourceTransaction`) carries the
driver `session` so enlisted collection calls are atomic. Workflows that REQUIRE
it (also flagged in `mongo-data-source.ts`):

1. **tag rename/merge** — rewrite `tags[]` across many tasks in one unit.
2. **link symmetry** — write the forward link and its inverse backlink
   (`inverseRelation`, `lib/links.ts`) together so the graph is never half-linked.
3. **review carry-over** — persist the review doc and apply its
   `resolvedTaskIds`/`pushedTaskIds` mutations atomically.
4. **module instantiation** — create a module's items and their links together.
5. **cascading deletes** — removing a task/category strips inbound
   links/dependencies/membership in the same transaction.

> Note: transactions require a replica set (or `mongod` started as a single-node
> replica set). The migration step documents enabling this for local installs.

## Migration plan (localStorage → Mongo)

1. **Export** the current state with the existing `lib/data/backup.ts`
   (`createBackup()`), which already enumerates every persisted store + plan
   text. This is the canonical snapshot format.
2. **Import** by reshaping each backup section into its collection:
   task store → `tasks`/`categories`/`folders`; reviews store → `reviews`;
   points store → `points`; `planText[*]` → `plans` (parse the `dayPlan-`/
   `weekPlan-`/`monthPlan-` key into `{ period, periodKey }`). Validate each doc
   with the Zod schemas; promote `id → _id`.
3. **Create indexes** from `INDEXES` after the bulk load.
4. **localStorage stays the offline-first source of truth**: `LocalDataSource`
   remains the working store. A `SyncingDataSource` wraps it and, when online,
   reconciles against the remote `MongoDataSource` (reached over a transport such
   as `IpcDataSource`) in the background — pushing a queued-writes outbox and
   pulling remote changes (per-field last-write-wins). Atlas is the convergence
   point across devices, not a replacement for the local store.
5. **Round-trip export** stays available: a Mongo → backup-JSON dump reuses the
   same `Backup` shape for portability (spec §3.2 one-click export/import).

## Remaining wiring TODO

- Install the driver: `npm i mongodb` (NOT done here — would break typecheck).
- In `collections.ts`/`mongo-data-source.ts`, replace `MongoDbHandle = unknown`
  with `import type { Db } from "mongodb"` and fill each stubbed method.
- Stand up `mongod` (single-node replica set for transactions) or Atlas; manage
  the connection lifecycle in `electron/main.js` (see `electron/ipc/README.md`).
