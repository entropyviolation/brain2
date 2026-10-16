# CI green plan

_Last mapped: 2026-10-16_

CI (`.github/workflows/ci.yml`) runs three checks in order: `npx tsc --noEmit`, `npm test`, `npm run build`. All three must pass.

The first version of this doc was written in another session and never reached this checkout. This version is rebuilt from fresh runs.

Why it matters beyond CI: `next build` fails on the same type errors. Until it passes there is no production build, so the faster `npm run electron:local` mode from the speed plan cannot ship.

## Where it stands

| Check | 2026-10-16 start | After steps 1–4 |
| --- | --- | --- |
| `tsc --noEmit` | 350 errors (was 368 in the earlier report) | 163 errors |
| `vitest run` | 40 tests fail in 23 files | Same failures. No new ones from these steps. |
| `next build` | Fails on type errors | Not run yet |

The test run on 2026-10-16 also showed 5 extra files failing to load: `lib/data/backup.test.ts`, `tests/integration/backup-restore.test.ts`, `lib/vault-coverage.test.ts`, `lib/mobile-sync.test.ts`, `app/page.test.tsx`. All of them fail because `lib/vocab-words.ts` imports `lib/vocab/bank-ipa.json`, which does not exist yet. That is uncommitted vocab work from another session, not these steps. Rerun them once that work lands.

## Steps

### Done

1. **`lib/ingest/parse-tracking-note.ts` (54 errors).** `withNote`, `withCertainty` and `withLocation` were generic over their own field. Nested calls lost the row type and fell back to the bare constraint. They now take `<const T extends object>` and return `T & { field? }`. Same runtime behavior.
2. **`lib/ingest/apply-discrete-event.ts` (36 errors).** `Extract<LogNote, { shape: "start" }>` was `never`, because `BoundNote.shape` is `"start" | "end"`, not two members. `paintLogStart` and `paintLogEnd` now take `BoundNote`. The keyword-list reply was missing its required `summary`.
3. **`lib/data/backup.ts` (35 errors).** `PersistApi` typed `merge` as `(unknown, unknown) => unknown`, which no real Zustand store matches. It is now `PersistApi<S>`, and `persistRehydrate` is generic.
4. **`scripts/phone-hub.ts` (67 errors).** This was untyped JS in a `.ts` file. Imports drop the `.ts` extension (jiti still resolves them). Functions and module state are typed. Startup moved from top-level `await` into `main()`, because jiti loads the file as CommonJS. Not run against Telegram, since that needs the bot token. The jiti transform and import resolution were checked.

### Next

5. **Test files (85 errors).** Most are stale fixtures: missing new required fields, or mocks typed against old signatures. Biggest: `components/Home/Habits/habit-source-detail.test.tsx` (11), `components/Home/Habits/daily-task-form.test.tsx` (11), `lib/pen-tree.test.ts` (5), `lib/ingest/telegram-ui.test.ts` (5), `components/Home/Habits/task-grid.test.tsx` (5).
6. **App code (78 errors, long tail).** Biggest: `lib/weather-client.ts` (11), `lib/ingest/apply-ritual.ts` (4), `lib/habit-completion-summary.ts` (4), `components/Home/Goals/ObjectiveDetailDialog.tsx` (4), `lib/vocab-lists.ts` (4, new and in progress). Most other files have 1–3 errors.
7. **Failing tests (40 in 23 files).** Several are in files with uncommitted edits right now (`lib/session-plan*`, `lib/next-step`, `components/Home/ToDo/SessionPlanner*`, `components/Home/home-overview`). Fix those after that work is committed, so the fix targets the final code. Already failing before any of this: `lib/ingest/apply-iphone-notes.test.ts` (2), `components/notes-ingest.test.tsx`.
8. **`next build`.** Run it once `tsc` is clean, and fix anything build-only (route types, server/client boundaries).
9. **Keep it green.** Once all three pass, a red CI blocks merges.

To recount at any time:

```bash
npx tsc --noEmit -p . 2>&1 | grep -c "error TS"
```
