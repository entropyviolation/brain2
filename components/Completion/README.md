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
| `CompletionDialog.tsx` | The "Task completed" dialog (`data-ui-name="Completion"` on the dialog content; Names plate portals above the overlay): **Contributes to objective(s)** (optional) + **counts toward goal(s)** selectors with in-list search, a live points preview (base × stacking multiplier), an optional quick reflection (satisfaction / actual time / notes), and a display-only **Usually takes you ~N min** hint from `usualDurationMinutes` (dashed amber **est.**; never writes `estimatedDuration`). Footer: **Undo** (reopen the task), **Skip**, **Save**. Checklist ticks open this with `pending` so Undo / overlay cancel leave the item incomplete. Dirty contribution draft uses the house unsaved-changes guard. |

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
- Optional reflection is stored as a `TaskCompletionReview`.

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
