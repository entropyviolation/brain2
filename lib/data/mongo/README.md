# `lib/data/mongo/` — unwired Mongo sketches (speculation)

Driver-agnostic sketches of a Mongo document model. **Not the storage plan.**
Nothing here imports a Mongo driver — `collections.ts` and
`mongo-data-source.ts` (every method throws) are scaffolding only. The sync
that exists is the manual phone hub (`lib/mobile-sync.ts`). Atlas, a shared
`@brain2/core` package, and an Expo app are speculation.

> **See [`../../../docs/SPEC_MAPPING.md`](../../../docs/SPEC_MAPPING.md) §3.**
> Brain2 is **offline-first**: localStorage is the working source of truth.
> These files do not replace it and are not scheduled work.

## Files

| File | Purpose |
|------|---------|
| `collections.ts` | Collection names, document shapes (`_id` strategy), and the index plan. No driver import. |
| `mongo-data-source.ts` | `DataSource` skeleton; every method stubbed with `// TODO(phase-11):` notes. No driver import. |
| `README.md` | This file. The shapes below are speculation, not a scheduled migration. |

## Collections & document mapping

Speculation only. Nothing below is wired, and none of it is the storage plan.

One collection per entity family (`tasks`, `categories`, `folders`, `reviews`,
`points`, `plans`). Brain2 entities are already document-shaped (flexible
`attributes`, embedded `links`/`subtasks`), so the Mongo document is essentially
the domain object with the app's existing **string `id` promoted to `_id`**. We
do **not** use `ObjectId`: ids already appear in `links.targetId`,
`dependencies`, `parentTaskId`, and `categories[]`, so reusing them keeps every
cross-reference valid with no translation table.

- `plans` unifies the discrete localStorage plan keys (`dayPlan-*`, `weekPlan-*`,
  `monthPlan-*` from `lib/plan-text.ts`) into one collection, `_id =
  `${period}:${periodKey}`` (upsert in place). Each key is a JSON log of
  stamped entries; `PlanDoc.text` is the formatted dump and `entries` is the
  native log for Phase 11.
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

## Sketch of a migration (not scheduled)

These steps are not the plan. The sync that exists is the manual phone hub.

1. **Export** the current state with the existing `lib/data/backup.ts`
   (`createBackup()`), which already enumerates every persisted store + plan
   text. This is the canonical snapshot format.
2. **Import** by reshaping each backup section into its collection:
   task store → `tasks`/`categories`/`folders`; reviews store → `reviews`;
   points store → `points`; `planText[*]` → `plans` (parse the `dayPlan-`/
   `weekPlan-`/`monthPlan-` key into `{ period, periodKey }`, keep the JSON
   entry log). Validate each doc
   with the Zod schemas; promote `id → _id`.
3. **Create indexes** from `INDEXES` after the bulk load.
4. **localStorage stays the working store.** A background reconcile against
   Atlas would be speculation. Do not treat it as scheduled.
5. **Round-trip export** stays available: a Mongo → backup-JSON dump reuses the
   same `Backup` shape for portability (spec §3.2 one-click export/import).

## If someone later wired a driver (not scheduled)

- Installing `mongodb` is not current work.
- In `collections.ts`/`mongo-data-source.ts`, replace `MongoDbHandle = unknown`
  with `import type { Db } from "mongodb"` and fill each stubbed method.
- Stand up `mongod` (single-node replica set for transactions) or Atlas; manage
  the connection lifecycle in `electron/main.js` (see `electron/ipc/README.md`).
