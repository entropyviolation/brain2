# Focus

Anti-paralysis focus surfaces for the daily execution loop (Brain2 #59/#128).
Owner: **Worker A**.

## `JustStartMode`

A distraction-free, full-screen overlay for **one** stalled task. It shows only:

- the task's **single smallest next molecular step** (`nextMolecularStep` from
  `lib/molecular.ts`) and that step's self-contained `context`,
- a **2-minute countdown** (the classic ADHD "you only have to start" trick),
  with pause / resume / reset,
- a **"Done with this step"** button that marks the surfaced subtask complete
  (via `useTaskStore.updateTask`) and advances to the next step.

When every step is complete (or there are none) it shows a closing state.

### Usage

```tsx
import JustStartMode from "@/components/Focus/JustStartMode"

const [focusTaskId, setFocusTaskId] = useState<string | null>(null)

{focusTaskId && (
  <JustStartMode taskId={focusTaskId} onClose={() => setFocusTaskId(null)} />
)}
```

Props: `JustStartMode({ taskId: string; onClose: () => void })` — default export.
It reads/writes the task itself from the store, so the host only owns the
open/close state. `Escape` closes it.

### Where it's wired

- **To-Do panel** (`components/Home/ToDo/`): a per-row "Just Start" (⚡) button
  launches the overlay for that task. This is wired by Worker A.
- Integration pass (coordinator) may also surface it from Needs-Attention or the
  task detail view — just render `<JustStartMode taskId onClose />`.

### Prerequisite

The task needs `subtasks` (molecular steps). Add them from the task detail
**Subtasks** tab → "Split into steps", and optionally flag the atomic ones as
MOLECULAR so they're surfaced first.
