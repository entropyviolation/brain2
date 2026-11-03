# Habits BIMBY flow lab

_Last mapped: 2026-11-02_

Route: `/lab/habit-helper/` (`app/lab/habit-helper/page.tsx`). The Habits BIMBY dialog has a **Flow lab** key.
Built like [`../TrackingHelper`](../TrackingHelper/README.md) and reuses its stylesheets
(`tracking-helper-lab.css`, `helper-tests.css`) over `../BimFlow/bim-flow.css`. Runs write nothing to Habits. The
flow it edits is the one the chat reads (`habithelper-flow-v1`), so a change saved here is live in Habits.

| File | Role |
|------|------|
| `HabitsBimbyLab.tsx` | The bench, on the Blueprint (`lib/agents/adapters/habit-helper.ts`) and the agent rail: five stages, the selected stage's settings, a run panel with each stage's time, prompt and output |
| `habit-helper-tests.tsx` | The test panel under the bench |

## Stages and what is tuned

`ROUTE → TAG → MATCH → COMPUTE → PROPOSE`. Only MATCH asks a model.

| Stage | Tunable / shown |
|-------|-----------------|
| ROUTE | the shorthand, reasons, nudge, question and skip regexes; how the text on the right routes |
| TAG | nothing; the tags found and the marked text |
| MATCH | system prompt, extra lines, few-shot examples (habit lines + tagged text + JSON, with a JSON check), model ladder, max tokens; the system text and the habit lines the model sees |
| COMPUTE | the why-question limits (per day, look-back, threshold) and what it would ask now; the fixed rules |
| PROPOSE | today's open habits with their nudges |

**Run on the test habits** (on by default) uses `FIXTURE`; off, it runs on your own daily habits, still writing
nothing. **Run rules only** shows the BIMBY with Ollama off.

## Tests

Seven shipped cases (`lib/habit-helper/tests.ts`): the three brief examples, the shorthand request, a message
with no habit, "yesterday I read 20 pages", and an ambiguous "read" that must ask. **Replay** uses the recorded
MATCH answer; **Rules** the rules reader; **Live** asks the model. **New case**: run live, read the rows, save.
Vitest runs every shipped case by replay and by rules.

_First live run, 2026-11-02 (qwen2.5:14b-instruct):_ the "didn't go outside" message gave one row, missed, with
the reason exactly "I woke up too late and it was dark", in 35 s cold.
