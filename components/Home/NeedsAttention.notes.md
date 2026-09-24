# NeedsAttention — Phase 6b notes

The **Needs Attention** queue is the Home daily door: tasks that have slipped
or are stuck, plus neglected structures and zombie work. It is Home furniture
a milled fascia, not a second Direction report or operation heatmap.
Category keys hide a queue (persisted in `cogs-needs-attention-hidden`).

Clarify / split / delete mutate through `taskRepository` only when the user
clicks those actions.

## Files

| File | Role |
| --- | --- |
| `lib/needs-attention.ts` | Pure selector `getNeedsAttention(tasks, opts?)` + `groupNeedsAttentionByReason`, reason labels, `clarifyNeedsAttentionItem`, `splitNeedsAttentionItem`. No store writes. |
| `lib/needs-attention.test.ts` | Vitest unit tests for every reason, exclusions, thresholds, multi-reason items, grouping, and the queue helpers. |
| `components/Home/NeedsAttention.tsx` | The fascia. Reads `taskRepository.getAll()` + goals-store, runs the selector, groups by reason, hides categories from the key row, and offers clarify (inbox only) / split / delete on neglected / zombie / unclarified rows that exist in the item store. |
| `components/Home/NeedsAttention.test.tsx` | Card tests (jsdom / Vitest mocks only). |
| `tests/integration/needs-attention.test.ts` | Selector over a reset in-memory store snapshot. |

## Reasons & thresholds

| Reason | Condition | Configurable |
| --- | --- | --- |
| `overdue` | `deadline` in the past and still open work (not done, not missed) | — |
| `unclarified` | `stage === "inbox"` and still open work | — |
| `blocked` | has `dependencies` where ≥1 referenced task is still open work (unknown ids count as blocking; done **or** missed deps do not) | — |
| `stale` | still open work, no schedule, `createdAt` older than `staleDays` (strictly greater than). Kept on the selector; **omitted from the Home card**. | `opts.staleDays` (default **14**) |
| `neglected` | incomplete goal / operation / list item with no recent linked work, and old enough that "never" also counts. Goals use `goalsNeedingAttention`. Operations use the operation tree + `timeLogs` (not the heatmap UI). List items (`type === "item"` or `stage === "list"`) use linked completed actions + their own logs. Brand-new unused structures are not flagged. Done / abandoned operations are skipped. | `opts.neglectDays` (default = `staleDays`) |
| `zombie` | a next-action task (not an operation or list item) with `daysPushed ≥ 7`, `weeksPushed ≥ 3`, or `entropy ≥ 0.7` and age `> 21` days. | `zombieDaysPushed`, `zombieWeeksPushed`, `zombieEntropy`, `zombieResidentDays` |

Done **and** missed-opportunity tasks are always excluded (`isClearedFromWork`). `opts.now` injects a reference time.
`opts.reasons` scopes which reasons are evaluated (defaults to all six).
`opts.goals` is the life-direction goal list; the card passes the goals store.

## Queue actions

Shown on unclarified / neglected / zombie rows that exist in `taskRepository`:

| Action | What it does |
| --- | --- |
| Delete | `confirm`, then `taskRepository.remove` |
| Split | `prompt` for steps (one per line), then `splitNeedsAttentionItem` (`parseSteps` + `addStepsAsSubtasks`) |
| Clarify | Inbox rows only. Stage change + entropy drop via `clarifyNeedsAttentionItem` |

Synthetic neglected goals (goals-store only, no item record) are listed without those actions.

## Component API

```tsx
<NeedsAttention
  onOpenItem={(id) => {/* route to detail view */}}
  options={{ staleDays: 14 }}   // optional; forwarded to the selector
/>
```

- `onOpenItem(id: string)` — required; called when a flagged row title is clicked.
- `options?: NeedsAttentionOptions` — optional selector options (`goals` override included).
- `className?: string` — optional wrapper class.

The dashboard already mounts this card and opens `TaskDetailPopup` via
`onOpenItem`. Do not restyle it into a new card language.
