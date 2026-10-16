# CI green plan

_Last mapped: 2026-10-16_

A plan to get `.github/workflows/ci.yml` green and keep it there. It checks an outside health report against the code at `98f1475`. Status: **Planned**. Nothing here is done yet.

CI runs `npm ci`, `tsc --noEmit`, `npm test`, `npm run build`. Today it stops at `tsc`.

---

## What the report got right, and what it got wrong

_Last mapped: 2026-10-16_

| Claim | Verdict | Note |
|-------|---------|------|
| `tsc` fails with ~367 errors | **True** (368 now) | 216 app, 85 test, 67 `scripts/`. Most come from five root causes (Phase 1). |
| 40 test failures in 20 files | **True** | See _Test run_ below for the current count. |
| Title vs description is an open decision | **Already decided** | `docs/CANONICAL_FIELDS.md` says `title` is the field of record and `description` is a pure mirror (persist v18). The failing tests are the stale side. |
| Extra `cooking` tag is a model question | **Real bug** | See Phase 0. |
| List-length goal 1 instead of 5 | **Clock drift, not a model change** | The test passes `now` but not `clock`. `clock` defaults to today, so the week reads as finished. It passed last week. |
| `item-type-store` may lose data | **No data loss** | The `friend` type rehydrates. Only the rewritten blob's `version` stays 0 under the aliased key. Low priority. |
| `.png` imports have no types | **True, wrong cause** | `next-env.d.ts` is gitignored and only `next build` writes it. CI runs `tsc` before `build`, so it never exists there. |
| `backup.ts` store types no longer fit | **True, one cause** | The local `PersistApi` in `lib/data/backup.ts:~119` types `merge` as `(unknown, unknown)`. Zustand's is `(unknown, S) => S`. One fix clears all 35. |
| `"latest"` deps break a fresh install | **Overstated** | `npm ci` uses the lockfile (zustand 5.0.5, recharts 2.15.3, date-fns 3.6.0). The risk is the next `npm install`. Still worth pinning. |
| Live weather and places tests | **True** | `lib/weather-flight.test.ts:~64`, `lib/places-search.test.ts:~25`. |
| Demo vault is thin and unchecked | **True** | Seeds about 18 stores. Nothing parses it through `lib/data/schemas.ts`. Some blobs use hard-coded versions (`user-settings` at 2, the store is at 5). The old migrations still run, so this is drift, not loss. |

---

## Phase 0 — Fix the real bug first

_Last mapped: 2026-10-16_

**Tagged-count habits count their own log row.**

- `lib/habit-done-log.ts:~83` adds the habit's tag (for example `cooking`) to the habit's weekly done-log row.
- `countTaggedDoneTasks` in `lib/habit-tagged-count.ts:~58` counts every done task with that tag, and that includes the log row.
- Proof: two cooking tasks give 2. One more `syncTaggedTaskCounts` gives 3. Deleting a task leaves 2, not 1.
- Fix: skip rows whose id is a `habitDoneLogId(...)` in the count. Keep the tag on the log row if it is wanted for search. Then update the test to expect `["habit", "cooking"]`, and add a resync assertion that the count stays at 2.

---

## Phase 1 — `tsc` green

_Last mapped: 2026-10-16_

Do these in order. Each one should drop the count sharply.

1. **Keep `scripts/` out of the app typecheck (67).** Add `scripts` to `exclude` in `tsconfig.json`. Give `scripts/` its own `tsconfig.json` (target `es2022`, `allowImportingTsExtensions`) if it should be checked at all.
2. **Image module types (~20).** Commit a small `types/images.d.ts` with `declare module "*.png"` (and `*.jpg`, `*.webp`), or add `next typegen` before `tsc` in CI. Prefer the `.d.ts` because it also works locally before the first build.
3. **`lib/data/backup.ts` (35).** Make `persistRehydrate` generic over the store state, so `merge` takes `(persisted: unknown, current: S) => S`.
4. **`lib/ingest/parse-tracking-note.ts` (54) → `apply-discrete-event.ts` (36).** The nested `withLocation(withCertainty(withNote({...})))` calls infer `T` from the contextual return type, not from the literal. Type the literal (`const row: PointNote = {...}`) or give the helpers explicit type arguments. The `never` errors in `apply-discrete-event.ts` should then go away, because `parseLogPayload` gets a real return type again. Re-check after.
5. **`tests/test-utils.tsx:~95`.** Add `quarterly: {}` to `habitExemptions`. Better: build it with `emptyExemptionBooks()` from `lib/habit-exemption.ts:~214`, so the next period added can't be missed.
6. **The rest (~60 app, ~80 test).** `lib/weather-client.ts` (one `hourlyIn` guard), `lib/reminders.ts`, `lib/habit-completion-summary.ts`, `lib/needs-attention.ts`, `components/Home/Goals/ObjectiveDetailDialog.tsx`, `lib/ingest/*`. Test files mostly have old fixture shapes. Phase 3 removes the cause.

`next.config.mjs` keeps `ignoreBuildErrors: false`. Don't turn it on to get green.

---

## Phase 2 — Tests green

_Last mapped: 2026-10-16_

**Update the test (the code changed on purpose):**

- `lib/task-store.titles.test.ts`: "never rewrites description from title" and "does not rename a parked note" should expect v18 behavior. Prose goes in `body`, and `description === title`.
- `lib/ingest/apply-iphone-notes.test.ts`: same seam. Note text is read from `body`.
- `components/Lists/__tests__/enhanced-list-view.integration.test.tsx` (13): list settings became a tabbed sheet on 10-15 (`docs/LIST_SETTINGS_REDESIGN.md`). Query the new tabs.
- Renamed labels: `home-overview`, `enhanced-analytics`, `OperationsView`, `daily-task-form`, `SheetGrid`, `habit-led-lamp` (`var(--r-2, 2px)`).

**Fix the code (a guard caught it):**

- `lib/item-title-reads.test.ts`: `components/Home/Tracking/daylog-week.tsx` and `lib/ingest/apply-media.ts` read the name off `description`. Switch them to `itemTitle()`.
- `components/UiNames/ui-names-stamps.test.ts`: put `data-ui-name` back on `home-dashboard.tsx` and `tracking-view-settings-dialog.tsx`.
- `lib/habit-tagged-count.test.ts`: Phase 0.

**Make the test deterministic:**

- `lib/habit-missed-opportunity.test.ts:~185`: pass `clock` (or `vi.setSystemTime`).
- `lib/item-type-store.test.ts`: decide whether the aliased key should be rewritten with the new version. If not, drop the last assertion.
- `lib/weather-flight.test.ts`, `lib/places-search.test.ts`: run the `(live)` blocks only when `LIVE_TESTS=1` (`describe.runIf`).
- `home-moon-orrery` timeouts: find the slow path before raising the timeout.
- Clock rule: a test that reads a date should call `vi.setSystemTime` or pass every clock argument. `printedGoalAmounts(now, clock)` shows why both are needed.

---

## Phase 3 — Keep it green

_Last mapped: 2026-10-16_

- **Pin** the six `"latest"` entries in `package.json` to the lockfile versions (`^5.0.5`, `^2.15.3`, `^3.6.0`, and each Radix package at its installed major; `react-label` is on 2.x).
- **Shared fixtures.** Add `tests/fixtures.ts` with `makeTask`, `makeList`, `makeHabit`, `makeEntry`. 96 test files define their own `task()` today. Move a file over when you touch it, not all at once.
- **CI order.** Run `tsc` and `vitest` as separate jobs so one red step doesn't hide the other.
- **CI scope.** It runs on pushes to `main`/`master` and on PRs. Work on `claude/*` branches without a PR is never checked.

---

## Phase 4 — Demo vault

_Last mapped: 2026-10-16_

- **Versions.** In `lib/demo-vault.ts`, write each blob with the store's exported version constant, not a literal. Export the constant where a store still uses a literal.
- **Schema check.** In `lib/demo-vault.test.ts`, run the seeded task snapshot through `taskStoreSnapshotSchema` (`lib/data/schemas.ts:~192`). Rehydrate each seeded store and assert row counts survive, so a missing `migrate` shows up.
- **Coverage.** Add seeds for rooms that open empty: session planner, vocab, reminders, birthdays, cycle marks, step prerequisites, affirmation log. Follow `lib/demo-corpus/README.md` (River Hale persona). Add them to `coverCurrentWeek` only where a day can be empty.

---

## Later

_Last mapped: 2026-10-16_

- Repo weight: `.git` 591 MB, `public/` 389 MB, `designrefs/` 39 MB. Git LFS, or keep source art out of the repo. Needs a history decision. **Do not start** without asking.
- Playwright has 2 specs (`e2e/`) and CI doesn't run them. Add a smoke spec for Demo after Phase 4.
- Smaller commits. A 107-file commit is how tests and types drifted this far.

---

## Test run

_Last mapped: 2026-10-16_

Targeted run of the files the report named: 10 failures in 7 files, matching the report. The full-suite count is still to be confirmed.
