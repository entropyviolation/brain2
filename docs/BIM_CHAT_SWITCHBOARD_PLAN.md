# BIM chat switchboard — plan

_Last mapped: 2026-11-01_

All of this is **Planned** unless it says built. **Built 2026-11-01:** the crew (`crew.ts`, router escalation only; flows still use the two `ModelPlan` tiers), the router, the switchboard hook with an LLM on/off switch (desktop + iPhone, never Telegram), and the Ask lane in chat (phases 1–3, minus the eval set and the keycap fallback: an unsure route goes to the executor). It extends what exists. Nothing here
replaces the grammar ladder, the executor, or the flow bench.

The person's question: how can BIM's chat be better, using automated routing, real
chatting, and the BIM flows when they are needed, with several cheap models working
together?

The one named idea is the **switchboard**. Every line goes through code first. Then one
cheap model picks a lane from a closed list. Then only that lane's flow runs, and it
gets the smallest model that can do each step. A bigger model is called only when a
small one is unsure, fails its schema, or disagrees with code.

## 1. What exists now

- **Chat is grammar only.** `lib/ingest/bim-chat.ts` `sendToBim`: an open ritual or
  clarify question owns the line, then `tryTell` (`bim-tell.ts` / `apply-tell.ts`, no
  model), then `ingestIncomingAsync` (`executor.ts`, the Telegram ladder). A line that
  matches nothing becomes a plain log line. No model is ever asked from chat.
- **Questions are not answered in chat.** "How many hours of computer work this week?"
  is logged as a note. The answer machinery already exists in the lab: `askFlow()` in
  `lib/bim-flow/task-flows.ts`, with `compute`, `retrieve`, `guard` (KNOWN?), `clarify`
  (WHICH?), `answer` and a `check` pass. A pattern route settles most questions with no
  model call (`fallback-models.test.ts`).
- **Flows live in the lab.** `/lab/bim-flow` keeps graphs per device in `localStorage`.
  Only the LLM tab's Suggest button runs one from the app (`suggestWeek`). Runs are kept
  with an `origin` (`run-history.ts`).
- **Models.** Ollama only (`lib/bim-flow/ollama.ts`), JSON schema on every call,
  `temperature: 0`, fixed `num_ctx`. `ModelPlan` has two tiers, `gates` and `prose`
  (`types.ts`, `modelFor` in `run-flow.ts`). Installed: `qwen2.5:3b-instruct`,
  `qwen2.5:14b-instruct` (default), `qwen3:30b-a3b`, and `nomic-embed-text`.
- **Memory between turns** is one open tell question in memory (`pendingTell`) and the
  executor's pending clarify. The transcript is per device (`bimchat-transcript`).
- **Rules already decided** that this plan keeps:
  - Code first, model only when code returns nothing or ties (`KNOWLEDGE_GRAPH_PLAN.md`
    §8.2 rule 2; `BIM_SIGNALS_PLAYBOOK.md`).
  - Closed outputs: pick from existing ids, one label, never a padded multi-select
    (handoff lesson 2).
  - Private text never goes to a hosted model (§8.2 rule 5). Local or nothing.
  - Writes are marked `llm`, carry the model and node path, and are one undo (handoff
    "Decided" #1).
  - Route first, then run one lane (`KG_LLM_REFERENCES_AND_ROUTING.md` ENT-1…ENT-7).

## 2. What is wrong with chat today

1. Anything the grammar misses is logged, even a question or a correction.
2. BIM cannot hold a conversation. "And last week?" has no subject.
3. The lab can answer, count, recap, and suggest, but chat cannot reach any of it.
4. Every model step uses the same one or two models, so a yes/no costs the same as a
   paragraph.
5. Nobody can see *why* BIM did what it did from inside chat.

## 3. The shape

```
line ──► L0 code ladder ──(matched)──► reply                   (today, unchanged)
              │ nothing matched
              ▼
         L1 router: code rules ─► 3B, one label ─► (unsure) 14B
              │ label (+ optional second label)
              ▼
         L2 lane = a BIM flow, run by the crew
              │ ask · log · tell · build · correct · chat · unclear
              ▼
         L3 reply: text + evidence + cards + route chip ─► run kept
```

### L0 — code ladder (built, unchanged)

Open ritual / clarify, then `tryTell`, then executor verbs (`looksLikeVerb`, `groc`,
`log:`, shorthand like `o`, `addy`). Most lines end here for free. The only change: the
executor's last step, "nothing matched, so log it", hands to L1 instead.

The hook is one function, `routeUnmatched(text, thread)`, called from `sendToBim` when
the executor's result is that fallback log. Telegram uses the same hook once the hub
runs flows (phase 7). Until then Telegram keeps the plain log.

### L1 — router

One closed enum, `ChatIntent`:

| Label | Means | Example |
|-------|-------|---------|
| `ask` | wants a fact from their own data | "when did I last shower", "how much did I sleep this week" |
| `log` | something that happened or is happening | "making garlic confit now" |
| `tell` | a fact about a person, date or thing to file | "Shelby's birthday is March 3" |
| `build` | wants a habit, list, widget, rule made | "make a daily habit for being home 5+ hours" |
| `correct` | fixes BIM's last turn | "no, that was yesterday", "that wasn't a question" |
| `chat` | conversation, opinion, thinking out loud, general knowledge | "I'm so tired of this", "what temp for confit?" |
| `unclear` | can't tell | "ok", "hm" |

Steps, cheapest first (ENT-3), stopping at the first that is sure:

1. **Code rules.** Built from the shapes in `ask` routes and `bim-tell.ts`: a trailing
   `?` or a leading wh-word goes to `ask`. "No," / "not" / "wrong" right after a BIM turn
   goes to `correct`. "make / create / add a … habit / list / widget" goes to `build`. A
   clock or "now" plus a verb in `-ing` goes to `log`. Record `answeredBy: "code"`.
2. **3B call** (`qwen2.5:3b-instruct`). Schema: `{ intent: enum, second?: enum, sure:
   "high"|"low", why: string(≤80) }`. Taught examples come from route verdicts (§7),
   like gate `config.examples` today.
3. **14B call** only when the 3B says `low`, or its label fights a code hint (for
   example code saw `?` and the 3B said `log`).
4. **Still unsure** means BIM asks, with keycaps: "Log it, or were you asking?" This
   reuses `BimChoice` and the clarify buttons. The tap is a free labelled example.

`second` lets one line be two things, such as "just got back from Elijah's, when did I
last see Shelby?" (`log` + `ask`). At most two lanes ever run (ENT-5).

### L2 — lanes are flows

Each label hands off to a flow by id. The `handoff` node already exists. Each flow
declares a start kind, its allowed outputs, and a model-call budget (ENT-1, ENT-7).

| Label | Flow | Writes? | Status |
|-------|------|---------|--------|
| `ask` | `askFlow()`: pattern route, `guard`, `clarify`, `compute`/`retrieve`, `answer`, `check` | no | built in lab |
| `log` | `log-routed` (the Suggest graph), one message | proposals → cards, later auto-write | built in lab |
| `tell` | new `tell-extract`: one `extract` node into `TellParse`, then `applyTell` | yes, as today | **Planned** (handoff "Told facts") |
| `build` | `build-request` / `build-list` doors | proposal card only | doors and tests exist; lanes **Planned** |
| `correct` | new `correct`: says what the last turn wrote, offers undo / edit, records a verdict | undo only | **Planned** |
| `chat` | new `chat` flow (§5) | no | **Planned** |
| `unclear` | no flow; asks one keycap question | no | **Planned** |

Flows stay editable and testable on the bench. Chat runs the saved graph, as the LLM
tab does now. When the graph moves into the vault (handoff "Decided" #3), chat and the
hub run the same one.

### L3 — the reply

Each BIM line in chat carries:

- **Text.** For `ask`, the answer and its confidence.
- **Evidence.** Expand to see the rows it used (★ = used), the same as the bench Preview.
- **Cards.** For `log` and `build`, one card per proposal with ACCEPT / REJECT, reusing
  the `llm-suggestions.tsx` row and `accept.ts`. REJECT keeps the reason.
- **Route chip.** One line, for example `ASK · count · code→14B · 2.1s · 3 calls`. Tapping
  it opens the run in the bench's Runs sheet. Runs from chat get `origin: "bim-chat"` and
  their own cap, like `bimflow-button-runs-v1`.
- **Thinking.** The three bars show the step running now ("routing", "counting",
  "checking"), from the engine's `onStep` hook.

## 4. The crew: roles, not models

Today a node gets `config.model`, else a `ModelPlan` tier, else the run model. Make the
tiers into **roles** and give each role a short ladder of models. New file:
`lib/bim-flow/crew.ts`.

| Role | Node kinds | First model | Escalates to | Why |
|------|-----------|-------------|--------------|-----|
| `route` | router, `route`, `context` | `qwen2.5:3b` | `qwen2.5:14b` | one label, short prompt, needs speed |
| `gate` | `gate` | `qwen2.5:3b` | `qwen2.5:14b` | yes/no; handoff "Decided" #7 |
| `pick` | `choose` | `qwen2.5:14b` | `qwen3:30b-a3b` | needs to read options |
| `extract` | `extract` | `qwen2.5:14b` | `qwen3:30b-a3b` | schema fidelity matters most |
| `prose` | `answer` (answer, summarize, interview), chat replies | `qwen3:30b-a3b` | — | best writing; MoE, about 3B active, so fast |
| `check` | `answer` mode `check` | `qwen2.5:14b` | — | a different model from the writer catches more |
| `embed` | semantic search | `nomic-embed-text` | — | built |

`ModelPlan` grows to `Partial<Record<Role, string[]>>`. The old `gates` and `prose`
fields map to `route`/`gate`/`pick` and `prose`, so saved settings keep working.
`config.model` on a node still wins.

**How models work together.** There are four patterns, all in code, around `ModelCall`:

1. **Escalate.** Run the first model. Move up the ladder when the answer fails its schema,
   says `low`, or picks an id that is not in the options. Record each hop in the step.
2. **Vote on the hard ones.** For a gate marked `vote: 2` (`config`), ask the 3B twice
   with two different taught-example orders. If they agree, done. If not, the 14B breaks
   the tie. Use it only on gates whose eval score is close to the line (§7).
3. **Write and check with different models.** `prose` writes, and `check` re-reads the
   draft against the evidence on a different model. The check mode exists; the model
   split is new.
4. **Code is a crew member.** `compute`, `retrieve`, `guard`, `clarify`, `link`, and
   `assembleBlocks` do the counting and placing. A model only phrases or picks. This is
   most of the saving, and it is already built.

`ModelCall` returns meta beside the parsed answer (model, ms, tokens in / out, cache hit,
hop count). That lets the route chip, the Runs sheet, and the eval show cost per route.
The cache keeps working as today.

**Keeping models warm.** Ollama loads models on demand, so a cold 30B costs seconds.
Keep the 3B always loaded (`keep_alive: -1`). Keep the 14B and 30B at `15m`. Check memory
on the machine that hosts them: the 3B + 14B + 30B-A3B together need about 30 GB at
Q4. When memory is short, `prose` falls back to the 14B. Fixed `num_ctx` stays.

## 5. The `chat` lane: actually conversing

This is the new part. It stays grounded: BIM talks *about the person's data* or plainly
says it is talking generally.

**Thread state** (new, `lib/ingest/bim-thread.ts`), one per chat id:

- The last 8 turns, verbatim.
- **Focus:** entities linked in recent turns (`entity-link.ts` output: people, lists,
  pens, items) and the last time window used. "And last week?" reuses the focus subject
  with a new window. "What about Elijah?" keeps the question and swaps the person.
- **Open questions:** today's `pendingTell` and the executor clarify move here.
- **Rolling summary:** when the thread passes 8 turns, the 3B writes a summary of at
  most 3 lines of what was settled. Kept with the thread, never written to the vault.
- Stored beside the transcript. When the hub runs flows (phase 7), the thread moves to
  the hub so phone, desktop and Telegram share one conversation.

**The `chat` flow** on the bench:

1. `link` over the line + focus → entities.
2. `guard` (KNOWN?) on those entities. If nothing is known, the reply is general.
3. **tool pick** (new node kind `tool`, role `pick`): the model picks *at most one* tool
   from a closed list: `count`, `last`, `day`, `person-days`, `search`, `texts-day`,
   `none`. Code runs it with the existing `compute` / `retrieve` functions. At most two
   tool hops, then it must answer. This is agent-lite: the model chooses, code fetches,
   and the budget is fixed.
4. `answer` in a new mode `converse` (role `prose`): sees the thread, the summary, and
   the tool result. It must mark any sentence not backed by evidence as general ("in
   general, …"). Pronouns are never guessed, as in the house rule.
5. Optional `check` when a tool result was used.

Feelings ("I'm so tired of this") get a short, warm, plain reply. If the thread has data
that bears on it (sleep last 3 nights), BIM may offer it, not lecture. It can also offer
to log ("log tired?") as a keycap, which is how chat feeds tracking without guessing.

## 6. Where it runs

| Surface | Today | With the switchboard |
|---------|-------|----------------------|
| Desktop console (Electron) | grammar | full switchboard; Ollama is local |
| Phone BIM tab / iOS desk sheet | grammar | grammar on the phone; L1+ is sent to the Mac hub when it is reachable, else the line is logged and marked "BIM will answer when the Mac is awake" |
| Telegram | grammar | the same, through the hub (`scripts/phone-hub.ts`) |
| Oracle relay | sealed relay | **never runs flows.** It holds no clear vault (`ORACLE_CAPTURE_BOX.md`) |
| Mac mini (future) | — | the always-on home for Ollama and the switchboard (`boa-and-temporary-oracle-relay`) |

Lines that wait for the Mac are queued with their time, so a late answer still counts
"now" correctly.

## 7. Learning loop

All of these reuse built parts:

- **Route verdicts.** Long-press the route chip: "should have been ASK / LOG / …". This
  is stored like `suggestion-verdicts.ts` (new kind `route-verdict`) and becomes a taught
  example on the router, the same as **Should be YES / NO** on gates.
- **Card verdicts.** ACCEPT / REJECT reasons, as built. **Planned there already:** feed
  rejected reasons back as examples.
- **Corrections.** The `correct` lane links the fix to the run and node that made the
  mistake (handoff "Decided" #1: "a correction becomes a taught example on the node").
- **Eval set per role.** Extend `lib/bim-flow/real-feed.ts` with an `intent` label per
  line. Add the clarify taps and route verdicts from chat. Score code-only, 3B and 14B on
  routing in `real-feed.live.test.ts`. A model joins a role's ladder only when it beats
  the rung below it on that set (§8.2 rule 7). Show the scores in the Tests sheet (handoff
  "Decided" #5 next step).
- **Budgets you can see.** Each flow declares `budget.calls`. The chip shows the calls
  used. A lane that goes over budget stops and answers with what it has.

## 8. Hosted cheap models (optional, off by default)

Local covers everything above. A hosted tier is worth having only for text that is not
private:

- General-knowledge `chat` turns with no linked entities ("what temp for garlic confit").
- `build` requests, where the prompt is the app's own schema and the person's request,
  with names replaced by placeholders.

Rules, from §8.2: one switch per tier in Settings, with the model named. A **privacy
gate in code** runs before any hosted call. It refuses if the line or its tool results
touch a KG-P7 mark (cycle, sleep, mood, intake, a person's notes), a linked person, or
any phone text. A daily call cap and a counter are shown in Settings → Data. Every hosted
call is archived like `model-call`. The provider goes behind the same `ModelCall`, so a
role's ladder can name `hosted:<model>` as its last rung.

Which provider and model is the person's choice when this is built. Check prices then;
they change monthly.

## 9. Build order

Each phase ships alone and is tested with `scriptedModel` before it touches a real
model.

| # | Phase | Main files | Done when |
|---|-------|-----------|-----------|
| 0 | **Route eval set.** Label ~150 real chat and BIM lines with `ChatIntent`. Score code rules, 3B, 14B | `real-feed.ts`, `real-feed.live.test.ts` | a routing score per model, in the Tests sheet |
| 1 | **Crew.** Roles, ladders, escalate, vote, meta on `ModelCall` | `crew.ts`, `ollama.ts`, `run-flow.ts` `modelFor`, `types.ts` | old `ModelPlan` still works; tests for each escalation reason |
| 2 | **Router + hook.** `routeUnmatched`, code rules, 3B/14B, keycap fallback | `lib/ingest/bim-switchboard.ts`, `bim-chat.ts` | an unmatched line gets a label; the executor ladder is unchanged (existing tests pass) |
| 3 | **Ask in chat.** First win, read-only | switchboard → `askFlow`; reply with evidence + chip | "how many hours of computer work this week" answers in chat |
| 4 | **Thread + chat lane.** Focus, summary, `tool` node, `converse` mode | `bim-thread.ts`, `types.ts`, `run-flow.ts`, `task-flows.ts` | "and last week?" works; general answers say so |
| 5 | **Log + build cards in chat.** Proposals as ACCEPT / REJECT cards | `bim-console.tsx`, `bim-phone.tsx`, reuse `llm-suggestions` row + `accept.ts` | a log line shows the same cards the LLM tab does |
| 6 | **Tell fallback + correct lane** | `tell-extract` flow, `correct` flow, `route-verdict` | misses in `bim-tell.ts` file through the extract; "no, yesterday" fixes the last write |
| 7 | **Hub runs it.** Graph in the vault; Telegram and phone use the switchboard | `scripts/phone-hub.ts`, flow storage | text Telegram a question while the Mac is on; get the answer |
| 8 | **Auto-write, marked** for the `log` lane, per handoff "Decided" #1 | `lib/ingest/apply-*`, `phone-undo.ts` | cards become optional; writes are `llm`-marked, one undo |
| 9 | **Hosted tier**, if wanted | `crew.ts` provider, privacy gate, Settings switch | refused on every private test line |

Phases 1 and 2 can be built at the same time. Phase 0 can run in parallel with both.
Phases 3 and 4 each need 1 and 2.

## 10. Checks

- `npx vitest run lib/bim-flow lib/ingest`
- `npx tsc --noEmit -p .`
- `components/Bim/bim-screens.test.tsx` for the chat UI.
- A privacy test: every private room's line must never reach a `hosted:` rung.

## 11. What this does not change

- Telegram's grammar, pairing, and dedupe.
- The bench stays the place to edit and test flows. Chat only runs them.
- No model invents a list, person, pen, or relation. Picks come from existing ids.
- Writes go only through the existing apply paths, marked, one undo.
