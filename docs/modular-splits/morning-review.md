# Split `MorningReview.tsx`

_Last mapped: 2026-10-27._ Planning only. The app file is still one module (~1536 lines). `MorningReviewDialog` is ~1010 of those (about lines 492–1501).

This is a pure structural extraction. After it, the morning ritual looks and behaves the same. Same DOM, class names, copy, store writes, and public import path. No new behavior, no cleanup of quirks, no merge with the text `gm` walk.

The working tree already has unrelated session and tracking edits. This split must not revert, stage, or reformat those files.

## Responsibilities today

`components/Reviews/MorningReview.tsx` owns the desktop morning ritual (HM2). Text `gm` stays in `lib/ingest/apply-morning-gm.ts` and is a parallel writer of the same `PeriodReview.morning` slice. Leave that file alone.

| Piece | Lines (approx.) | Job |
|-------|-----------------|-----|
| Draft types and session draft | 82–252 | `MorningDraft`, `sessionStorage` key `brain2-morning-draft:{day}`, coerce, seed |
| `MorningReviewErrorBoundary` | 254–285 | Fallback **Morning** button if the entry button throws |
| `StringListEditor` | 287–358 | Numbered lines for new to-dos and gratitude |
| Walk field helpers | 360–415 | Stored vs today vs new, `WalkSlot` |
| Affirmation pool + open Lists | 417–459 | Create the Affirmations list if missing; navigate to it |
| `usePaintedNight` | 424–428 | Sleep painted on the time grid |
| Step table | 461–490 | Twelve steps and `resumeStep` → step id |
| `MorningReviewDialog` | 492–1501 | State, save, stepper, every step body, dialog shell |
| `MorningReview` + button | 1503–1536 | Header-style entry; hydration-safe phase label |

Inside the dialog, three jobs are tangled:

1. **Form state** — one `useState` per field, reseed when the open day changes, write a session draft only when no store slice exists yet.
2. **`commitMorning`** — create to-dos, apply the walk, append the plan log, write sleep, `replaceMorningReview`, stamp Required / Prioritized marks, clear the draft, reset new-todo lines and applied walks.
3. **Step bodies** — a `switch` on twelve ids. Look-ahead (`ahead`, `due`, `overdue`) is one `LookAheadSection` with a different `mode`.

Callers that already import the dialog (do not edit their import paths):

- `components/Reviews/reviews.tsx`
- `components/Reviews/RitualWalkDialog.tsx`
- `components/Reviews/MorningReview.test.tsx`

Nothing else imports this module. `MorningReview` (the button) and the default export have no other callers. Keep them anyway.

## Stable exports

`components/Reviews/MorningReview.tsx` stays the public door. It keeps `"use client"` and only re-exports:

- named `MorningReviewDialog`
- named `MorningReview`
- default `MorningReview` (same component as the named export)

```tsx
"use client"

export { MorningReviewDialog } from "./morning/MorningReviewDialog"
export { MorningReview, default } from "./morning/MorningReviewButton"
```

Do not re-export step components, `MorningDraft`, or `commitMorning`. Those stay private to `morning/`.

`data-ui-name="Morning review"` and `data-ui-docs="components/Reviews/README.md"` stay on `DialogContent`. The stamp test reads the file that contains those strings, so that one path string moves with the shell (see Test plan).

## New files and what moves

Folder: `components/Reviews/morning/`. CSS stays in `components/Reviews/ritual-steps.css`. Do not add a stylesheet. `MorningReviewDialog.tsx` keeps `import "../ritual-steps.css"` (the same side-effect import the current file has, beside the one in `RitualSteps.tsx`).

Move code verbatim. Same names, same JSX, same object-key order. A new file may add a props type and a function wrapper. It may not wrap a step in an extra DOM node.

| File | What moves |
|------|------------|
| `morning/types.ts` | `MorningSlice`, `MorningDraft`. Export them for siblings only. |
| `morning/draft.ts` | `LOGGED_FROM_TEXT` stays next to save, not here. Move `draftStorageKey`, `asStringList`, `asString`, `safeClock`, `asWalkForms`, `readMorningDraft`, `writeMorningDraft`, `clearMorningDraft`, `seedFromMorning`. |
| `morning/steps.ts` | `MORNING_STEPS`, `RESUME_TO_STEP`, and a `MorningStepId` taken from the const array. |
| `morning/painted-night.ts` | `usePaintedNight`. `"use client"`. |
| `morning/affirmation-pool.ts` | `affirmationPool`, `ensureAffirmationLines`, `openListInLists`. |
| `morning/StringListEditor.tsx` | `StringListEditor`. `"use client"`. |
| `morning/WalkSlot.tsx` | `StoredSlot`, `latestDayRating`, `latestResistance`, `WalkSlot`. `"use client"` because of the button. |
| `morning/NightStep.tsx` | The `case "night"` fragment (carry, all-nighter, clocks, dream). |
| `morning/AffirmationsStep.tsx` | The `case "affirmations"` fragment. |
| `morning/TodosStep.tsx` | The `case "todos"` fragment. |
| `morning/LookAheadStep.tsx` | The shared `ahead` / `due` / `overdue` return. Returns `LookAheadSection` itself, with the same props, including `key={stepId}` on the element the parent renders. |
| `morning/HabitsStep.tsx` | The `case "habits"` fragment. |
| `morning/WalkStep.tsx` | The `case "walk"` fragment, including the tier `NativeSelect` and six `WalkSlot`s. |
| `morning/PlanStep.tsx` | The `case "plan"` fragment. |
| `morning/CircumstancesStep.tsx` | The `case "circumstances"` fragment. The three rows stay `mustNotDo`, `newEvents`, `excited`. |
| `morning/BestDayStep.tsx` | The `case "best"` fragment. |
| `morning/GratitudeStep.tsx` | The `case "gratitude"` fragment. |
| `morning/commit-morning.ts` | The body of `commitMorning` (the `try` that builds the slice and writes stores). `LOGGED_FROM_TEXT` moves with it. |
| `morning/use-morning-form.ts` | The dialog’s field state, refs, reseed effect, and session-draft effect. `"use client"`. |
| `morning/MorningReviewDialog.tsx` | Shell, stepper, answered flags, day arrows, `AffirmationsDialog` sibling, and the glue that calls the hook, commit, and step components. |
| `morning/MorningReviewButton.tsx` | `MorningReviewErrorBoundary`, `MorningReviewButton`, `MorningReview`, default export. |

`MorningReview.tsx` at the room root becomes the barrel above. Delete the old implementations from it in the same step as the barrel, so there is one copy of each function.

### Step props

Pass the values the `switch` already closes over. Each step returns the same fragment (or the same single element) it returns now.

`LookAheadStep` takes `stepId`, `now`, `dayKey`, `activeDate`. The parent still chooses `mode`: `stepId === "ahead" ? "lists" : stepId`. Lists stay “This week” / “This month” with `getWeekString(activeDate)` and `dayKey.slice(0, 7)`.

`NightStep` takes carry, goals, all-nighter flag and lifts, clock values, estimate sources, setters, dream, and `nightSummary`. Keep the clock tuple ids `morning-bedtime` and `morning-waketime`, and the kinds `"asleep"` and `"awake"`.

`WalkStep` takes `todaysTasks`, `dayKey`, `todoWalkById`, and `patchWalk`.

`AffirmationsDialog` stays a sibling of `DialogContent` inside `Dialog`, rendered by `MorningReviewDialog`, not inside `AffirmationsStep`. Speak them still sets `affirmationsOpen`. The step receives `onSpeak`, `onShuffle`, `onEditList`, `shownAffirmations`, `saidToday`, and the recite handlers.

### `commitMorning`

Turn the closure into a function whose arguments are the values it already reads, and whose return value is what the component already applies to React state. The component still calls, in this order, after a successful write:

1. `setNewTodoLines([""])`
2. `setTodoWalkById(keptWalks)` — skipped walks only, each reset to an empty form with `skipped: true`
3. `baselineRef.current = packForm(...)` with those cleared lines and kept walks
4. `onClose()` when `complete` is true, otherwise `setSavedNote("Saved. Unanswered questions stay open.")`

On throw, `console.error("[MorningReview] save failed", err)` and no state reset. The error-boundary log stays `console.error("[MorningReview]", error, info.componentStack)`.

Store calls stay in the same order: `addTask` for each new line, `updateTask(applyTodoWalkSlots(...))` for each walked task, `appendPlanEntry` when the plan text changed, sleep `setAllNighter` / `setStoreWakeTime` / `setStoreBedtime`, `replaceMorningReview`, then `tasksWithCommitment` and `updateTask` for marks, then `clearMorningDraft`.

Task ids stay `` `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` ``. Notes stay `logged from text`. Slice `source` stays `"desktop"`.

### `useMorningForm`

Move the field `useState`s, the three refs (`baselineRef`, `affirmationsTouchedRef`, `submittedRef`), the seed `useMemo`, the reseed `useEffect`, and the session-draft `useEffect` together. Call the hook unconditionally near the top of the dialog, after the store subscriptions it needs (`existing`, sleep clocks, lists, tasks).

Leave these in the dialog, in their current relative order: `useRitualStep`, `visitedAhead`, `affirmSeen`, and the three small effects that set visited look-ahead steps and `affirmSeen`. `useSleepSync()` stays the first hook in the dialog.

`currentForm()` and `packForm` (`JSON.stringify`) stay next to the hook’s return so dirty checks keep using one object shape. Key order of `MorningDraft` is part of the behavior, because baseline equality is `JSON.stringify` and key order follows insertion order:

`allNighter`, `wakeTime`, `bedTime`, `dream`, `affirmations`, `newTodoLines`, `priorityIds`, `priorityHabitIds`, `todoWalkById`, `dayPlan`, `circumstance`, `mustDo`, `mustNotDo`, `newEvents`, `excitedAbout`, `bestDayWhy`, `gratitude`.

`circumstance` key order: `mustDo`, `mustNotDo`, `newEvents`, `excited`.

`requiredIds` is React state and is not part of `MorningDraft` or the session draft. It is re-read from task marks on each open. Leave it that way.

## Extraction order

Each step should leave `MorningReview.test.tsx` green before the next. Cut and paste. Do not restyle a step while moving it.

1. **`types.ts` + `draft.ts` + `steps.ts`.** No JSX. Dialog imports them and deletes the local copies.
2. **`painted-night.ts` + `affirmation-pool.ts`.** Still no visible change.
3. **`StringListEditor.tsx` + `WalkSlot.tsx`.** Props match the current function arguments.
4. **Step components, one case at a time.** Suggested order, smallest first: plan, best day, gratitude, habits, circumstances, todos, affirmations, look-ahead, night, walk. After each move, the `switch` returns that component and nothing else in the case.
5. **`commit-morning.ts`.** Dialog keeps the setState epilogue and the `catch`.
6. **`use-morning-form.ts`.** Last logic move. Skip it if the only way to compile is to change an effect dependency array or to call a hook conditionally. A dialog that still holds the `useState` block is an acceptable stop; the step files are the bulk of the file.
7. **`MorningReviewButton.tsx` + barrel.** Error boundary stays wrapped around the button only. The dialog opened from Rituals or from a To Do row stays outside that boundary, as it is now.
8. **Docs and the stamp path** in the same pass as the shell move (the attribute and the test path move together).

## Visual and behavior invariants

Twelve steps, in this order, with these labels:

| id | Label |
|----|--------|
| `night` | Last night |
| `affirmations` | Affirmations |
| `todos` | To do for today |
| `ahead` | Week and month |
| `due` | Due within a week |
| `overdue` | Overdue |
| `habits` | Daily habit priorities |
| `walk` | Go through to do list |
| `plan` | Day plan |
| `circumstances` | Circumstances |
| `best` | Best day ever |
| `gratitude` | Gratitude |

`useRitualStep` key stays `brain2-morning-step:{dayKey}`. Fallback when a partial review has `resumeStep`: map through `RESUME_TO_STEP`, else step 0. A finished review (`existing.completed`) opens at 0. Look-ahead lamps light when that step is shown (`visitedAhead`). The affirmations lamp lights when that step is shown, and on open when the slice already has affirmations.

Answered flags stay the expressions in the dialog today (night: all-nighter or both clocks or any dream; todos: any priority, required, or non-blank new line; walk: any skipped or non-blank form; plan: draft text or `existing.dayPlanLogged`; and the rest as written).

Shell, unchanged:

- `DialogContent` class `hpp95 hpp95-dialog sm:max-w-2xl h-[min(88vh,780px)] overflow-hidden flex flex-col`
- `data-ui-name="Morning review"`, `data-ui-docs="components/Reviews/README.md"`
- Title **Morning Review** with the sun icon
- Day arrows: **Previous day**, **Next day** disabled when `dayKey >= localDayKey(new Date())`
- `data-morning-day={dayKey}` on the description
- Phase suffix ` · in progress` or ` · saved` from `morningReviewPhase`
- `RitualStepper` `tone="dawn"`, `finishLabel="Finish"`, `onFinish` → `commitMorning(true)`
- Footer: optional saved note, **Close**, **Save progress**, **Save Morning Review** (`hpp-key-go`)
- Close and day-shift save a draft only when `packForm(currentForm()) !== baselineRef.current` and the dialog was not already submitted
- Moving steps (`goStep`) does the same dirty check, then `setStep`
- A completed save closes; a progress save leaves the dialog open and sets the note **Saved. Unanswered questions stay open.**
- A review that was already submitted stays submitted when a later save is a progress save (`phase === "done"`)

Copy and controls that tests and readers already depend on:

- Carry block `data-testid="morning-carry"`, labels **From last night** and **What matters most today**, focus line `Focus: {titles}`
- All-nighter checkbox and the two sentences about blocks (including the empty-state sentence)
- Labels **Fell asleep**, **Wake time**, dream placeholder `Anything you remember…`
- **est.** and `~` when the clock source is remembered or painted; editing a clock clears that source
- Affirmation plaques, **Speak them**, **Shuffle**, **Edit the list**, check title and aria-labels, `✓` / `✓{n}`, Alt-click undo
- List `key={shownAffirmations.join("|")}` so a shuffle remounts the plaques
- To-do empty copy, **Required today**, **3–5 highest priorities**, placeholder `New to-do…`
- Habit checkbox uses the habit name as its accessible name; rank `#n` when selected; checking calls `applyRitualPriority` immediately
- Walk legend (stored earlier / logged today / changing now), **Skip**, tier options `{tier}` plus `{storedTier} (keep)` or `— keep`, **keep {value}** revert
- Plan placeholder `Write the day plan…`
- Circumstances lede **Check what applies, then fill in.** Textarea `autoFocus` when that box is checked
- Best-day aria-label **Why is today going to be the best day ever?**
- Gratitude placeholder `Grateful for…`, max 10, `<b>{count}/10</b>`, Enter advances
- Button entry: `data-morning-review-entry`, labels `Morning`, `Morning …`, `Morning ✓`. First paint is always `Morning` until the phase effect runs
- Error fallback title `Morning review hit a snag — click to try again`, label **Morning**, same `data-morning-review-entry`

Sleep seeding stays: a finished slice wins over the session draft; live sleep log and painted night overwrite wake, bed, and all-nighter on the seed; the seed `useMemo` depends on `[open, dayKey]` only (the existing eslint comment stays). The reseed effect depends on `[open, dayKey, seed]`.

`commitMorning` still copies through `shownAffirmations`, `affirmationIndex`, `walkIndex`, and `circumstanceNums` when the existing slice has them. Gap names for `resumeStep` stay the same strings (`bed`, `wake`, `dream`, `affirmation`, `todo-show`, `todo-priorities`, `habit-priorities`, `day-plan`, `circumstances`, `best-day`, `gratitude`). The walk and the three look-ahead steps stay out of that gap list.

Priority caps stay 5 tasks and 3 habits.

## Test plan

Automated, without rewriting `MorningReview.test.tsx`:

- `npx vitest run components/Reviews/MorningReview.test.tsx`
- `npx vitest run components/UiNames/ui-names-stamps.test.ts` after changing the stamp row from `components/Reviews/MorningReview.tsx` to `components/Reviews/morning/MorningReviewDialog.tsx`. The attribute strings stay the same.
- `npx vitest run components/Reviews/reviews.test.tsx components/Reviews/review-dialog.test.tsx` so the Rituals menu still mounts.

Do not add tests whose only job is to lock the new file layout. The existing dialog tests are the behavior contract: carry text, sleep log and painted night, save progress vs submit, habit priority log, previous day, step memory, gratitude Enter, look-ahead order, **Do today**, **Missed**.

Browser, after the suite is green (the ritual is a dialog, so click through it; a screenshot is not enough):

- Rituals → sun opens **Morning review**. Step the index through all twelve labels. Copy matches the table above.
- Home → To Do, today’s morning row, opens the same dialog for that day (`RitualWalkDialog`).
- **Previous day** shows that day’s saved dream when one exists; **Next day** stops on today.
- **Save progress** leaves the dialog open and shows the unanswered note. **Close** with a dirty field writes a draft and does not mark the morning done. **Save Morning Review** closes.
- Affirmations: **Shuffle** replaces the five lines, **Speak them** opens `AffirmationsDialog` on top, the check logs a count, **Edit the list** closes the ritual and opens Lists on Affirmations.
- All-nighter hides the clocks and shows the skip sentence. Clearing it shows the clocks again.
- Walk: a blank field shows the stored placeholder; typing shows **keep {value}** and the new color; **Skip** hides the grid.
- Gratitude: Enter moves to the next line and keeps the text.
- Week and month / Due / Overdue still render `LookAheadSection` (no extra wrapper). **Do today** and **Missed** still act.

Desktop width is the ritual’s layout (the stepper index is open at 720px). Glance at a narrow width only to see the index drop above the card the way `RitualSteps` already does. This split does not change that CSS.

## Doc updates

Do these in the same pass as the extraction, in the house voice, with `_Last mapped: 2026-10-27_` on the sections you edit.

- `components/Reviews/README.md` — file table: `MorningReview.tsx` is the public door (`MorningReview`, `MorningReviewDialog`). Add a short tree of `morning/` and one sentence that the twelve step bodies, the session draft, and `commitMorning` live there. The morning ritual section’s behavior stays; point **Speak them** and the step list at the folder only as the implementation home. Public import path stays `@/components/Reviews/MorningReview`.
- `components/README.md` — the Reviews row can keep naming `MorningReviewDialog`. Add `morning/` only if that row is listing files.
- `docs/tree.md` and `docs/tree.txt` — doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The Reviews README can keep saying `MorningReview.tsx` is the door that mounts Speak them.
- `docs/README.md` — one index row for `modular-splits/` (this plan). This planning step did not edit the index; the user asked for this file only.
- `docs/RITUALS_REDESIGN.md` — the Morning row’s “~1500 lines” / “nine steps” is already behind the code (twelve steps, look-ahead included). When the split lands, point that cell at `components/Reviews/morning/` and the twelve-step walk. Leave the rest of that plan.
- `docs/SPEC_MAPPING.md` — keep the morning bullet on `components/Reviews/MorningReview.tsx`. That path remains the public module.
- `docs/screenshots/README.md` — the Morning row can keep `components/Reviews/MorningReview.tsx` as the public file. No new screenshot; the pixels do not change.
- `components/UiNames/ui-names-stamps.test.ts` — path only, as in the test plan.

Leave historical citations (`docs/JungBrain2.md`, `docs/jungideas.md`, `docs/widget-improvement/`) on `MorningReview.tsx`. They still name the public module.

## Risks

- **`JSON.stringify` key order.** Rebuilding `MorningDraft` with different key order makes a clean form look dirty, so Close writes a no-op save, or the reverse. Keep the literal order listed above in `currentForm`, `seedFromMorning`, and `readMorningDraft`.
- **Effect dependency lists.** The seed and reseed effects are intentionally narrow so store churn does not wipe typing. Copy the dependency arrays and the eslint comments with the code.
- **Hook order.** `useSleepSync` first; form hook unconditional; stepper hooks after it. No early return before those hooks.
- **Extra DOM.** A step component that returns `<div>{fragment}</div>` changes layout and queries. Return the fragment or the original single root.
- **`AffirmationsDialog` position.** It is outside `DialogContent`. Moving it inside the step or the caption changes stacking.
- **Error boundary scope.** Wrapping `MorningReviewDialog` in the boundary would change the failure UI for Rituals and To Do. Keep the boundary on the button export only.
- **`requiredIds` and `mustDo`.** Required marks are not in the session draft. The circumstances step does not show a must-do box, while `circumstance.mustDo` still exists on the draft and in the gap check. Preserve both.
- **Immediate habit write.** Checking a habit calls `updateTask(applyRitualPriority(...))` before Save. Unchecking does not undo that log. Preserve both.
- **Stamp test.** Forgetting to move the path fails CI even though the attribute is still on the dialog.
- **Dirty tree.** Other sessions are editing tracking, focus, and item-detail files. Touch only `components/Reviews/MorningReview.tsx`, `components/Reviews/morning/**`, the stamp row, and the docs listed above.
- **`components/Modules`.** This split does not import or edit anything there.
- **Text `gm`.** Do not “share” `commitMorning` with `lib/ingest/apply-morning-gm.ts`. The desktop save and the text walk already differ on purpose (walk fields, look-ahead, spoken affirmations). Unifying them is a behavior change.
- **Form hook last.** If extracting it would change when state resets, stop after `commit-morning.ts` and the step files. The dialog may keep its `useState` block.

## Out of scope

Leave `components/Modules/`, `ritual-steps.css`, `LookAheadSection`, `CommitmentMarkList`, `AffirmationsDialog`, `RitualSteps`, `reviews.tsx`, and `RitualWalkDialog.tsx` as they are, aside from the imports they already have. Leave class names, visible strings, `data-*` attributes, storage keys, and the `gm` ingest alone. Do not implement this plan in the same change as the plan file.
