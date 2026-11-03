# Brief E: Daily Habit Helper (chat + flow + lab)

Read `docs/briefs/habits-2026-11/00-shared-contract.md` first. This is a new, separate helper built the way the **Tracking Helper** was built. Study these first:

- `docs/TRACKING_HELPER.md`
- `components/Lab/TrackingHelper/README.md`
- `lib/tracking-helper/`
- `lib/agents/adapters/tracking-helper.ts`
- `components/Lab/Agents/AgentRail.tsx`

Copy the idea: **the model points, code computes.** Self-hosted models (Ollama ladder) only. With Ollama off, a rules reader still works.

**Every change is a proposal.** Nothing is written until the person approves it, either per row or with Accept all.

## Where it lives

- **Chat:** Home → Habits → a **Chat** key that opens the helper, like Tracking → Chat.
- **Lab:** `/lab/habit-helper/` (`app/lab/habit-helper/page.tsx`, `components/Lab/HabitHelper/`). It shows the stages, the editable prompt and few-shot examples, the model ladder, and a run panel. Runs in the lab write nothing.
- **Flow code:** `lib/habit-helper/`, with a versioned flow key (`habithelper-flow-v1`) and a `HABIT_HELPER_REV`, like the Tracking Helper.
- **Not now:** don't hook into BIM chat yet. Write it in the docs as **Planned**: "BIM hands a habit message to the helper."

## What it does

### a. Read habit completions out of free text and propose exact updates

- **"daily habits completed - drank water, read 10 pages, stretched"** → proposals for the matching daily habits. For example, read → 10 pages, not just "done". Lamps flip on.
- **"walked for 30 minutes then ate a chocolate bar…"** → exercise 30 min, if that habit counts walking. Use the habit's name, shorthand name, keywords and Tracking links (`lib/habit-keyword-source.ts`, `lib/habit-connections.ts`). Ignore unrelated text, like the chocolate bar here.
- **"I didn't go outside today because I woke up too late and it was dark"** → propose **missed opportunity** on Go outside, with `missReason` set to the person's words **exactly as written** (`lib/habit-missed-opportunity.ts`).
- **Dates:** "yesterday" or "on Friday" resolve in code, the same way the Tracking Helper does it.
- **Ambiguity:** when a phrase could match two habits, ask. Don't guess.
- **Proposal cards:** each proposal card shows the habit, the day, old → new value, and the words it came from.
- **Approving:** writes go through store functions with `source: "llm-suggestion"` (contract). If session A's `source` argument isn't in your worktree yet, call the store function without it and leave a `TODO(A)` comment.

**Stages (a suggestion):** ROUTE (is this a completion, a miss, a question, or a command?) → TAG (code tags numbers, units, durations, dates, negations and "because" clauses) → MATCH (one schema-bound call; each field is an enum of habit ids and tags that exist, so the model can't invent a habit or a number) → COMPUTE (code converts units to the habit's value type and goal) → PROPOSE.

### b. Ask why and record it

- **Asking:** when a habit is missed, or keeps getting missed (for example 3 of the last 7 days), the helper asks why, one habit at a time, and never more than about 3 questions per chat.
- **Recording:** answers are saved word for word as the cell's `missReason` or as a `HabitCellChange.note`.
- **Reasons view:** a simple **Reasons** view per habit lists recorded reasons with dates and the most common words or themes, computed in code.

### c. Encourage

- **On open:** the helper lists today's unmet habits with one short, specific nudge each, drawn from the person's own data. For example: "You usually do this before 11; it's 9:40."
- **Reminders:** push or notification reminders are **Planned**.

### d. Shorthand names on request

- "Give relevant shorthand names to all of my daily habits that don't already have them" → a proposal table: habit → suggested `shorthandName`.
  - Use one or two plain words: "clean for 15 minutes" → "clean", "read 5 pages" → "read".
  - Names must be unique across habits.
  - Each row can be edited before you accept it.
- Approving writes `shorthandName` (contract field). Add the field to the type exactly as written if session A's change isn't there yet.

## Tests

As with the Tracking Helper, recorded cases replay with no model on every test run. At least these:

- The three example messages above
- The shorthand request
- A message that mentions no habit at all
- A date that isn't today ("yesterday I read 20 pages")
- One ambiguous match that must ask

## Done when

- The chat proposes and applies only after approval, both per row and with Accept all.
- The lab shows each stage.
- The rules reader works with Ollama off.
- Tests pass.
- `docs/HABIT_HELPER.md`, the Lab README and `components/Home/Habits/README.md` are written or updated. Anything not built is marked **Planned**.
