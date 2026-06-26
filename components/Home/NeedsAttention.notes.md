# NeedsAttention — Phase 6b notes

The **Needs Attention** queue surfaces tasks that have slipped or are stuck so
the user can triage them from the Home dashboard. It is a read-only surface: it
computes a view and routes clicks; it never mutates tasks.

## Files

| File | Role |
| --- | --- |
| `lib/needs-attention.ts` | Pure, deterministic selector `getNeedsAttention(tasks, opts?)` + `groupNeedsAttentionByReason`, the `NeedsAttentionReason` type, and reason labels. No side effects. |
| `lib/needs-attention.test.ts` | Vitest unit tests for every reason, completed-task exclusion, the stale-threshold boundary, multi-reason items, and grouping. |
| `components/Home/NeedsAttention.tsx` | The card component. Reads `taskRepository.getAll()`, subscribes to the task store for reactivity, runs the selector, and renders items grouped by reason with badges. |

## Reasons & thresholds

| Reason | Condition | Configurable |
| --- | --- | --- |
| `overdue` | `deadline` in the past and not completed | — |
| `unclarified` | `category === "inbox"` and not completed | — |
| `blocked` | has `dependencies` where ≥1 referenced task is not completed (resolved against the passed `tasks`; unknown ids count as blocking) | — |
| `stale` | not completed, has no scheduling at all, and `createdAt` older than `staleDays` (strictly greater than) | `opts.staleDays` (default **14**) |

Completed tasks are always excluded. `opts.now` injects a reference time for
deterministic tests. `opts.reasons` scopes which reasons are evaluated (defaults
to all four).

## Component API

```tsx
<NeedsAttention
  onOpenItem={(id) => {/* route to detail view */}}
  options={{ staleDays: 14 }}   // optional; forwarded to the selector
/>
```

- `onOpenItem(id: string)` — required; called when a flagged row is clicked.
- `options?: NeedsAttentionOptions` — optional selector options.
- `className?: string` — optional wrapper class.

## Integration TODO (left for the parent)

This component is intentionally **not** mounted yet to avoid colliding with
concurrent edits to `components/Home/home-dashboard.tsx`. To wire it up:

1. **Import it** in `components/Home/home-dashboard.tsx`:

   ```tsx
   import { NeedsAttention } from "@/components/Home/NeedsAttention"
   ```

2. **Render it** in the dashboard layout where the other Home cards live (near
   the To-Do / daily-progress quickview). Example:

   ```tsx
   <NeedsAttention onOpenItem={(id) => setSelectedTaskId(id)} />
   ```

3. **Wire `onOpenItem`** to the detail view. The dashboard already opens tasks
   via the existing detail popup pattern (see `components/Home/ToDo/todo-panel.tsx`,
   which uses `TaskDetailPopup` with a `selectedTaskId` state). Reuse the same
   state setter:

   ```tsx
   const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
   // ...
   <NeedsAttention onOpenItem={setSelectedTaskId} />
   <TaskDetailPopup
     taskId={selectedTaskId}
     open={!!selectedTaskId}
     onClose={() => setSelectedTaskId(null)}
   />
   ```

   If the dashboard prefers the newer `components/ItemDetail/*` detail view, wire
   `onOpenItem` to whatever id-based open handler that view exposes instead.

4. **(Optional)** Pass `options={{ staleDays: N }}` if the dashboard wants a
   different stale threshold, or `options={{ reasons: [...] }}` to scope the
   queue.

No store, repository, or type changes are required — the selector and component
consume the existing `Task` shape and `taskRepository`.
