# NeedsAttention — Phase 6b notes

The **Needs Attention** queue is the Home daily door: tasks that have slipped
or are stuck, plus neglected structures and zombie work. It is Home furniture
a milled fascia, not a second Direction report or operation heatmap.
Category keys hide a queue (persisted in `cogs-needs-attention-hidden`).

Clarify / split / delete mutate through `taskRepository` only when the user
clicks those actions. The Home card does not list Inbox (`unclarified`): that
pile stays in Inbox, even when the capture is also overdue. Split and delete
are keycaps. A checkbox selects rows; shift-click extends the range.

## Files

| File | Role |
| --- | --- |
| `lib/needs-attention.ts` | Pure selector `getNeedsAttention(tasks, opts?)` + `groupNeedsAttentionByReason`, reason labels, `clarifyNeedsAttentionItem`, `splitNeedsAttentionItem`. No store writes. |
| `lib/needs-attention.test.ts` | Vitest unit tests for every reason, exclusions, thresholds, multi-reason items, grouping, and the queue helpers. |
| `components/Home/needs-attention/NeedsAttention.tsx` | The fascia. Reads `taskRepository.getAll()` + goals-store, runs the selector, drops Inbox (`stage === "inbox"`) and the `unclarified` reason, groups what remains, hides categories from the key row, and offers split / delete on neglected / zombie rows that exist in the item store. Checkboxes select rows (shift extends). The gem count stays 0 until the task and goals persist snapshots have hydrated, so server HTML matches the client. Hidden category keys are read after that same mount. |
| `components/Home/needs-attention/NeedsAttention.test.tsx` | Card tests (jsdom / Vitest mocks only). |
| `tests/integration/needs-attention.test.ts` | Selector over a reset in-memory store snapshot. |

## Reasons & thresholds

| Reason | Condition | Configurable |
| --- | --- | --- |
| `overdue` | Date-only (local midnight, or UTC midnight of a calendar day) is overdue only when that local calendar day is before today, so the due day stays open; a clock time is overdue once that instant has passed. Done and missed stay excluded. | — |
| `blocked` | has `dependencies` where ≥1 referenced task is still open work (unknown ids count as blocking; done **or** missed deps do not) | — |
| `stale` | still open work, no schedule, `createdAt` older than `staleDays` (strictly greater than). Kept on the selector; **omitted from the Home card**. | `opts.staleDays` (default **14**) |
| `unclarified` | `stage === "inbox"` and still open work. Kept on the selector; **omitted from the Home card**, and any inbox row is dropped even when another reason would flag it. | — |
| `neglected` | incomplete goal / operation / list item with no recent linked work, and old enough that "never" also counts. Goals use `goalsNeedingAttention`. Operations use the operation tree + `timeLogs` (not the heatmap UI). List items (`type === "item"` or `stage === "list"`) use linked completed actions + their own logs. Brand-new unused structures are not flagged. Done / abandoned operations are skipped. | `opts.neglectDays` (default = `staleDays`) |
| `zombie` | a next-action task (not an operation or list item) with `daysPushed ≥ 7`, `weeksPushed ≥ 3`, or `entropy ≥ 0.7` and age `> 21` days. | `zombieDaysPushed`, `zombieWeeksPushed`, `zombieEntropy`, `zombieResidentDays` |

Done **and** missed-opportunity tasks are always excluded (`isClearedFromWork`). `opts.now` injects a reference time.
`opts.reasons` scopes which reasons are evaluated (defaults to all six).
`opts.goals` is the life-direction goal list; the card passes the goals store.

## Queue actions

Shown on neglected / zombie rows that exist in `taskRepository`. The same Split and Delete sit on the selection bar for every checked row that exists in the store. Clarify stays in `clarifyNeedsAttentionItem` for Inbox; this card does not show it.

| Action | What it does |
| --- | --- |
| Delete | `confirm`, then `taskRepository.remove`. The bar deletes every checked row. |
| Split | `prompt` for steps (one per line), then `splitNeedsAttentionItem` (`parseSteps` + `addStepsAsSubtasks`). The bar uses one prompt for every checked row. |

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
