# `components/Completion/` — Global task-completion popup

Ensures a completion popup appears **every time** a task is completed — regardless
of which screen completed it (checkbox, list, scheduler, kanban, operations,
reviews, the item-detail "Complete Task" button, …). The popup captures which
**Objectives** and **Goals** the finished task contributed to, advances linked
goals, and awards the stacking objective point multipliers.

## Files

| File | Purpose |
|------|---------|
| `CompletionPopupHost.tsx` | `CompletionPopupHost`: mounted once at the app root (`app/layout.tsx`). Subscribes to the completion event bus and **queues** rapid completions so none are missed, rendering one `CompletionDialog` at a time. |
| `CompletionDialog.tsx` | The "Task completed" dialog: **Contributes to objective(s)** (optional) + **counts toward goal(s)** selectors, a live points preview (base × stacking multiplier), and an optional quick reflection (satisfaction / actual time / notes). |

## How it fires

1. Any completion path flips `Task.completed` through `task-store.updateTask`.
2. On the false→true transition the store awards base points and emits a
   `TaskCompleted` event via **`lib/completion-events.ts`** (`emitTaskCompleted`).
3. `CompletionPopupHost` (subscribed via `onTaskCompleted`) enqueues the event and
   shows `CompletionDialog`.

## On save

- Writes `Task.contributesToObjectiveIds` / `Task.contributesToGoalIds`.
- Advances each selected goal (`useGoalsStore.setGoalProgress`, +1).
- Awards the bonus on top of the base points: `bonus = base × (multiplier − 1)`,
  where the multiplier is `taskObjectiveMultiplier` (product of each objective's
  effective multiplier; **1.5×** default, or a prioritized objective's custom
  multiplier). Objective-contributing tasks earn points even when their base is 0.
- Optional reflection is stored as a `TaskCompletionReview`.

**Skip** keeps the already-awarded base points and records no contribution.

## Related

- Event bus: `lib/completion-events.ts`
- Multiplier math + objectives/goals data: `lib/goals-store.ts`, `lib/objectives.ts`
- Objectives/Goals UI: `components/Home/Goals/`
