# Split `SessionPlanner.tsx`

_Last mapped: 2026-10-27. Shipped. The door is still `components/Home/ToDo/SessionPlanner.tsx`. The views live in `components/Home/ToDo/session-planner/`._

Pure structural extraction of `components/Home/ToDo/SessionPlanner.tsx` as it exists in the working tree on 2026-10-27 (2316 lines, including uncommitted edits). The popup, the fascia keys, and every string and class stay the same. Session planner remains its own UI.

Logic stays in `lib/session-plan.ts`. The blob stays in `lib/session-plan-store.ts`. Styles stay in `components/Home/ToDo/session-planner.css`. Nothing under `components/Modules` moves.

## Why this shape

The file is one dialog that switches views. Two views are the bulk: `DraftView` (lines 601–1135, about 535 lines) and `RunView` (lines 1328–1867, about 540 lines). The other views and the small widgets are already their own functions. Move those functions into `components/Home/ToDo/session-planner/`. Leave each function’s body as it is.

A second public door (`index.ts` in the new folder) would collide with a sibling split of `todo-panel.tsx` or `todo-phone-page.tsx` if that split also drops files beside `SessionPlanner.tsx`. New modules go only in `session-planner/`. Callers keep importing from `components/Home/ToDo/SessionPlanner.tsx`.

## Responsibilities today

`SessionPlanner` is the popup (`data-ui-name="Session"`). It picks the live session, the focused one, or a new draft, and it switches **Pick list**, **Sessions**, draft, run, parked, and review. Closing a running session asks **Park** or **Keep running**.

| Piece | Lines | Job |
| --- | --- | --- |
| `fmtMinutes`, `fmtClock`, `parseLength` | 151–167, 467–480 | Minute words, countdown words, typed length (`90`, `1:30`, `1h30`, `1h 30m`, `1.5h`, `45m`) |
| `useNow` | 169–184 | One-second clock. Skips the tick while `document.hidden` |
| `SessionPlanner` | 186–371 | Dialog, caption, close-while-running strip, view switch |
| `newDraftFrom`, `findTemplate`, `newDraft`, `putSession` | 374–434 | Create and store a session. `putSession` calls `releasePenClock` on whatever the store bumped aside |
| `FutureNoteInput`, `FutureNoteBanner` | 392–412 | Optional note to later-you |
| `TierKeys`, `TimeTube`, `FitGlass` | 438–599 | Draft tier latch keys, Dash length tube, one fit bar |
| `DraftView` | 601–1135 | Pick list, three tier wells, drag, templates, timebox, breaks, **Padded for you**, **Break down** via `TodoBreakdown`, Start |
| `FlatListView` | 1144–1210 | Fascia **Pick list**. No session until **Session** or **Just 25** |
| `lineEst`, `EstEdit`, `EstDelta`, `EstBar` | 1215–1277 | Frozen or live estimate, click-to-edit, under/over words, hairline bar |
| Session view prefs | 1280–1317 | `brain2.sessionView` in `localStorage`. Clock colour, hide finished, estimate bars |
| `RunView` | 1328–1867 | Countdown, transport, pause reason when the pen is running, park, end-of-sitting, break, suggestions, tier lines, Just Start portal |
| `ParkedView` | 1871–1982 | Parked clock, line list, parking-lot stage, Resume |
| `sessionStamp`, `ShelfRow`, `ShelvesView` | 1986–2093 | Drafts / Parked / Done shelves |
| `DoneView` | 2096–2142 | Read-only review of a finished session, **Run again** |
| `ReviewView`, `writeSessionTimeLogs` | 2146–2265 | Outcomes, points, Plan block (`source: "session"`), time logs, archive |
| `SessionKey`, `SessionsKey`, `PickListKey` | 2267–2315 | Fascia keys. `SessionKey` ticks on its own |

`TIER_LABEL`, `TIER_SHORT`, and `TIER_LETTER` (lines 142–144) are shared copy: Bare minimum / Goal / Exceptional, Min / Goal / Exc, B / G / E.

Drag payloads (lines 147–149) are `application/x-b2-session-line` and `application/x-b2-session-ref`. `isSessionDrag` only looks at those two types.

`DraftView`’s props type includes `history`. The dialog passes it (line 359). The function does not read it. Keep the prop on the type and on the call.

## Stable exports

These stay importable from `components/Home/ToDo/SessionPlanner.tsx`. The door re-exports them. Do not add new names to that list. Internal helpers (`putSession`, `newDraft`, the MIME strings, `useNow`) stay unexported from the door.

| Export | Moves to | Imported today by |
| --- | --- | --- |
| `SessionPlanner` | `session-planner/dialog.tsx` | `todo-panel.tsx`, `todo-phone-page.tsx`, `SessionDock.tsx`, both SessionPlanner tests |
| `SessionKey` | `session-planner/fascia-keys.tsx` | `todo-panel.tsx`, `todo-phone-page.tsx`, `todo-mobile.tsx` |
| `SessionsKey` | `session-planner/fascia-keys.tsx` | same three |
| `PickListKey` | `session-planner/fascia-keys.tsx` | `todo-panel.tsx`, `todo-phone-page.tsx` |
| `fmtMinutes` | `session-planner/format.ts` | only this module, but it is a public export |
| `fmtClock` | `session-planner/format.ts` | only this module. `lib/house-cleaning.ts` has a different `fmtClock`. Leave that one alone |
| `parseLength` | `session-planner/format.ts` | `SessionPlanner-h2.test.tsx` |
| `SESSION_CLOCK_DEFAULT` | `session-planner/session-view-prefs.ts` | only this module (`#8cd4a5`) |

The door file:

- Keeps `"use client"`.
- Keeps the side-effect import of `./session-planner.css`, so a caller that only imports `SessionKey` still loads the sheet (that is how the single module works today).
- Re-exports the eight names above.
- Holds a short header that points at `session-planner/`. The long header comment moves onto `dialog.tsx` with its text unchanged.

No `session-planner/index.ts`.

## New files

Paths are under `components/Home/ToDo/session-planner/`. Each row is one existing function, or a tight group that already sits together. Move the function text verbatim. Adjust import paths only.

| File | What moves |
| --- | --- |
| `format.ts` | `fmtMinutes`, `fmtClock`, `parseLength` |
| `tiers.ts` | `TIER_LABEL`, `TIER_SHORT`, `TIER_LETTER` |
| `drag.ts` | `LINE_MIME`, `REF_MIME`, `isSessionDrag` |
| `use-now.ts` | `useNow`, including the `visibilitychange` listener and the hidden-tab guard |
| `drafts.ts` | `newDraftFrom`, `findTemplate`, `newDraft`, `putSession` |
| `future-note.tsx` | `FutureNoteInput`, `FutureNoteBanner` |
| `tier-keys.tsx` | `TierKeys` |
| `time-tube.tsx` | `TimeTube` |
| `fit-glass.tsx` | `FitGlass` |
| `draft-view.tsx` | `DraftView` whole, drag state included (`drop`, `dragging`, `dragRef`, `dropInto`) |
| `flat-list-view.tsx` | `FlatListView` |
| `estimate-bits.tsx` | `lineEst`, `EstEdit`, `EstDelta`, `EstBar` |
| `session-view-prefs.ts` | `SessionViewPrefs`, `SESSION_CLOCK_DEFAULT`, `SESSION_VIEW_KEY`, `SESSION_VIEW_DEFAULTS`, `readSessionView`, `useSessionView` |
| `run-view.tsx` | `RunView` whole, and the `Suggestion` type |
| `parked-view.tsx` | `ParkedView` |
| `shelves-view.tsx` | `sessionStamp`, `ShelfRow`, `ShelvesView` |
| `done-view.tsx` | `DoneView` |
| `review-view.tsx` | `ReviewView`, `writeSessionTimeLogs` |
| `fascia-keys.tsx` | `SessionKey`, `SessionsKey`, `PickListKey` |
| `dialog.tsx` | `SessionPlanner` |

`session-planner.css` stays at `components/Home/ToDo/session-planner.css`. Parking lot stays in `components/Home/ToDo/parking-lot/`. `ParkedView` keeps importing `ParkingLotModeKeys` and `ParkingLotStage` from there.

From a file inside `session-planner/`, sibling To Do modules are `../TodoBreakdown`, `../use-todo-time`, `../todo-prefs`, and `../../dash/dash-primitives` (`SegDigits`). Parking lot is `../parking-lot/ParkingLot`.

Put `"use client"` on every new file that uses hooks or `window` / `document`. `format.ts`, `tiers.ts`, `drag.ts`, and `drafts.ts` do not need it. They are only imported from client modules.

## What stays inside the two big views

`DraftView` and `RunView` move as whole functions. Their inner JSX shares one closure. Splitting that JSX into new components means a new props bag. That is where a silent behavior change sneaks in. Do not do it in this split.

Inside `draft-view.tsx`, leave these blocks in `DraftView`:

- Head (`ses-draft-head`): name, length caps, `TimeTube`, Timebox, Breaks, template select, floor suggestion. It closes just before `todo-session-panes`.
- Pick pane (`section.todo-session-pick`): scope, search, Available now, Unestimated, task and step rows, tier keys, drag-out.
- Wells (`section.todo-session-tiers`): drop index, missing-prereq note, break readout, **Padded for you**.
- **Break down** (`TodoBreakdown`) and the action row (Paint on Tracking, Save as template, Clear, Start).

`source`, `toggle`, `setEstimate`, and the drag handlers stay in `DraftView`. Children must not recompute fit, pace, or the pick list.

Inside `run-view.tsx`, leave the hero, the park strip, the break strip, `SittingEnd`, suggestions, and the tier line list in `RunView`. They share `holdOrGo`, `play`, `stop`, `finishStepOf`, `saveLineEst`, `saveStepEst`, `offer`, `park`, `end`, `endToStrip`, `openSteps`, `suggest`, and `useSessionView`. The line list is the part that must not be carved out.

`FlatListView` and the draft pick list both list open steps. They rank with `startOrderFor` in the flat list only. They stay two functions. Do not merge them.

## Extraction order

Cut one function, point the old file at the new module, then the next. The app should still typecheck after each step because the door keeps the public names. Line numbers below match the working tree on 2026-10-27. After the first move, follow function names.

1. `format.ts`, `tiers.ts`, `drag.ts`. Re-export `fmtMinutes`, `fmtClock`, and `parseLength` from the door as soon as they leave.
2. `use-now.ts`, `future-note.tsx`, `session-view-prefs.ts`. Re-export `SESSION_CLOCK_DEFAULT`.
3. `tier-keys.tsx`, `time-tube.tsx`, `fit-glass.tsx`, `estimate-bits.tsx`.
4. `drafts.ts` (`putSession` and `findTemplate` before any view that calls them).
5. `flat-list-view.tsx`, `done-view.tsx`, `shelves-view.tsx`, `fascia-keys.tsx`.
6. `parked-view.tsx`, then `review-view.tsx`.
7. `draft-view.tsx`. Keep the unused `history` prop.
8. `run-view.tsx`. This step carries the uncommitted pause-reason code. Move the working-tree function, not the copy in HEAD.
9. `dialog.tsx`. The old path becomes the door: `"use client"`, the CSS import, the eight re-exports, a short header.

After step 8, run the two UI test files. After step 9, run the full test list below.

Do not reformat the moved JSX. Do not sort the body. Do not rename a class, a handler, or a state variable. An import-path edit is the change. If an editor rewrites quotes or wrapping, the tags, class names, and string literals still match the source you cut.

Keep these comments with the code they describe:

- The open-effect `eslint-disable` for `react-hooks/exhaustive-deps` (dialog, around line 230).
- The pen-clock effect’s matching disable (`RunView`, around line 1360).
- The Just Start `createPortal` comment: the dialog transform would trap a fixed overlay. The portal target stays `document.body`.
- The focus-bar `onInteractOutside` guard on `DialogContent`.

## Visual and behavior invariants

Nothing a person can see or do changes.

- DOM shape, class names, `data-ui-name="Session"`, `data-ui-help`, `data-ui-docs`, `data-no95`, roles, and `aria-*` labels stay byte for byte.
- Button labels, placeholders, titles, and empty copy stay byte for byte. That includes **Park**, **Keep running**, **Start**, **Clear**, **Run again**, **Back to mint**, **Padded for you**, **raw estimates**, **Nothing open here.**, **None.**, and the time-up sentences.
- Tier words stay Bare minimum, Goal, Exceptional. Stored tier id stays `exceptional`.
- MIME types, `localStorage` key `brain2.sessionView`, and default clock `#8cd4a5` stay.
- `useNow` still skips `setNow` while the document is hidden, and still listens for `visibilitychange`.
- Opening on `startOn="session"` still focuses the live session, else the focused open plan, else `newDraft()`. A `request` with a duration, template, or seed still calls `newDraftFrom` and returns. The effect still depends on `[open]` only.
- `startOn="shelves"` and `startOn="list"` still open those views.
- Closing (×, Esc, or dialog dismiss) while phase is `run` and the view is `session` still shows the ask strip. **Park** still parks with the note and closes. **Keep running** still closes without parking.
- `putSession` still stores through `useSessionPlanStore.getState().put(next, new Date())` and then `releasePenClock(bumped)`.
- Draft drag still uses `moveLine` for an existing line (index minus one when moving downward in the same tier) and `addLine` then `moveLine` for a pick-list drop.
- A lit tier key still removes that line. Pressing another tier still adds it.
- **Padded for you** still reads `sessionPadded`. On uses `sessionPaceFactor`. Off uses pace `1` and the words `raw estimates`.
- **Break down** still mounts `TodoBreakdown` in the draft. That is the lid’s steps editor, already used here. Do not swap in the task card or item detail. Decision 15 in `docs/TODO_REDESIGN.md` and `components/Home/ToDo/README.md` (“Three ways to edit a task stay separate”) still holds. Session planner does not become a fourth editor and does not absorb the other three.
- A task name in the draft pick list still calls `openTaskCard`.
- Run ▶ / ⏸ / ■ stay `DvdTransportKey` with the same `className`, `mark`, and `label`.
- `holdOrGo` stays the working-tree function: resume when paused; `pauseSession` immediately when `linkedPenIsRunning(plan)` is false; otherwise `pauseAsk.ask()`, and on a reason `queuePauseReason`, `pauseSession`, `takeQueuedPauseReason`. Cancel (no reason) leaves the clock running. `{pauseAsk.dialog}` stays rendered next to `{taskClock.picker}`.
- **End** still pauses and shows `SittingEnd` when the current or first open line has a task. Keep and Skip still call `end()`, which still `releasePenClock`s and `endSession`s.
- Just Start still portals to `document.body`.
- Parked resume still plays `scene.playResume` when a lot scene exists, then `resumeParked`. Classic (no scene) still resumes at once. A pick during `leaving` still does nothing.
- Review **Save session** still defaults a blank outcome to `keep`, adds points, pushes task lines chosen as **Push to tomorrow**, writes the Plan block with `source: "session"`, calls `writeSessionTimeLogs`, then `archive` and `onDone`.
- `SessionKey` still shows the live countdown, **Review session**, **Session (draft)** when the focused draft has lines, or **Session**, plus the parked count.

## Test plan

Search before and after:

```bash
rg -l 'SessionPlanner|parseLength' -g '*.test.ts' -g '*.test.tsx'
```

UI tests, import path unchanged (`./SessionPlanner`):

- `components/Home/ToDo/SessionPlanner.test.tsx` — draft, fit gauge, Start blocked until Bare minimum is estimated, run, review; Stop then **Next shortest task** and ▶; edit estimate and name while running; Park and Resume; close-while-running asks Park or Keep running; a second session parks the first; shelves and **Run again**.
- `components/Home/ToDo/SessionPlanner-h2.test.tsx` — floor suggestion, task card from a pick-list name, flat list then **Just 25**, park note, padded vs raw gauge, tier key unlatch, save as template, and `parseLength` (`90`, `1:30`, `1h30`, `1h 30m`, `1.5h`, `2h`, `45m`, `soon` → null, empty → null).

Library tests that must still pass and must not be edited for this split:

- `lib/session-plan.test.ts`
- `lib/session-plan-h2.test.ts`
- `lib/session-plan-run.test.ts`
- `lib/session-plan-store.test.ts`
- `lib/session-pen.test.ts`
- `lib/estimate-pace.test.ts`

Suggested run after the door is in place:

```bash
npx vitest run \
  components/Home/ToDo/SessionPlanner.test.tsx \
  components/Home/ToDo/SessionPlanner-h2.test.tsx \
  lib/session-plan.test.ts \
  lib/session-plan-h2.test.ts \
  lib/session-plan-run.test.ts \
  lib/session-plan-store.test.ts \
  lib/session-pen.test.ts \
  lib/estimate-pace.test.ts
```

The pause-reason branch is not covered by `SessionPlanner.test.tsx`. Do not add a test in this split. The existing pause path (pen not running) still calls `pauseSession` and the current tests cover Park and close-while-running.

Browser check after the tests, on the running app. Exercise the flows, not a single screenshot. Screenshots stay as they are: copy and classes do not change, so skip `npm run capture-screenshots`.

- Desk To Do: **Session**, **Sessions**, and the pick-list way in. Draft a line, drag it across tiers, Start, pause, stop, **+15**, End (sitting strip), Park, Resume, shelves, **Run again**, review Save.
- Phone page (`todo-phone-page.tsx` / `todo-mobile.tsx`): the same keys still open the same popup.
- A way in from outside To Do (`SessionDock`, a session-open request) still seeds a draft.
- Focus bar stays clickable over the open popup.
- Task card still opens from a draft pick-list name. **Break down** still uses the lid steps editor.

## Doc updates when the move lands

Update paths in the same step as the move. Say the door is still `SessionPlanner.tsx` and the views live in `session-planner/`. Behavior sentences stay; only the file locations change.

- `components/Home/ToDo/README.md` — file table row for `SessionPlanner.tsx`; the `use-todo-time.ts` row; the Phase 4 sentence that names `SessionPlanner.tsx`; Park (`putSession`); drag (`LINE_MIME` / `REF_MIME`); **Padded for you**; the pick-list task name opening the card. Add the new folder to the file table in the same style. Decision 15 stays word for word in substance.
- `components/Focus/README.md` — the planned-session **End** sentence that points at `SessionPlanner.tsx` run view. Point it at `session-planner/run-view.tsx`.
- `components/Home/Plan/README.md` — the session Plan block sentence. The write stays in `session-planner/review-view.tsx`.
- `lib/README.md` — `estimate-pace.ts` row: **Padded for you** is wired from `session-planner/draft-view.tsx`, still reached through `SessionPlanner.tsx`.
- `docs/TODO_REDESIGN.md` — the **Padded for you** bullet that names `SessionPlanner.tsx`.
- `docs/PERF_PLAN.md` — the hidden-tab guard on the 1s tick. That tick is `useNow` in `session-planner/use-now.ts`.
- `docs/tree.md` and `docs/tree.txt` — doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The new folder belongs in the To Do README and `session-planner/README.md`.
- `components/Home/ToDo/session-planner/README.md` — a short colocated readme: door file, file list, and the sentence that this folder is a split of the popup, with behavior documented in `components/Home/ToDo/README.md`. The house rule is a README in the folder you add.

Skip `docs/screenshots/`. Skip `docs/SPEC_MAPPING.md` and the root `README.md` unless a fresh search finds `SessionPlanner`. Skip `docs/README.md`; its table is a curated set of north-star docs, and this plan is not one of them. Skip `docs/BRAIN2_FEATURE_IDEAS.md`.

## Risks in the dirty working tree

`SessionPlanner.tsx` is modified and uncommitted. Against HEAD (`89f52f2`) the diff is +21 / −2, all inside `RunView`:

- Import `linkedPenIsRunning` from `lib/session-pen.ts` beside `releasePenClock`.
- Import `queuePauseReason` and `takeQueuedPauseReason` from `lib/work-pause.ts`.
- Import `usePauseReason` from `components/Home/Tracking/pause-reason-dialog.tsx`.
- `const pauseAsk = usePauseReason()` in `RunView`.
- `holdOrGo` is no longer `paused ? resumeSession : pauseSession`. It asks for a pause reason when the linked pen is running.
- `{pauseAsk.dialog}` renders beside `{taskClock.picker}`.

`lib/work-pause.ts`, `lib/work-pause.test.ts`, and `components/Home/Tracking/pause-reason-dialog.tsx` are also uncommitted. The run view calls them. The split keeps those imports. It does not restore HEAD’s one-line `holdOrGo`.

Do not `git checkout`, stash, or revert `SessionPlanner.tsx` before cutting. Do not rebuild the file from `git show HEAD:`. If the working tree changes again before the cut, re-read the file and move the text that is there. The line numbers in this plan will be stale; the function names will not.

`putSession`’s `releasePenClock(bumped)`, Stop, and End already call `releasePenClock` in HEAD. Those calls move with `drafts.ts` and `run-view.tsx`. They are easy to drop if someone “cleans up” pen code while moving the pause-reason lines. Move them with the function.

Other session and tracking work is in the same working tree (`lib/session-pen.ts`, pen-color session, operation work session). This split does not edit those files. It only preserves the calls `SessionPlanner.tsx` already makes.

Two lists that look alike (draft pick and flat pick) and two clocks named `fmtClock` (this file and house cleaning) are the other easy wrong merges. Leave both pairs alone.

## Out of scope

- Any change under `components/Modules`.
- Any change to `lib/session-plan.ts`, the store, CSS, class names, or copy.
- Merging the To do task card, item detail, and the drawer, or pointing **Break down** at either of the other two.
- A second wave that splits `DraftView` or `RunView` JSX into more components.
- New tests, screenshot recapture, and behavior fixes noticed along the way. File those separately. This move copies the current code.
