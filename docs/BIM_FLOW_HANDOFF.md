# BIM flow — handoff

_Last mapped: 2026-10-30 (second pass: question flows, inputs, tests, and the Hogan et al. plan below)_

For the next agent picking up BIM's model layer. Read this, then
`components/Lab/BimFlow/README.md`, then `lib/bim-flow/`.

## The goal (the person's words, condensed)

BIM gets stream-of-consciousness texts: "making garlic confit now" at 1:30,
"garlic done" at 2:00, "starting walk", a run of CD design ideas. A cheap
local model pipeline should pull out time blocks, ideas, people, mentions,
habits, intake, mood, and more. It then updates Brain2 in the right places.
The instructions get better with use, and later a per-person section shapes them.

It is built as a routed graph of nodes, like n8n or LangGraph: narrow yes/no
gates first, then targeted lookups and picks. It has a visual building and
testing bench.

## What exists now

- **Bench:** `/lab/bim-flow` (`app/lab/bim-flow/page.tsx` →
  `components/Lab/BimFlow/BimFlowLab.tsx`). Board, inspector, run panel.
  Green phosphor, the BIM console's glass. Nothing links to it.
- **Engine:** `lib/bim-flow/`.
  - `types.ts`: node kinds `message`, `gate`, `search`, `choose`, `extract`,
    `propose`, `blocks`; edges with port `out` / `yes` / `no`.
  - `run-flow.ts`: breadth-first walk per message. A node reads only outputs
    on its own path (`ctx.path`). A node runs once per message. Errors stop
    that branch only.
  - `vault-search.ts`: no model. Content words (stopwords out) are matched one
    by one, and a hit ranks by words matched. Items bring the lists they sit on.
    This keeps a pick to a handful of lists out of about 1000. Instagram dumps,
    word banks, and system lists (Log, Completed, Thought Process, All Items,
    Purchased) are skipped.
  - `blocks.ts`: spans are built by code. `placeSinceClock` puts "4:46" at the
    latest past moment. A since equal to the send minute is ignored, because
    models echo it. Open blocks are capped at 90 min with no message.
    Guesses are `estimated`.
  - `ollama.ts`: `127.0.0.1:11434`, JSON schema in `format`, temperature 0,
    `num_ctx` fixed at 4096, results cached in memory by prompt.
  - `default-flow.ts`: eight lanes. Activity → pens → pick → when → blocks.
    Habit, keep-on-a-list, person, intake, mood, body, and dream each get a lane.
  - `store-snapshot.ts`: the vault from live stores. `loadHubVault` reads
    `/api/persist` read-only when this window's stores are empty. A plain
    browser tab, and the Claude browser pane, never pull the hub.
  - `bim-flow.test.ts`: 9 tests. `npx vitest run lib/bim-flow`.
- **Teach:** open a message, select a gate, press Should be YES / NO. The
  message is stored on `config.examples` and shown as few-shot lines.
- The graph and the model are saved per device in `localStorage`
  (`bimflow-graph-v1`, `bimflow-model`).

## What testing on real BIM text taught (keep these)

The data was the person's Telegram feed, Oct 29–30 (`brain2-telegram-feed`).

1. One big "extract everything" prompt on `qwen2.5:14b-instruct` was bad.
   It tiled every empty hour with invented blocks. It read "Woke …" as sleep
   starting, ignored "since 4:46", and missed the confit.
2. One yes/no gate per room was close to right. Use gates, not multi-select
   arrays. Multi-select gets padded to the cap.
3. Under a grammar, a small model repeats array items until it runs out of
   tokens. Always set `maxItems` and `num_predict`.
4. Changing `num_ctx` reloads the model, about 25s. Keep it fixed.
5. Free-text fields ramble. Cap `maxLength` or use enums.
6. Speed: about 10s per message for the full graph on 14B (M2 Max, 32 GB).
7. Known misses in the bench run: the confit lines got pen **reading**, and
   "Confit like 40 more min" failed the activity gate. Teach those gates.

## Added in the second pass (all dry-run, nothing writes the vault)

- **Four flows** (`lib/bim-flow/flows.ts`): Log a message (now with place and
  company lanes), Ask about me, Summarize a topic, Recap a day. Each is saved
  per device (`bimflow-graph-v2:<id>`). `task-flows.ts` builds the last three.
- **New node kinds:** `related` (model adds words the notes may use),
  `retrieve` (code only: `entries`, `text`, `overlap`, `day`; counts, first,
  last, minutes, and repeated words are done in `retrieve.ts`), `answer`
  (modes `answer`, `summarize`, `check`; `check` re-reads the draft against the
  evidence). Per-question-type rules sit in the answer node's `extra`, added
  after the shared `ANSWER_SYSTEM`.
- **History in the snapshot** (`VaultSnapshot.history`, `people`): timegrid
  entries, BIM feed, log items, day notes, person names and nicknames.
- **Inputs** (`inputs.ts`): each message, grouped by time, whole day; plus
  Search, Related terms, and Semantic (Ollama `nomic-embed-text`, not installed
  yet: ask before pulling).
- **Tests** (`tests.ts`, `flow-tests.tsx`): 12 named tests, every run kept
  (`bimflow-tests-v1`, 120 runs). Checks are pass/fail where code can judge;
  open questions are `review`.
- **Lesson:** weight the subject's own words 3:1 over related words, or a newer
  row that only says "clean" outranks "Done with shower".
- **Real misses to fix:** the shirt question finds no worn-shirt rows because
  nothing records one (items mention shirts only as things to buy). The answer
  says so with confidence none. That is the right behaviour; the gap is data.

## Plan from the paper: Hogan, Dong, Vrandečić, Weikum (2025), "LLMs, Knowledge Graphs and Search Engines: A Crossroads for Answering Users' Questions" (arXiv 2501.06699)

Map: **SE** = word and embedding search over notes (`search`, `retrieve`).
**KG** = Brain2's own structure (items, lists, people, pens, timegrid entries,
links). **LLM** = the Ollama nodes. The paper's claim is that each fails where
another is strong, so BIM should route a question to the right one and let code
and the vault carry what a small model is bad at. That is already the shape of
the graph. What the paper adds, in order:

1. **Information-need taxonomy as the router.** Table 2 splits needs into Facts
   (popular, long-tail, dynamic, multi-hop, analytical), Explanations
   (commonsense, causal, exploratory), Planning (instructive, recommendation,
   spatio-temporal), Advice (lifestyle, cultural, philosophical). Own-life
   questions land here: *last time* = dynamic + long-tail, *how many / how long*
   = analytical (code, never the model), *with Elijah* = multi-hop, *summarize*
   = exploratory, *what should I do Friday* = planning (spatio-temporal), *how do
   I improve X* = advice. Next: give `x-plan.intent` this vocabulary, add the
   missing lanes (planning, advice), and let each lane choose its retrievals.
2. **The four failures become tests.** Hallucination, opaqueness, staleness,
   incompleteness. Hallucination: the `check` node and the unknown-question test.
   Opaqueness: ★ marks the evidence lines used; keep that visible in the app,
   with a tap through to the source row. Staleness: the snapshot is fixed per
   run; show its time, and re-read the hub before a hosted run. Incompleteness:
   the answer shows "N shown of M found"; add a *list all* mode that pages
   through rows instead of capping at 12, for "every time I…".
3. **Open World Assumption.** A missing row is not a "no". Answer rules now say
   "the notes do not record it". Add a *premise check* gate (false premises:
   "when did I last shower" is fine, "when did I last fly to Mars" is not) and a
   *clarify* node for ambiguity ("which Elijah?", two people matching a name)
   that returns a question instead of a guess.
4. **Deixis.** "Yesterday", "here", "me", "last week", "this morning" must
   resolve against the message time and the person's current place. `plan.days`
   covers time; add `plan.where` and resolve it from the latest Location entry.
5. **Federation: tools, not prose.** The paper's third phase is the LLM calling
   tools for sub-tasks. Add a `compute` node of plain functions (count, sum
   minutes, group by day or pen, streaks, date difference, top-N words) that the
   plan can name, so "how many hours" is a function call over entries and the
   model only phrases it. Calendar and weather reads go here too.
6. **KG for LLM: inject structure.** Put the person's profile (nicknames,
   relation, dates met), the pen's tag path, and list membership into the prompt
   as short triples. `namesFor` already does this for people; do it for habits
   and pens.
7. **LLM for KG: knowledge generation, carefully.** This is the auto-write item.
   The paper warns that model output pollutes a KG when its correctness is below
   the vault's, and that LLMs fill the long tail badly. So auto-write keeps what
   is already decided (tags, `llm` provenance, model, node path, `why`, one undo)
   and adds: write only above a per-lane confidence bar learned from the test
   history; write the *evidence span*, not a paraphrase; prefer `estimated`
   precision to a confident guess; and a "gaps" list (things asked about that no
   row can answer) instead of filling them.
8. **SE for KG: refinement.** Use retrieval to verify and deprecate, not only to
   answer: when a new message contradicts an entry (an open block that was
   finished, a habit done twice), propose the correction with both rows shown.
9. **Table 1 as the eval axes.** Score each flow on correctness, completeness,
   freshness, transparency, **coherency** (the same question run five times must
   give the same answer; the cache hides this, so the test needs a cache-off
   mode), and personalization. Add these to `TestResult` and a per-flow score
   row. This extends the existing eval-set item below.
10. **Ensemble to federation, in BIM's own order.** Today: a router of yes/no
    gates (ensemble). Next: nodes that call other nodes (federation), so the
    answer node can ask `retrieve` a follow-up when its first evidence is thin.
    Amalgamation (one shared representation) is the embedding-search item and
    stays last.
11. **Multilingual and controversy** are low priority for one person's notes;
    the person writes some French and Spanish, so the word-stem match in
    `termsMatched` should be checked on those before anything else.

## Third pass: routing, doors, analyses (all dry-run)

Read `docs/BIM_FLOW_RESEARCH.md` first; it holds the research and the backlog. The full reading lists are `docs/KG_ONTOLOGY_KGQA_REFERENCES.md` and `docs/KG_LLM_REFERENCES_AND_ROUTING.md`.

- **One screen per door**, one start node each: Log (parallel, baseline), Log:
  BIM text (routed), Log: phone capture, Log: time-grid note, Ask, Summarize a
  topic, Recap a day, Ritual: why-blocked reason, Ritual: night answer,
  Ritual: morning plan. The person prefers switching the view and running one
  routing at a time with different inputs over a map of many starts.
- **Node kinds added:** `route` (one output chosen by code regex first, then a
  model; ports `r:<key>`), `handoff` (run another flow, keep its results),
  `retrieve` kind `dataset` (Data-screen tables), answer mode `insight`.
- **Datasets** (`datasets.ts`, from the stores or the hub): `miss-reasons` (the
  Data → Reviews corpus), `ritual-answers`, `pushed-tasks`, `thoughts`,
  `moods`, plus `insight-log` (kept insights and answered questions).
- **Drive** (`drive.ts`, `drive-sheet.tsx`, `docs/BIM_DRIVE.md`): resistance and
  excitement about tasks, with reasons, as scores that decay and move. Read from
  long notes by cue windows + model + quote check; also a lane in the Log graph.
  Dataset `drive` and six Drive analyses. Next: link tasks to real items, feed
  `pull` into Ask and the morning plan.
- **Analyses** (`analyses.ts`, `analyses-sheet.tsx`): about 45 built-in
  analyses (a dataset, a slice, a lens), editable, copyable, hideable, with new
  ones added in the sheet. Each builds a node view (Patterns, then Questions,
  then Ideas). Code drops any insight that cites no real line (two for a
  pattern), says too few rows when under `minRows`, and drops repeats of the
  log. Results go to a log (new / kept / dismissed; questions take an answer)
  and a run log. Nothing writes the app.
- **Next:** see the backlog at the end of the research notes. The first picks:
  clarify node, structured query plan, `compute` node, watchers that open a
  door, and the eval set.

## The person's shorthand

- `o` / `O` is **orgasm**, its own Activity pen, and it carries a count. It is
  not weed.
- `addy` is Adderall (intake, drug).
- Activity pens live on scope `activity` in `brain2-timegrid-store`.

## Decided, build next (in this order)

1. **Auto-write, marked.** No approve step. Route each `propose` through the
   real write paths. The BIM executor's apply functions are in `lib/ingest/`
   (`apply-discrete-event.ts` for log, intake, and blocks; `apply-capture.ts`
   and `apply-bulk.ts` for lists; `apply-habit.ts`). Tag every write
   `autowritten` and `llm`. Store the model name, the node path, and any
   reasoning. Add an optional `why` field (maxLength ~120) to choose and
   extract schemas so there is reasoning to keep. Make each write one undo
   (`lib/ingest/phone-undo.ts` and `lib/action-history.ts`). A correction in
   the app becomes a taught example on the node that wrote it. Blocks use
   `generatedBy` with a new kind (for example `llm`) and
   `precision: "estimated"` when `estimated`.
2. **Topic runs become blocks.** Add a node that groups nearby messages by
   topic, such as CD design ideas over 30 minutes, into a span of that work,
   feeding `assembleBlocks`.
3. **Keep the graph in the vault**, so the hub (`npm run phone:hub`,
   `scripts/phone-hub.ts`) runs it when a message lands, after the existing
   grammar in `executor.ts`. Hosted models must never see this text
   (`docs/KNOWLEDGE_GRAPH_PLAN.md` §8.2 rule 5).
4. **Per-person instructions** with a safety layer. They may shape routing and
   preference. They may never widen what a node writes, reach outside the
   vault, or override fixed rules. All rooms get lanes over time. Priority
   comes from use.
5. **An eval set:** label real feed messages per gate, then score each gate per
   model in the bench.
6. **Embedding search** beside word search (`nomic-embed-text` through Ollama;
   see `docs/analytics-plan/13-local-readings.md`). Pull graph neighbours from
   the knowledge graph plan, and use its textbook notes (entity resolution,
   evidence spans, closed vocabulary) to make search and graph adds better.
7. **Faster gates:** try a 3–4B model for the yes/no gates, and keep 14B (or a
   small-active MoE) for choose and extract. A pull is a download. Ask the
   person first.

## Checks before you finish

- `npx vitest run lib/bim-flow`  (add tests for `retrieve.ts` and `inputs.ts`; none yet)
- `npx tsc --noEmit -p .` (grep for `bim-flow` / `BimFlow`)
- Open `/lab/bim-flow` and run a BIM day. Ollama must be running.
- Update `components/Lab/BimFlow/README.md` and the `bim-flow/` row in
  `lib/README.md`.

## Later: the flow writes the wiring (idea, not built)

_Added: 2026-10-30_

Today a flow routes a message to a write that already exists (a block, a list
item, a habit tick). The longer goal is a **build request**: the person says
what they want the app to be able to do, and BIM flow wires it up itself from
parts already in the app.

Example, in the person's words: "Make a new daily habit 'be home for more than
5 hours' and have it autodetect from location or be manually input."

What that needs the flow to do:

1. **Tell a build request from a note or a question.** A new door, `build-request`
   in `lib/bim-flow/entries.ts` (`built: false`), and a gate for it ahead of
   the log gates.
2. **Name the parts.** Habit (title, cadence `daily`, target `> 5 h`), a signal
   (location: home dwell time from the existing location/visit data), and a
   fallback (manual tick on the habit cell). The model picks from a closed list
   of known parts, never invents one.
3. **Write a spec, not code.** The output is a small, typed habit spec plus a
   binding to an existing source, checked by code before anything is created.
   Where no source exists, say so and fall back to manual.
4. **Create it through the real write path** (`lib/ingest/apply-habit.ts`),
   marked `autowritten` and `llm`, as one undo, like the other auto-writes.
5. **Safety.** Same fence as per-person instructions: it may create and wire
   from the closed list; it may not reach outside the vault or change fixed
   rules. Show a dry-run preview first (`flow-preview.tsx`) until trusted.

Test to start: `build-habit-home` in `lib/bim-flow/tests.ts`. It runs the
phone-capture door today and has no checks, so it is marked `review`. Read what
the gates make of it, then use the misses to design the new gate and parts list.

### Same idea for items, lists, and folders

_Added: 2026-10-30_

Three more build requests, from plain words:

- **New item** on a list that exists ("Add 'replace bike tube' to my errands").
  Find the list by words first, then add. If two lists fit, ask; do not guess.
- **New list or folder by request** ("Make a list called 'gift ideas' in a new
  folder 'people stuff'"). Create the folder if it is missing, then the list,
  then any item named in the same line.
- **New list by description** ("I keep forgetting movies people recommend, I
  need somewhere to keep those"). The model proposes a name and a folder from
  the folders that exist, and prefers an existing list when one already fits.
  A new list is only made when none does.

Rules: dedupe against existing names (`apply-capture.ts` and `apply-bulk.ts`
are the write paths); a new folder or list is marked `autowritten` and `llm`,
one undo for the whole request; dry-run preview first. Doors `build-list` in
`entries.ts` (not built); tests `build-item`, `build-list`, `build-list-described`
in `tests.ts`, all `review` until the gate exists.

## Phone texts as input

_Added: 2026-10-30_

`lib/bim-flow/texts.ts` (pure) and `texts-client.ts` (loader). The hub serves
`GET /api/phone-texts?days=&day=&index=1` from `data/phone-sync/messages.jsonl`
(`scripts/persist-api.mjs`). The window is recent on purpose: default 14 days,
hard cap 60. The person said old texts are almost never relevant to what they
are doing now.

- Feeds: `mine` (sent only), `all`, `bursts`. Lab source button **Texts**.
- Evidence: `retrieve` kind `texts`; counts (sending hours, quiet 90+ min gaps,
  people, reply median) come from code.
- Flow `texts-day` (**Texts: what was I doing**).
- Tests: `texts.test.ts`. Real-data check: `texts.bench.test.ts` (opt in with
  `BIM_TEXTS_BENCH=1`), results in `data/bim-flow-runs/texts-bench.json`.

**Bench result (2026-10-30, qwen2.5:14b, 60 sent texts inside confirmed Activity blocks, last 14 days).**
Naming the activity from a text did not work in any context style: right 1/60
with the text alone, 1/60 with earlier thread texts, 0/60 with the whole
conversation, 1/60 with my other texts nearby (always-guess-"scrolling" would
be about 25%). The model said "unknown" 77–85% of the time, which is mostly
correct: texts are sent from the phone, so the pen is usually scrolling and the
words are about other things. When it did commit, it was wrong (it read "taking
a nap" as Sleep while the block was scrolling, flight talk as Computer Work).
So do not use a text as an activity label. Use texts as presence and context:
when the person was sending, quiet gaps, who with, and what a text states
outright ("on my way", "at the thai place"). That is what the `texts` retrieve
and the `texts-day` flow do. Re-run: `BIM_TEXTS_BENCH=1 npx vitest run lib/bim-flow/texts.bench.test.ts`.

### Company and mood from texts

_Added: 2026-10-30_ Checked on the person's own Company and Mood blocks (Sept 1 – Oct 30).

- **Company: a real signal, in code** (`text-company.ts`). Texts to Elijah ran
  0.10 sent an hour in hours marked together and 1.54 apart (hours with any text
  with him: 18% together, 48% apart; 85% of hours that had a text were apart).
  So a live back-and-forth means "not in the same room". Silence only lifts
  together from 32% to 43%, so it is never reported. `texts` day reads add a
  fact like "trading texts with Elijah 14:00–16:00, so probably not in the same
  room", learned per person from their marked hours (needs 20+ hours each way).
  The lab loads 60 days of texts to learn this; only the last 14 are read as
  evidence. Only 41 company blocks exist in that span, so the rates will move.
- **Mood: weak, shown as a hint only.** Reading a day's sent texts (10 logged
  days): no clear match; the model rated 8 of 9 reads "none", and the sick days
  (9 to 12 Sept) came out as frustrated, scared, mixed, affectionate. Mood
  was logged on only 11 days, most all-day, so there is little to score against.
  The `texts-day` flow has a "Mood hint (weak)" extract that stays on its own
  lane; it is not fed into the answer. Re-run:
  `BIM_TEXTS_BENCH=1 npx vitest run lib/bim-flow/texts.mood.bench.test.ts`.

### Sleep from texts

_Added: 2026-10-30_ `text-sleep.ts`. No text was sent inside any of 26 logged Sleep
blocks; the last sent text came a median of ~2 h before logged sleep start and
the first ~1 h after wake (16 nights measured). The day read adds a "Sleep: no
text sent from X to Y … likely asleep A–B" fact, with offsets learned per
person (needs 8 nights). **The method for finding signals like this, the
results table, and a list of signals to try next are in
[`BIM_SIGNALS_PLAYBOOK.md`](BIM_SIGNALS_PLAYBOOK.md).** Read it before adding a
prompt that asks a model to guess something the data can show.

**Planned, separate:** an "old texts" tool for analysing one relationship, or
anything from before Brain2 had history (texts start in 2018). It needs its own
windowing by person and span and should not feed the daily flows.


## Told facts and questions (BIM Chat), 2026-10-30

_Last mapped: 2026-10-30_

"Tell BIM a fact and have it filed; ask BIM and, if it does not know, have it ask back." Built in the chat, not in the lab graph: `lib/ingest/bim-tell.ts` (pure grammar, no model), `lib/ingest/apply-tell.ts` (vault lookup, writes, the question), hooked in `lib/ingest/bim-chat.ts` ahead of the executor. Telegram is unchanged. Tests: `bim-tell.test.ts`, `apply-tell.test.ts`.

- Code-first on purpose, as in the playbook: the shapes the person actually uses are matched by grammar, names come from the vault (`name-resolve.ts`), dates from `findDay`. A line whose subject the vault lacks falls through to `log:`.
- The unknown-answer loop is `TellPending` (one open question, in memory). The answer is filed and the original command runs in the same step.
- **Planned:** a model fallback for phrasings the grammar misses (run it as one extract node, then reuse `applyTell`); more subjects (birthdays, "countdown to Shelby's birthday", last texted, habits); the lab graph could expose these as a `tell` door so they can be tested with scripted models; undo through BIM's `undo` word (today it is the app's Cmd-Z, one step per tell).
