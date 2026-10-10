# `components/Completion/` — Global task-completion popup

Ensures a completion popup appears **every time** a Brain2 task is completed — regardless
of which screen completed it (checkbox, list, scheduler, kanban, operations,
reviews, the item-detail "Complete Task" button, …). The popup captures which
**Objectives** and **Goals** the finished task contributed to, advances linked
goals, and awards the stacking objective point multipliers. Each list has a
search field so contributions stay easy to find as the catalogs grow.

Graded completion becomes the default in Wave 13 (GS-9): bare / goal /
exceptional, or 0–100, on every task. One click still means goal. Partial work
is credited. The checkbox stays.
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md).

## Files

| File | Purpose |
|------|---------|
| `CompletionPopupHost.tsx` | `CompletionPopupHost`: mounted once at the app root (`app/layout.tsx`) next to `UiNamesHost`. Subscribes to the completion event bus and **queues** rapid completions so none are missed, rendering one `CompletionDialog` at a time. |
| `CompletionDialog.tsx` | The "Task completed" dialog (`data-ui-name="Completion"` on the dialog content; Names plate portals above the overlay): **Contributes to objective(s)** and **counts toward goal(s)** with in-list search, plus **Add** to create a real objective or goal without leaving (a new goal is a year count of 1 and serves the objectives selected above). Live points preview (base × stacking multiplier). Optional **quick reflection**: **Done at** is a date plus the clock, **Exact** or **Est.** (any day and time, not only another clock on the stamp's day). Length and start each use **Exact / Est. / Unknown** (unknown stores no minutes and no start time; Exact and Est. keep an editable value). Optional 1–10 scores (expected difficulty, actual difficulty, enjoyment, resistance, energy, focus, meaning) and notes. Agreeing awards **3 points + 0.1 per word** in the notes (a word is a stretch of text between spaces), shown live and written to the points ledger as `review:${taskId}`. Display-only **Usually takes you ~N min** hint from `usualDurationMinutes` (dashed amber **est.**; never writes `estimatedDuration`). Footer: **Undo** (reopen the task), **Skip**, **Save**. Checklist ticks open this with `pending` so Undo / overlay cancel leave the item incomplete. Dirty contribution draft uses the house unsaved-changes guard. |

## How it fires

1. Most completion paths flip `Task.completed` through `task-store.updateTask`.
2. On the false→true transition the store awards base points and emits a
   `TaskCompleted` event via **`lib/completion-events.ts`** (`emitTaskCompleted`).
3. Checklist ticks call **`requestTaskCompletion`** first (`pending: true`) so the
   dialog appears **before** the box sticks. Undo / overlay cancel leave the item
   open; Skip / Save apply `completeTask`.
4. `CompletionPopupHost` (subscribed via `onTaskCompleted`) enqueues the event and
   shows `CompletionDialog` (deduping the same `taskId` so a later complete emit
   does not open a second dialog).

## On save

- Writes `Task.contributesToObjectiveIds` / `Task.contributesToGoalIds`.
- Advances each selected goal (`useGoalsStore.setGoalProgress`, +1).
- Awards the bonus on top of the base points: `bonus = base × (multiplier − 1)`,
  where the multiplier is `taskObjectiveMultiplier` (product of each objective's
  effective multiplier; **1.5×** default, or a prioritized objective's custom
  multiplier). Objective-contributing tasks earn points even when their base is 0.
- Optional quick reflection is stored as a `TaskCompletionReview` (`lib/completion-review.ts`).
  - Finish: **Done at** writes `completedDate` and `completionReview.completedAt` on any local day and time. `completedCertainty` is `exact` or `estimated`. Leaving it unmarked does not move the stamp. Estimated sets `timeRough`. A start chosen in the same save sits on that finish day. Base points land on that day; a finish moved to another day carries the task's existing ledger rows with it (`redatePoints`, including `review:${taskId}`).
  - Length: `durationCertainty` `exact` or `estimated` with `actualDuration` minutes, or `unknown` with the minutes cleared. Estimated minutes and unknown lengths stay out of exact-time totals.
  - Start: the same three states. `exact` or `estimated` store `startedAt`. `unknown` stores no start. A saved `"known"` reads as `exact`. `timeRough` is set when the length, the start, or the finish is estimated. Unknown alone is not rough.
  - Scores are optional 1–10. A missing score is not stored as 5. Choosing the same number again clears it. A later save that omits a score leaves it; a save that sends `null` removes it.
  - Agreeing awards `3 + 0.1 × words` in these notes via `recordQuickReviewPoints`. The ledger id is `review:${taskId}`. Only this award writes `reviewWordCount` and `reviewPoints`. Undo drops that ledger row with the base points. A later Reflect note (`reflectNotes`) is a different field and does not revise the award.

**Skip** keeps the already-awarded base points and records no contribution.

**Undo** (also labeled for accessibility as "Undo completion") reopens the task
via `uncompleteTask` — `completed` goes back to false, the completion date is
cleared, that day's base points are dropped from the ledger, and the dialog
closes. The item stays in the open to-do pile as if it had never been marked
done.

**Missed opportunity** is not a completion. `markMissedOpportunity` leaves
`completed` false, awards no points, and does not emit `TaskCompleted`, so this
popup does not appear. The row still leaves To Do / Next Actions and files on
the Missed Opportunities list. Overlay / **×** / Escape still **Skip** (dismiss the form, keep the win).

## Related

- Event bus: `lib/completion-events.ts`
- Multiplier math + objectives/goals data: `lib/goals-store.ts`, `lib/objectives.ts`
- Objectives/Goals UI: `components/Home/Goals/`
- Usual-duration hint: `usualDurationMinutes` in `lib/estimated-values.ts`
- Review clock, words, points, and the Analytics summary: `lib/completion-review.ts`
