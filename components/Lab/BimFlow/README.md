# BIM flow lab

_Last mapped: 2026-10-30_

Next steps and lessons for whoever picks this up: [`docs/BIM_FLOW_HANDOFF.md`](../../../docs/BIM_FLOW_HANDOFF.md).
Before adding a prompt that asks a model to guess something about the person, see [`docs/BIM_SIGNALS_PLAYBOOK.md`](../../../docs/BIM_SIGNALS_PLAYBOOK.md): learn the fact from their own data first, then hand it to the model.

A bench for building BIM's routed model flow and testing it on real BIM text.
Route: `/lab/bim-flow/` (`app/lab/bim-flow/page.tsx`). The BIM console's
LLM tab opens it; **← Brain2** goes back to `/`. Chrome is a milled silver bay
with house keycaps around phosphor glass wells. It writes nothing to the vault.

## What it is for

A message like "making garlic confit now" at 1:30 and "garlic done" at 2:00
should become a cooking block, a pantry note, and nothing else. One prompt
that asks for everything did badly on real BIM days: it filled every empty
hour with a made-up block and tagged most lines as idea + todo + buy. One
narrow yes/no question per room, then a small pick from a short list, did
much better. This bench is that shape, made visible and editable.

## How it is wired

- The engine is `lib/bim-flow/`. `run-flow.ts` walks the graph per message.
  A node reads only outputs on its own path back to the message.
- Node kinds:
  - **message**: the input.
  - **gate** (Y/N): one yes/no question. It follows the Y or N wire.
  - **search** (FIND): no model. The message's content words
    (`vault-search.ts`) are matched against items, lists, habits, pens, or
    people. Items bring the lists they already sit on. Instagram follower
    dumps and word banks are skipped.
  - **choose** (PICK): the model picks from that search's options only.
  - **extract** (PULL): named fields under a JSON schema. A clock comes back
    as written. Code places it.
  - **propose** (WRITE?): collects what would be written.
  - **blocks** (SPANS): hands an activity signal to `assembleBlocks`
    (`blocks.ts`). Code opens, closes, and estimates the spans after the batch.
    Any extract that feeds a `blocks` node is also shown the day's tracked context
    (`day-context.ts`): confirmed blocks, unknown gaps, location, screen time,
    company, mood, events, Health. Built blocks are trimmed around confirmed time.
  - **related** (TERMS): the model adds words the notes may have used.
  - **retrieve** (READ): no model. Reads tracked entries, messages and notes,
    days with a named person, or one day (`lib/bim-flow/retrieve.ts`). Code
    counts first, last, how many, minutes, and repeated words.
  - **answer** (SAY): the model writes from the evidence only. Modes: answer,
    summarize, check (re-reads the draft against the evidence).
- Ten views, picked at the top, one start node each: Log a message (parallel
  baseline), Log: BIM text (routed), Log: phone capture, Log: time-grid note,
  Ask about me, Summarize a topic, Recap a day, Ritual: why-blocked reason,
  Ritual: night answer, Ritual: morning plan (`lib/bim-flow/flows.ts`,
  `task-flows.ts`, doors in `entries.ts`).
- **compute** (COUNT, no model): `lib/bim-flow/compute.ts`. One counting function over tracked
  entries: `count`, `minutes`, `by-day`, `streak`, `days-since`, `longest-gap`, `top-pens`,
  `compare` (this span against the equal span before). A time word in the message
  ("yesterday", "this week", "last 10 days", "the weekend") sets the window; else the plan's
  days; else the node's. Output is shaped like a READ's, so SAY reads it and only phrases the
  facts. Machine-painted rows are left out unless asked.
- **guard** (KNOWN?, no model): Y when any subject word was ever written down (items, lists,
  habits, pens, people, entries, messages, logs, notes; stems match). N pushes a
  confidence-none answer ("the notes never mention …") and stops the lane, so the model is
  never asked about socks on Mars.
- **clarify** (WHICH?, no model): Y when a name fits two or more candidates
  (`entity-link.ts` `ambiguous`). It pushes "Which Elijah: A or B?" as the answer and stops.
  N goes on.
- **route** (ROUTE): picks one output by regex in code, else asks the model
  once; only that lane runs. **handoff**: passes the message to another flow.
- **link** (LINK) node: code-only entity linking
  (`lib/bim-flow/entity-link.ts`). Its output is shaped like a FIND node's, so a
  PICK can read it. The starter Log graph's people lane uses it (`s-people`,
  `linkKind: "person"`): nicknames and typos now find the person, and when
  nothing links it falls back to the old word search. `linkKind: "topic"` or
  `"any"` covers lists, habits, pens and items. Saved graphs keep their old FIND
  node until **Starter graph** is pressed.
- **Entity linking** (`lib/bim-flow/entity-link.ts`): code-only. An entity is a person or a topic (list, habit, pen, item).
  It finds the longest known name in a message, ranks candidates by match,
  message context, how often the notes mention it, and shared lists, and returns
  `linked`, `ambiguous` (two near-equal candidates, for a future clarify node),
  or `nil` (a capitalized name the vault lacks). Stages and sources:
  `docs/KG_ONTOLOGY_KGQA_REFERENCES.md`, `docs/BIM_FLOW_HANDOFF.md`.
- **Analyses** button: a catalog of what BIM looks for in the Data screens
  (miss reasons, ritual answers, pushed tasks, thoughts, moods), each a node
  view, with an insight log (Keep / Dismiss, answer a question) and a run log
  (`analyses-sheet.tsx`, `lib/bim-flow/analyses.ts`). Each graph is
  saved on its own (`bimflow-graph-v2:<id>`).
- **Drive** button: resistance and excitement about tasks, as scores that
  change (`drive-sheet.tsx`, `lib/bim-flow/drive.ts`, method in
  [`docs/BIM_DRIVE.md`](../../../docs/BIM_DRIVE.md)). The Log graph has a drive
  lane (gate → extract task / pole / strength / reason → `drive` proposal); after
  a run the lab writes those proposals to the drive log, the one thing a run
  keeps. **Scan notes** reads long notes, BIM messages and logs: code picks the
  sentences with feeling, the model reads them, code drops any reading whose
  quote is not in the text. The `drive` dataset and six Drive analyses make it
  readable by Analyses. Stored in `bimflow-drive-v1`. Saved Log graphs need
  **Starter graph** to get the lane.
- Inputs (`lib/bim-flow/inputs.ts`): each message, grouped by time, or the
  whole day, plus Search, Related terms, Semantic (needs `nomic-embed-text`).
- **Tests** opens a sheet (`flow-tests.tsx`) with 28 hand-written tests plus about 80 built from the person's own data (`lib/bim-flow/tests-real.ts`; see below) (the open view's tests lead the list, marked
  THIS VIEW; **Run N for <view>** runs just those on the graph as it is now) and every past
  run: answer, counted facts, evidence read, trace. Kept in `bimflow-tests-v1`.
  Each test has its own color (`testColor`). While one runs, its flow is drawn
  read-only: finished nodes take the test's color, the node running now pulses
  in it, and a ribbon below adds a card per finished step. Each kept run stores
  every step (`StepRec`: node, port, ms, output, prompt; outputs cut at 6000
  characters, first six inputs). Open a run to replay it: the path lit on the
  graph, the ribbon with a time bar per step, red at the step that errored, and
  a click on a step or node shows its full output and the prompt. Runs kept
  before this have text trace only. The engine's `onStart`/`onStep` hooks feed it.
- **Parallel runs.** Each Run press is its own job (`Job` in `BimFlowLab.tsx`):
  own abort controller, live messages, progress and notes. A chip row under the
  Run button lists up to 12 jobs, `●` while running. Click one to view it; Stop
  stops the viewed job only; **Clear done** drops finished chips. Switching view
  shows the newest job for that graph. The engine (`runFlow`) already shared no
  state, so the limit was the one shared abort. Drive scan, tests and analyses
  each keep their own abort (one at a time within a kind), so none stops a flow
  run. Jobs are in memory; every run is still saved to Runs. The local model
  decides how fast parallel calls really go.
- **Runs** (header button, `this view / all kept`) lists past runs, newest first
  (`flow-runs.tsx`, `lib/bim-flow/run-history.ts`, kept in `bimflow-runs-v1`,
  120 runs, plus the kept test runs). A scope switch picks **This view** or
  **All views**; a source switch picks Runs, Tests, or both; a node filter keeps
  only runs that went through that node (counts shown). Each keeps the graph as it
  ran, the input and the whole result, with big step outputs cut. Pick one to
  replay it step by step, or **Open output** (Run-button runs) for the dry-run
  preview. Every Run press saves. The picked run opens on its **Final answer** (large, with
  confidence, counted facts, evidence, blocks, suggestions, or the error), and each row shows
  the first line of it. **My note on this run** is a free-text box kept per run id in
  `bimflow-run-notes-v1` (saved when you leave the box); rows with a note say so.
- **Texts** (source button beside BIM day / Paste / Ask): the person's phone
  texts from the last two weeks, read from the hub (`/api/phone-texts`, loaded
  once by `lib/bim-flow/texts-client.ts`). Old texts are not relevant to what
  the person is doing now, so the server caps the window (default 14 days, never
  over 60) and the `texts` retrieve defaults to 30. A day is picked as for BIM
  days. A selector chooses how a day is fed: **What I sent** (each sent text is
  one line, "… (to Sam)"), **Both sides** (every text, speaker first), or
  **Conversations** (texts in one thread within 30 min join as one input).
  Every Log flow runs on these as on BIM text. The **Texts: what was I doing**
  flow (`texts-day`) reads the whole day: a `texts` retrieve counts when the
  person was sending, the quiet gaps of 90+ min, who they talked to, and reply
  speed (`digest` in `texts.ts`); a `day` retrieve adds what was tracked; an
  answer says what each stretch suggests and cites the text it used, then is checked.
  A `texts` retrieve with `days: 1` is a day read (every text that day, no word filter).
  The day read also adds a sleep window (`text-sleep.ts`: no text inside any of 26
  logged sleep blocks) and a company fact when the person is trading texts with
  someone they have marked as company (`text-company.ts`: texts to Elijah ran
  0.10 an hour together vs 1.54 apart), and a weak "Mood hint" lane that is
  not fed to the answer. Checked on real data: a single text almost never names the activity (1/60 right
  in every context style; the model mostly and correctly says unknown), so texts
  are used for presence and stated facts, not as activity labels. See the
  handoff for numbers.
  The day read also adds screen facts (`screen-presence.ts`): runs when the Mac was
  in use (ActivityWatch) and when Instagram ran on the phone, each with counts from
  the person's own confirmed blocks. Which pens they match is learned at run time;
  it says nothing under 8 Mac days or 10 phone days. Chrome-history blocks are
  left out (no gain over the baseline). Apps the person declared as evidence for an
  activity (`DECLARED_APPS`: Cursor means Computer Work, YouTube means youtube) are stated as their rule, not as a rate.
  File facts (`file-activity.ts`, loaded by `file-activity-client.ts` from the hub's
  `/api/file-activity`, a read-only walk of `~` cached ten minutes; the first call takes
  several seconds): files saved or changed in `elijah/foxtide` are stated as the person's
  rule for Foxtide work (`DECLARED_FOLDERS`); busy and quiet stretches are learned on
  their confirmed blocks, with noisy folders (like `websites`) dropped. It says nothing
  learned under 8 days with events or 40 blocks.
- **Pan**: drag the empty board to scroll it. A click without a drag clears the
  selection.
- **Preview** shows answers with their evidence (★ = used) as well as blocks and
  changes. The canvas opens at 68% with − + Fit.
- Model calls go to Ollama on `127.0.0.1:11434` (`ollama.ts`). `num_ctx` is
  fixed, because a new value reloads the model. Arrays carry `maxItems`.
  Without that, Qwen repeats list items until it runs out of tokens.
- The vault comes from the live stores. A plain browser tab has empty stores,
  because only Electron pulls the hub. There, `loadHubVault` reads
  `/api/persist` read-only. The top bar says which copy is in use.
- Teach: open a message, select a gate, then press **Should be YES** or
  **Should be NO**. The message is kept on that gate (`config.examples`) and
  shown to the model as a taught answer next run.
- The graph and the model choice are per device in `localStorage`
  (`bimflow-graph-v1`, `bimflow-model`). **Starter graph** restores
  `defaultFlow()`.

| File | Role |
|------|------|
| `BimFlowLab.tsx` | Page state, message source (a BIM day from the Telegram feed, or pasted `HH:MM text` lines), run, results, blocks |
| `flow-canvas.tsx` | Node board: drag nodes, pan the background, wire from ports, select a wire, lit trace, live test glow, read-only mode |
| `analyses-sheet.tsx` | Analyses sheet: catalog and editor, insight log, run log |
| `drive-sheet.tsx` | Drive sheet: per-task resistance / excitement board, readings, scan |
| `flow-runs.tsx` | Runs sheet: past runs of the open view, replay, reopen the output |
| `flow-tests.tsx` | Test sheet: tests with their colors, live run view, replay of every kept run |
| `flow-inspector.tsx` | Edit a node, read its step for the open message, teach a gate |
| `flow-preview.tsx` | Dry-run sheet over a finished run: time blocks on an hour axis with a tick per message, items grouped by list, other changes; each card names its message and node. Opens after a run, or with **Preview** |
| `bim-flow.css` | Green phosphor, the BIM console's glass |

## Tests from the person's own data

_Last mapped: 2026-10-30_

`lib/bim-flow/tests-real.ts` holds tests worded from the real vault. **Real ·** tests are
BIM texts sent Oct 14–30 (shorthand, one-word lines, open-ended times, spending, medicine
counts, dreams, brain2 ideas that are not activities, links with notes, rules that want a
build). **Vault ·** tests come from the rest of the store: older text-log entries
(Sep 23–Oct 15), lists and their items (needed, reading, films, cook, perfume, trip,
Foxtide CDs), habits, task regrets, day reviews and day notes. They cover every view:
routed log, grammar-first, phone capture (duplicates, placing, multi-item, builds), time-grid
notes, Ask, Ask: count it, Summarize, Recap a day, and the three rituals. A test may carry
`expect`, the words a good run should meet, shown as "Should:" in the sheet. Most have no hard
check, so they read as "review". Instagram handles and phone numbers were left out; a
stranger's name was swapped. The inputs are verbatim private text and are committed with the
repo.

## Scenarios, structures and a made-up week

_Last mapped: 2026-10-30_

Tests that need no model. `lib/bim-flow/scenarios.ts` holds one invented week (Oct 24–30,
2026, "now" Fri 15:00) where every right answer is known by hand: a 5-day walking streak, a
17-day gym gap, a machine-painted cooking row, two people named Elijah, a French note. Its
`scriptedModel` answers by rule and defaults to the safe answer (gate no, pick none), so a
test states only the model replies it needs.
- `compute.test.ts`: `parseWhen` on 13 phrasings and month/week edges; every compute
  function, empty and missing data; `premiseCheck` (stems, French).
- `scenarios.test.ts`: the **Ask: count it** flow end to end (`askCalcFlow`): hours, streak,
  days since, week over week, two lanes at one SAY, the premise guard, which Elijah.
- `structures.test.ts`: diamonds, cycles, self-loops, orphans, 60-deep chains, 40-wide fans,
  gate/guard/clarify/route ports, failing nodes, bad regexes, handoff depth, and a 150-seed
  fuzz: any wiring ends, runs each node at most once, and only runs reachable nodes.
- `grammar-first.test.ts`: **Log: grammar first** (`grammarFirstFlow`). BIM's own verbs
  (`log:`, `intake:`, `dh:`, a link first, `groc`/`lists`/`info`) are routed by code with no
  model; a plain line goes on to the routed log flow.
- `blocks.scenarios.test.ts`: block timelines. It found a real bug: a "finished" with no
  start reached back 30 min over the block before it. It now starts where that block ended.
- Opt-in live pass: `BIM_LIVE=1 npx vitest run lib/bim-flow/scenarios.live.test.ts` runs the
  new flows on the same week against Ollama and checks the model repeated the counted number.

## Every run is archived

Each model call, flow run, and test result is also posted to
`/api/bim-flow-archive` (`lib/bim-flow/archive.ts`), which appends one JSON
line to `data/bim-flow-runs/YYYY-MM-DD.jsonl` (git-ignored, append only). The
browser history above still caps at 40 runs and 80 tests; the archive does not.
Runs Claude starts in the lab while testing are kept the same way. Needs the
app server running (it holds `scripts/persist-api.mjs`).

## Test pass, 2026-10-30

All 22 tests were run once and kept (`data/bim-flow-runs/`, git-ignored). Findings and fixes to try: [`docs/BIM_FLOW_TEST_FINDINGS.md`](../../../docs/BIM_FLOW_TEST_FINDINGS.md). Applied after it:

- Test output shows block clocks in local time (it showed UTC).
- Word match in `retrieve.ts` no longer treats "show" as "shower".
- A habit or person proposal with nothing picked is dropped, not shown.
- The Ask flow's "Any other fact?" gate is worded so an odd personal question still reaches the notes and gets "the notes do not record it". The phone capture's command gate has make/add examples.
- The answer prompt says "2 days ago", not "before TODAY".

Saved graphs keep old prompts until **Starter graph** is pressed.

## Told facts live in the chat, not the lab

Facts and questions typed to BIM ("I last saw Shelby July 5th", "when did I last see Shelby?", "countdown to when Elijah comes home") are handled by the chat (`lib/ingest/bim-tell.ts`), not by a graph here. See `docs/BIM_FLOW_HANDOFF.md`. **Planned:** a lab door for them.

## Decided, not built

_Last mapped: 2026-10-30_

- **Auto-write, marked.** Proposals write straight to the vault through the
  BIM executor, with no approve step. Each write is tagged `autowritten` and
  `llm`. It carries the model name, the node path, and any reasoning the model
  gave. Correcting a write feeds back as a taught example on the node that
  made it. Every write stays one undo.
- **Topic runs become blocks.** A run of messages on one project (30 minutes
  of CD design ideas) implies a block of that work for the span. This needs a
  node that groups nearby messages by topic before `assembleBlocks`.
- **Every room, ranked per person.** All rooms get lanes, and more will come.
  Which ones matter most comes from use and stated preference. That is kept
  in a per-person section of the instructions, which changes person by
  person.
- **Guarding the per-person section.** Because people can edit instructions,
  that section needs a safety layer before it ships to anyone else. It may
  shape routing and preferences. It may not widen what a node can write,
  reach outside the vault, or override the fixed rules.

- **Build requests.** "Make a new daily habit 'be home for more than 5 hours'… autodetect from location or manual" should wire a habit to a location signal from existing parts. Door `build-request` and test `build-habit-home` exist to probe it; the gate and parts list are not built. See `docs/BIM_FLOW_HANDOFF.md`.
- **Build requests for items, lists, and folders.** Add to an existing list, make a list or folder on request, or make one from a description (an existing list wins when it fits). Door `build-list` and tests `build-item`, `build-list`, `build-list-described` probe it. Not built.

- **Old texts (separate tool).** Texts go back to 2018 (about 300k bodies in
  `data/phone-sync/messages.jsonl`). The Texts source here is deliberately
  recent only. A later, separate tool should read the old texts for one
  relationship, or to learn about something from before Brain2 existed or knew
  anything, on its own screen with its own windowing (a person, a span, a
  topic), never mixed into the daily flows.

**Planned:** the question-routing, tools, and eval plan from Hogan et al. 2025 and the KG+LLM reading is in `docs/BIM_FLOW_HANDOFF.md` and `docs/BIM_FLOW_RESEARCH.md`. Also: keep the graph in the vault, not per device; a labelled test set
with a score per gate; embedding search beside word search; and running the
graph on the hub when a message lands.

## Suggestions in the app

_Last mapped: 2026-10-30_

The BIM console's LLM tab (`components/Bim/console/llm-suggestions.tsx`) runs this engine on the last week and lists unsaved time blocks, items, and habit completions (`lib/bim-flow/suggestions.ts`). It uses the bench's saved `log-routed` graph and model. Texts feed time blocks and habits only, never items. Dismissals and cached per-message results live in `localStorage` (`bimsuggest-*`). Nothing is written to the vault yet; accepting a suggestion is **Planned**, on the auto-write plan in the handoff.
