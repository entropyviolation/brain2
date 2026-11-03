# Tracking BIMBY lab

The Tracking Helper is a **BIMBY** (BIM + baby): a small sub-agent that does one specific job. See `lib/agents/README.md`.

_Last mapped: 2026-11-02_

The lab shows both Tracking BIMBY pipelines. **Try it · description to timeblock pipeline** is the old Tracking Helper run. **Generate gap questions pipeline** (`GapQuestionsWell.tsx`) runs `lib/tracking-helper/gaps.ts` on the past 7 days of Tracking entries: lane coverage, per-day numbers, and the questions. **Use** on a question puts its opening words in the Try it box. Both wells have a Copy report key in the upper right.

Route: `/lab/tracking-helper/` (`app/lab/tracking-helper/page.tsx`). The Tracking Helper dialog has a **Flow lab** key.
A bench like [`../BimFlow`](../BimFlow/README.md), for a smaller flow. Runs write nothing to Tracking. The flow it edits is
the `HelperFlow` the chat reads (`trackinghelper-flow-v1`, `lib/tracking-helper/flow.ts`), so a change saved here is live in Tracking.

| File | Role |
|------|------|
| `GapQuestionsWell.tsx` | The gap questions well: run, coverage, questions, Use, Copy report |
| `TrackingHelperLab.tsx` | The bench, built on the agent Blueprint (`lib/agents/adapters/tracking-helper.ts`, `components/Lab/Agents/AgentRail.tsx`): the five stages and the Blueprint's facts, the editable parts of the selected stage, and a run panel with each stage's time, prompt and output |
| `tracking-helper-lab.css` | Its styling, over `../BimFlow/bim-flow.css` |
| `helper-tests.tsx` / `.css` | The test panel under the bench (below) |
| `SkillsPanel.tsx` / `skills-panel.css` | The skills panel under the tests: success per part, **Find new skills**, and Accept / Edit / Retire for each skill |
| `SkillsPanel.test.tsx` | Lists seeds, proposes and accepts, retires |

_Last mapped: 2026-11-01_ **Run with model** uses the ladder typed in WIRE, or the crew's extract ladder. **Run rules only** shows what the Helper does with Ollama off.
The bench sits in the page's flow (not fixed to the screen) so the test panel below it can be scrolled to.

## Stages and what is tuned

`ROUTE → TOKENIZE → WIRE → PLACE → WHERE`. Only WIRE asks a model.

| Stage | Tunable |
|-------|---------|
| ROUTE | the `revise` and `question` regexes |
| TOKENIZE | nothing; the tags found in the message, each clock's cue, and the tagged text |
| WIRE | system prompt, extra line, few-shot examples (tagged text + JSON, with a JSON check), model ladder, max tokens; the exact system text the model sees sits under a fold |
| PLACE | minutes given to a block whose end was never said; the fixed rules in code are listed |
| WHERE | learn a missing place from history on or off; the places learned from the person's rows right now (at least 2 sightings and 60%) |

A shipped change to the flow bumps `TRACKING_HELPER_REV`; the lab then loads the new one and keeps the old under a `:backup:` key.

## Skills (`SkillsPanel.tsx`)

_Last mapped: 2026-11-02_ Under the tests. Reads the per-device log and bank (`skillexp:tracking-helper`, `skillbank:tracking-helper`).
**Find new skills** runs `lib/skills/evolve.ts`: only parts under 80% accepted (at least 3 cases) are looked at, with the
crew's extract ladder when Ollama answers and plain lessons otherwise. Results are `proposed`; **Accept** makes one
reach the Helper's WIRE prompt, **Reject / Retire** removes it, **Edit** rewrites it. Shipped skills show as "shipped" and
are not sent in the prompt (they restate it). Research: `docs/SKILLRL_RESEARCH.md`.

## Tests (`helper-tests.tsx`)

Cases live in `lib/tracking-helper/tests.ts`: three shipped, plus any saved from the panel (`trackinghelper-tests-v1`). A case
holds the account, the day it was told, the rows it must become, and the model's recorded WIRE answer.

- **Replay** runs the code stages on the recording: no model, exact. Run it after touching clocks, certainty, chaining or places.
- **Live** asks the model again with the saved flow. Run it after touching a prompt, an example or the ladder. Rows pair up by
  day, times, certainty, place, and the activity's content words, so "doing dishes" matches "dishes".
- Cases run on an empty vault (no pens, no history), so a learned place never changes a golden answer.
- **New case**: paste an account, **Run live**, read the rows, **Save as test**. The recorded wiring is saved with it.

## Tuning loop

1. Find a message the Helper got wrong in the dialog. Paste it into the bench and run it.
2. Read the WIRE trace. If the model pointed at the wrong tag, add an example or a line to WIRE. If code placed a time wrongly,
   the fix is in `assemble.ts` or `clock.ts`, with a replay test.
3. Save the corrected run as a test. **Replay all**, then **Run all live**.

_Lessons so far (the first live 14B run on the Friday account):_ it picked "maybe until 5:30" as the walk's end, left "by 6:22 … done"
unlinked, and reused 7:34 as a "maybe end". The prompt got an example for the first. Code now adopts unused clocks and drops a
maybe-end that is another entry's edge.

## History

_2026-11-01:_ a first bench (`thl-*` classes, tests inline) was overwritten by the Blueprint-based bench while the agent rail was added. Its compiled copy was recovered from the dev build. The tests moved to `helper-tests.tsx`; the cue table, system text, fixed PLACE rules, learned-places table and **Run rules only** were ported back into the current bench.
