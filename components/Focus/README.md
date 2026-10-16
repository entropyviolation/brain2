# Focus

Anti-paralysis focus surfaces for the daily execution loop (Brain2 #59/#128).
Owner: **Worker A**.

## `JustStartMode`

A distraction-free, full-screen overlay (`data-ui-name="Just Start"`,
`.just-start` / `just-start.css`, z-[100]; Names plate still paints above it)
for **one** stalled task. The dark focus room keeps one mill cue (pixel eyebrow
+ phosphor Done key). Step and timer are separate instruments.

_Rebuilt 2026-10-15 (Phase 1 of [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md))._

**Which step.** `pickStartStep` (`lib/next-step.ts`) walks the whole step tree and returns:
1. the **lowest-level** open step (a leaf, or a parent whose children are all done),
2. whose prerequisites are met: its own `Subtask.dependsOn` and every ancestor's (missing ids do not block),
3. that **has an estimate**,
4. with the **lowest estimate**.

Ties go to `isMolecular`, then tree order. The task's own `dependencies` are checked against the task store. `stepId` (a prop) starts that exact step first.

**Planned** ([`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md), _2026-10-16_): the order grows level (Phase 10), then unlock value (Phase 14), then estimate, then sparks. Each is a no-op for a task without them. Phase 15 A adds `rankStartSteps` and a **Today's choices** screen (two or three leaves, Enter starts the first), **Pull me**, a time-box ring ("Time's up. That counted."), and an end-of-sitting strip at Stop in the focus bar.

**The screen.**
- An eyebrow, then the path (`Finish CDs › Chaos › insert`).
- The step in large light type, with its `context`, and a meta line: estimate, "smallest of N ready steps", atomic.
- The clock counts down the step's **own estimate**, or 2:00 with **2-minute opener** ticked. It keeps counting past zero (`+m:ss`).
- Keys: Pause / Resume, Reset, and **Done**. Done ticks the step with `actualDuration` and `completedAt`, ticks any ancestor whose children are now all done, appends a `timeLogs` entry on the task when a minute or more ran (`notes: "Just Start · path › step"`), and moves to the next pick.
- Under those: **Skip** (next smallest; once every ready step has been skipped, it wraps), **Blocked by…** (tick the steps this one waits on, from `blockerCandidates`, which refuses loops and family), and **Too big** (split into nested steps with minute chips; the picker then takes the smallest part).
- The progress line counts lowest-level steps and minutes left.

**When nothing is ready** it says why and fixes it in place:
- **No steps:** "What would you actually do first?" with minute chips.
- **Steps without estimates:** each one listed with 2 / 5 / 10 / 15 / 30 chips.
- **Every step waiting:** what each one needs, with **Clear**.
- **The task waits on another task:** the names, with **Start anyway**.
- **All done:** a closing state.

**Legibility.** The house h1 rules (`app/win95.css`, and `app/pcb-backdrop.css` on light plates) outrank a bare `.just-start-step h1`, so `just-start.css` repeats the rule under `html[data-pcb-ink] body.win95-app .just-start .just-start-step h1`. Buttons carry `data-no95` so the Win95 bevel stays off the dark glass. Fields are dark with light ink.

Tests: `JustStartMode.test.tsx` and `lib/next-step.test.ts`. `lib/molecular.ts` keeps `nextMolecularStep` for other callers.


## The task on the clock (Phase 2, 2026-10-15)

One clock: Tracking's pen-color **Working on right now** (`lib/pen-color-session.ts`). A task and step can ride it (`lib/task-clock.ts`, `lib/task-clock-log.ts`).

| File | What |
|------|------|
| `TaskClockStarter.tsx` | `useTaskClockStarter()` returns `start(taskId, stepId?)` and a `picker`. With no linked pen and nothing running, the **Task pen** picker (`data-ui-name="Task pen"`) asks which pen; **Remember for this task** (on by default) saves it to `Task.penLinks`. |
| `FocusBar.tsx` | The docked strip (`data-ui-name="Focus bar"`) while a task is on the clock: lamp, pen swatch, `Task › step`, the step's estimate, the clock (violet when paused), Objectives with the step menu, **Just start**, Pause / Resume, Stop. Stop with free objectives asks: **Keep as steps** (each becomes a step beside the one on the clock, finished ones with their real minutes), **Leave on the block**, or **Keep going**. |
| `FocusBar.tsx` (sessions) | _Last mapped: 2026-10-16._ Slice H2: while a To Do session runs, **Park session** asks for an optional note to tomorrow-you, then parks it (`parkLiveSession`) and lets go of the pen clock if it painted (`releasePenClock`, `lib/session-pen.ts`). Otherwise **Session** and **Just 25** open a new draft on the task and step on the clock (`lib/session-open-store.ts`). |
| `FocusBarDock.tsx` | Mounted at the foot of Home (`home-dashboard.tsx`). Reads only whether a task is on the clock, then lazy-loads `FocusBar`. |
| `use-clock-task.ts` | `useClockTask(session)`: the task and step on the clock, the path label, open-step choices, and the tie handler. Used by the focus bar, the header Now well and the Tracking NOW row. |
| `focus-bar.css` | The bar and the picker: dark glass and the `#7dffc4` phosphor, the Just Start family. |

**Just Start and the clock.** When the task has a pen, or is already on the clock, each step Just Start shows goes on the clock. Done ticks that step's objective, so the clock logs the time once at Stop, and Just Start writes no second time log. Without a pen, **Paint on Tracking** asks for one. **● on the clock** marks a step that is live.

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

Planned, not built ([`docs/JungBrain2.md`](../../docs/JungBrain2.md) JG-7): when the open item has been pushed three or more times, or sits in Regret, a second button **Ask sideways** draws one prompt from a user-written Sideways list. The two-minute step stays the primary control.
