# Habits BIMBY

_Last mapped: 2026-11-02_

A BIMBY for one job: daily habits. Desktop only today: Home → Habits → **Chat**. Built the way the
[Tracking Helper](TRACKING_HELPER.md) was: **the model points, code computes**, self-hosted models only, and a
rules reader that still works with Ollama off. Every change is a proposal; nothing is written until the person
accepts a row or presses **Accept all**.

Named a BIMBY (BIM + baby: a small, single-job sub-agent; see `CLAUDE.md`). Code names say BIMBY (`useHabitsBimby`, `HabitsBimbyFlow`, `habitsBimbyBlueprint`). The paths the brief fixed keep `habit-helper`: `lib/habit-helper/`, `/lab/habit-helper`, the Blueprint id and surface, and the `habithelper-*` storage keys.

## What it does

| You say | It proposes |
|---------|-------------|
| "daily habits completed - drank water, read 10 pages, stretched" | Drink water off → on; Read 5 pages 0 → 10 pages; Stretch off → on |
| "walked for 30 minutes then ate a chocolate bar…" | Exercise 0 → 30 min, when Exercise lists walking (a keyword or a Tracking tag). The chocolate bar is ignored |
| "I didn't go outside today because I woke up too late and it was dark" | Go outside → missed, reason "I woke up too late and it was dark", exactly as written |
| "yesterday I read 20 pages" | Read 5 pages on yesterday's date → 20 pages |
| "I read for a while" (with Read 5 pages and Read the news) | Asks which one, with a key for each |
| "Give relevant shorthand names to all of my daily habits that don't already have them" | A table: habit → `shorthandName` ("read 5 pages" → read, "clean for 15 minutes" → clean, "go outside" → outside), unique, editable |
| "what's left today?" | Each open habit with one nudge from its own record |
| "show my reasons for go outside" | A count of reasons and themes, and a **Reasons** view |

These are the shipped tests in `lib/habit-helper/tests.ts`, replayed with no model, and read by rules, on every
test run.

**Asking why.** On open, and after each answer, the BIMBY may ask why a habit was missed: first a cell marked
missed with no reason, then a habit missed 3 of the last 7 days. One habit at a time, at most 3 a day. The
answer is saved word for word as the cell's `missReason` (after approval). "skip" passes.

**Encouraging.** On open, once a day, it lists today's open habits with one nudge each, most specific first:
the time it is usually done ("You usually do this before 11 am; it's 9:40 am", from when met cells were written),
how much is logged so far, a streak, a rate, or when it was last done.

## The idea: the model points, code computes

A small model asked to "update my habits" invents habit names, rounds numbers, mixes up days, and paraphrases
the reason. So the model does only what code cannot: **decide which clause is about which habit.**

1. **Tag in code** (`tags.ts`): clauses `[C1]`, amounts `10 pages[N1]` (an hour is 60 min), days `yesterday[D1]`,
   negations `didn't[X1]`, reasons `because …[B1]`.
2. **One schema-bound call** (`match.ts`). Every field is an enum of ids that exist, so the model cannot name a
   habit, a number, a day or a reason that is not there.
3. **Code does the rest** (`compute.ts`): unit conversion to the habit's own, the goal when no amount is said,
   "another" adds, the day by calendar, the reason as written, and an ask when two habits fit the words equally,
   whatever the model said.

Matching words come from the habit's name, its shorthand, its keyword phrases (`lib/habit-keyword-source.ts`)
and the names of the Tracking tags that fill it (`trackingLink`, `lib/habit-tracking.ts`).

## Where things are

| Piece | Path |
|-------|------|
| Logic, flow, tests | [`lib/habit-helper/`](../lib/habit-helper/README.md) |
| Chat dialog, proposal table, Reasons view | [`components/Home/Habits/helper/`](../components/Home/Habits/helper/README.md) |
| Flow lab | [`components/Lab/HabitHelper/`](../components/Lab/HabitHelper/README.md), route `/lab/habit-helper` |
| Blueprint | `lib/agents/adapters/habit-helper.ts` |
| Shared model plumbing | `lib/bim-flow/ollama.ts`, `crew.ts` (`escalate`), `chat-models.ts` |

## Writes

Approved rows go through `useHabitsStore.updateCompletion` and `updateTask`, the calls a hand edit makes.
`TODO(A)`: the `source: "llm-suggestion"` argument and the `HabitCellChange` note arrive with session A's store
change (`docs/briefs/habits-2026-11/00-shared-contract.md`); until then the write carries no source.

## Limits and Planned

- Daily habits only. Exemptions are not read when counting misses.
- While a why-question is open, a message is its answer unless it reads as a log.
- **Planned:** BIM hands a habit message to the BIMBY.
- **Planned:** push or notification reminders for open habits.
- **Planned:** the phone shell; weekly, monthly and season habits.
