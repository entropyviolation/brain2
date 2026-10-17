# Steps (shared step tree)

_Last mapped: 2026-10-16_

One step tree for every host, so item detail never imports from Home. Built in Phase 9 (slice K) of [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md#phase-9-one-step-tree).

## Hosts

| Host | Columns it passes |
|------|-------------------|
| To Do lid (`components/Home/ToDo/TodoBreakdown.tsx`) | Tier tag and spark (`tierTags`), Needs…, ▶, minutes, spent, counts, progress (a branch's level gauge on hover), delete. Tier filter from `todo-prefs` `tierView`. Hide locked and Show next only from `todo-prefs`. A move is one undo step (`rememberWorld`). |
| Item detail → Subtasks (`components/ItemDetail/SubtaskTree.tsx`) | Tier tag and spark (`tierTags`), parts (`n/m`), minutes, `=Nm`, delete, ↗ (stored tasks only). No view switches. |

| Task card (`components/Home/ToDo/TaskCard.tsx`) | _Last mapped: 2026-10-16_ (Phase 12). Tier tags, ↗, and its column picker. Passes controlled `selected` / `onSelectedChange` (mass edit) and `onVisibleIds` (Chain order). Card-local level filter, Hide locked, Show next only. |

**Planned:** the session pick list (Phase 13) hosts it too.

## Files

| File | Role |
|------|------|
| `StepTree.tsx` | The tree. Rows: fold chevron and count, tick, dot (drag handle), name, host columns, hover **+** for a child. Each open branch ends in one quiet **+ step**; an empty tree shows **Add the first step** (and the host's `emptyExtra`). |
| `step-tree-view.ts` | Pure. `buildStepView` turns the tree plus folds, Hide locked, Show next only and peek into flat rows (`step`, `more`, `add`) and a hidden count. `isStepLocked` / `hiddenByLock` / `nextStepInBranch`. |
| `step-folds.ts` | Folds remembered per step id in `brain2-step-folds` (view state; not in backups). |
| `WaitingLine.tsx` | The calm line (UI-5): "Everything else is waiting, not forgotten. · 3 hidden". The count peeks without turning the switch off. Absent when nothing is hidden. Also used under the To Do Assigned list. |
| `StepTierMarks.tsx` | _Last mapped: 2026-10-16_ (Phase 10). The `B · G · E` tag (own tier, or the inherited one dimmed and dashed; click cycles B → G → E → inherit) and the spark mark (UI-7; click sets or clears `sparkedAt`). Drawn when the host passes `tierTags`. |
| `LevelGauge.tsx` | _Last mapped: 2026-10-16_ (Phase 10). `3/6` then three thin bars B · G · E (weighted percent per level; an empty level reads `—`). Without step tiers: one weighted bar. `stepId` reads one step's subtree; `focus` draws the Tier filter's level stronger. Numbers from `lib/step-progress.ts`. |
| `StepItemStack.tsx` | _Last mapped: 2026-10-16_ (Phase 11, slice M). Mounted once in `app/page.tsx`. Draws each layer of `lib/step-item-stack.ts` as a `TaskDetailPopup` with `stackAbove`, a `layerHeader` (‹ Back, breadcrumb `Finish CDs › insert › disc`, **Parent** chip, `est · parts · spent`) and `onStepComplete` (Complete ticks the step). Also keeps step items in step: removes an item whose step is gone, moves it with a step that changed task (`applyStepItemFixes`), and while a step item is open sends its name and estimate edits back to the step. |
| `step-tree.css` | Cool paper rows, hairline indent guides, violet selection and drop marks. The step-item ring on a dot, ↗, and the layer bar. |

## Behaviour

- **Composer.** Enter commits and goes one level deeper (under the new step). Empty Enter steps out a level, then closes. Shift+Enter stays. Esc closes. A multi-line paste makes one step per line at that level.
- **Select.** Click a name selects; click it again (alone) renames. Shift-click selects a visible range. Cmd/Ctrl-click toggles. Space toggles the focused row.
- **Move.** Drag the dot. It takes the whole selection, by its top-most steps (`topMostSelected`); children come along. The top or bottom edge of a row drops before or after it; the middle nests inside; a **+ step** row drops at the end of that branch. A step into itself or its own branch is refused with a line. The pure move is `moveSteps(steps, ids, target)` in `lib/todo-steps.ts`; ids and `dependsOn` ride along.
- **Keys** act only with focus on a row (not on a button or field inside it): ↑/↓ focus, ←/→ fold, Alt+↑/↓ reorder, Tab nests under the previous sibling, Shift+Tab lifts after the parent, Enter renames. Every other key pressed inside the tree stays in the tree, so the ledger's D / M / P / R never fire from a step. **Esc** clears a selection first; with nothing selected it reaches the host (the lid closes).
- **Hide locked.** Hides a step waiting on an open prerequisite (`lib/prereqs.ts`, ancestors' waits included) and a branch whose children are all hidden that way. Never hides a step for being incomplete. Hidden steps still count in progress. Ticking the prerequisite brings them back.
- **Tier filter** (_Last mapped: 2026-10-16_, Phase 10). `tier` keeps one level's view (`stepsForTier`, cumulative). A step outside it with an in-view step inside shows greyed (`is-greyed`, `StepRowInfo.greyed`) as its container. The rest is hidden and counted in the calm line; the peek shows it.
- **Show next only.** A branch with two or more steps inside shows only its next step (the `pickStartStep` pick inside it, else its first open leaf) and a dim **+ N more**; one click opens the branch. The data never changes. **Planned:** switch to `rankStartSteps` once it exists (its `[0]` equals `pickStartStep`).

## Open on top (Phase 11)

_Last mapped: 2026-10-16_

- A host passes `onOpenStep`. Then a click on the dot opens the step's item (a drag still moves) and each row gets a hover **↗**. A dot with an item wears a violet ring (`is-item`). The lid (`TodoTable`, `todo-panel`) and item detail → Subtasks pass `openStepItem(taskId, stepId)`.
- `openStepItem` makes the item if needed (`lib/step-items.ts`) and pushes a layer. Layers stack: Esc and **‹ Back** close only the top; a crumb opens that ancestor (the task, or a step's item) as a new layer. Everything underneath stays mounted, so the lid, scroll, selection, link mode and running session keep their state.
- `TaskDetailPopup` ignores a click or focus inside a layer above it (`data-item-layer`, `layerSafeDismiss`), so it stays open under the stack.
- ↗ from the task card and **Card** on a step item (the parent's card, scrolled to the step) are built (Phase 12). **Planned:** ↗ from a session (Phase 13). The level gauge on a step item's bar waits on slice N's `LevelGauge`.

## Not built yet

- Cross-task drag (Decision 9 is open). Drag between B / G / E columns is the task card's own three-column view, not `StepTree`. Show next only still picks inside a branch without the tier filter. **Paste as log** waits for `lib/work-log-parse.ts` (slice I).

Tests: `StepTree.test.tsx`, `step-tree-view.test.ts`, `StepItemStack.test.tsx`, `lib/todo-steps-move.test.ts`, `lib/step-items.test.ts`.
