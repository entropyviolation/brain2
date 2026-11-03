# BIM chat — one conversation, many cheap models

_Last mapped: 2026-11-01_

How BIM's chat gets better by joining three things that exist apart today: the
code grammar that files a line, the BIM flows that read a line with small models,
and a chat that talks back. Everything here is **Planned** unless it says built.

Read first: `docs/BIM_FLOW_HANDOFF.md` (the flow engine and its lessons),
`docs/BIM_SIGNALS_PLAYBOOK.md` (learn a fact from the data before asking a
model), `docs/KNOWLEDGE_GRAPH_PLAN.md` §8.2 (guardrails for any model).

## What the person asked for, in their own BIM texts

- "TOTALLY LOCAL self improving personal intelligence system that is genuinely
  grounded and knowledgable about me" (Dear BIM, Oct 30).
- "Bim is a general all app function and immediate intake capture log for so many
  different types of inputs and can properly route them all" (Oct 31).
- "create little 'cognitive processes' … go through a series of steps to assess …
  where user can manually edit those if they so choose or command them to be
  created" (Oct 31).
- "allow llm bimflow to ask for message context as a tool" (Oct 30). Built as the
  `context` node, 2026-11-01.
- "Be able to say to bim 'i want to scroll less'" (Oct 30). "autoadd to texts to
  send list … matching 'text back {}'" (Oct 27). "ANY PROMPT BEGINNING WITH 'Stop'
  being flagged as a thing" (Oct 30). "allow adding reasons for rejecting" (built).
- "just USE the app … get consistent bimput being sent through chat interface there
  (ios app) instead of here (telegram)" (Oct 31).

## What exists now

- **Chat** (`lib/ingest/bim-chat.ts`): a typed line goes to `bim-tell.ts` (told
  facts and questions, code only), else to the executor (`executor.ts`), the same
  ladder Telegram uses. A plain line with no verb becomes a `log:` entry. There is
  no model anywhere in this path. The transcript lives in `localStorage`.
- **Telegram**: the hub (`scripts/phone-hub.ts`) runs the same executor. Oracle is
  a temporary sealed relay that never reads text.
- **BIM flows** (`lib/bim-flow/`): routed graphs of gates, picks and pulls on
  Ollama. Used by the lab and by **Suggest** in the BIM console, which reads the
  last 7 days after the fact. Nothing runs when a message lands.
- **Models on this Mac**: `qwen2.5:3b-instruct`, `qwen2.5:14b-instruct`,
  `qwen3:30b-a3b`. Measured: a 14B gate takes 0.7–1.7 s; a full parallel graph
  about 10 s per message; the Ask flow 6–25 s.
- **Evals**: `real-feed.ts` (108 labelled real lines, 48 context pairs),
  `label-model.ts` (what code alone allows), `real-feed.live.test.ts` (per-room
  model scores).

The gap: the chat files fast but never understands; the flows understand but only
later, and only in the lab or a button. The chat never talks.

## The shape: four layers per message, cheapest first

Each layer runs only when the one before it did not settle the line. A layer
that settles it answers at once; slower layers can add to the answer later.

| Layer | What | Model | Budget |
|---|---|---|---|
| **L0 code** | BIM grammar, `bim-tell`, links, `context-link`, entity linking, `cueLists`, dedupe, undo | none | under 50 ms |
| **L1 front door** | One call: what is this line? `file` · `ask` · `do` (command or build) · `talk` · `fix` (a correction) · `stop` | 3B | under 1 s |
| **L2 lanes** | `file` → routed log flow. `ask` → Ask / Ask: count it. `do` → build-request flow. `talk` → the chat lane. `fix` → the correction lane | 3B gates, 14B picks and pulls, 14B or 30B-a3b prose | 2–15 s |
| **L3 later** | Re-read the day with the big model, Suggest, day interview, evals, learning | 30B-a3b | overnight, or when idle |

### L0: code first, always

Unchanged ladder, plus what the flows have that the chat lacks:
- Run `linkPrior` (`context-link.ts`) on every line, so later layers see only
  the earlier lines it needs.
- Run entity linking (`entity-link.ts`) and keep the links on the message, so no
  model has to find "rebcca" again.
- New grammar from the person's own habits: a line starting `Stop` is flagged
  (they asked), `text {} back` / `respond to {}` goes to "texts to send", `I want
  to …` becomes a goal candidate (see **talk** below).
- The executor keeps filing exactly as now. L1+ never undo a code write; they add
  to it or offer a correction.

### L1: one cheap front door

One 3B call with an enum answer, few-shot from the person's own lines. It
replaces asking every lane. Rules:
- **Code first.** A regex route (as `route` nodes already do) settles the plain
  shapes ("when did I", "how many", "remind me", a `?` at the end) with no call.
- **Escalate on doubt.** Ask for `{ door, sure: clear|weak }`. `weak` re-asks the
  14B once. Two models disagreeing is the signal, not a self-reported score.
- **Default is `file`.** The person's feed is mostly filing. A line that is not
  clearly something else is filed, as the executor does today.
- Scored on `real-feed.ts` with a new `door` label per line. It ships only if it
  beats "always file" on that set (KG plan §8.2 rule 7).

### L2: lanes are BIM flows

Each door is a flow in `lib/bim-flow/flows.ts`, run by `runFlow` on the hub, so
the lab, the tests, and the chat share one graph.

- **file** → `log-routed`. Proposals are written by the existing auto-write plan
  (handoff, "Decided, build next" 1): marked `llm`, one undo, only in lanes whose
  eval score clears a bar. Below the bar they wait in Suggest, as now.
- **ask** → `ask-calc`, then `ask`. Code counts, the model phrases. The answer
  quotes its evidence lines. "The notes do not record it" stays a valid answer.
- **do** → build requests: add an item to a named list, make a list, make a
  habit wired to a signal (handoff, "Later: the flow writes the wiring"). Always a
  dry-run preview in the chat first ("Make list *gift ideas* in *people stuff*?
  yes / edit / no").
- **fix** → "no, that was walking", "wrong list", "undo that". Code finds the last
  write BIM made from this chat (`phone-undo.ts`, `action-history.ts`), undoes or
  edits it, and stores the line as a taught example on the node that made it
  (`config.examples`), plus a rejection verdict (`suggestion-verdicts.ts`). This
  is how the flows improve with use.
- **stop** → closes any open question, ritual, or interview at once. No model.
- **talk** → see below.

### The talk lane: a chat that knows the person

For lines that want a reply, not a filing: feelings ("Crying because…"),
thinking out loud, "what should I do now", "i want to scroll less".

1. **Read before speaking.** A `retrieve` day read (`kind: "day"`, `everything`)
   plus the open thread (last 10 chat turns) plus a short **profile**: the
   person's own goals, rules (`DECLARED_APPS`, `DECLARED_FOLDERS`), top lists,
   current objective, today's plan. Triples, not prose (handoff plan item 6).
2. **Reply small.** One to three sentences, as "you", no advice unless asked, no
   diagnosis (same rules as `INSIGHT_SYSTEM`). A `check` pass drops any claim the
   evidence does not hold.
3. **Offer one action, never take it.** "Want that as a goal: scroll under 2 h a
   day, counted from Screen Time?" A tap turns it into a `do`.
4. **Ask back sparingly.** At most one question per hour unless the person is
   mid-conversation. Questions come from the day interview (`interview` answer
   mode) and gaps the code found (unknown stretches, a block with no end).
5. Model: 14B by default; 30B-a3b when it is loaded and idle (MoE, about 3B
   active, so it can be fast enough). Pick by the eval, not by size.

### L3: later, with the big model

- Overnight: re-read the day's lines in order with `qwen3:30b-a3b`, with the day
  grouped by topic (handoff "topic runs become blocks"), and compare with what
  L2 filed. Disagreements become Suggest rows with both readings shown.
- The day interview: a few questions waiting in the morning, not at night.
- Learning: rejected and corrected writes become taught examples; new real lines
  the person corrected are added to `real-feed.ts` labels (a "Keep as test"
  button on a chat line).

## Many cheap models working together

- **Roster by job, chosen by score.** Each node kind gets a tier (`ModelPlan`
  already has `gates` and `prose`). Add `front` (L1) and `big` (L3). For each
  gate, run `real-feed.live.test.ts` on every installed model and keep the
  cheapest one within 3 points of the best. Store the table in the vault; show it
  in the lab.
- **Cascade, not committee.** Small model first; the bigger one only on `weak`,
  on a disagreement with code, or for the final reply. A three-model vote costs
  three times as much and the feed showed padding, not wisdom, from wide asks.
- **Two resident at once.** On 32 GB: the 3B (2 GB) stays loaded with
  `keep_alive`; the second slot is 14B (9 GB) or 30B-a3b (18 GB), not both.
  `num_ctx` fixed per model (a change reloads it, about 25 s).
- **Cache by text hash** (already in `ollama.ts`), plus a per-day call counter
  in Settings → Data (KG plan §8.2 rule 6).
- **Local only.** The text never goes to a hosted model (KG plan §8.2 rule 5).
  Oracle stores sealed text and runs no model. If a hosted model is ever allowed,
  it gets non-private work only (a link's public title), behind its own switch.
- **Embeddings** (`nomic-embed-text`, not installed: ask before pulling) for
  "have I said this before?", similar past lines as few-shots, and semantic Ask.

## Cognitive processes the person can edit

The person's "cognitive processes" are the BIM flows, named and callable.

- Each flow gets a **name, a trigger, and a reply rule**: "Recap: every night at
  23:00, send the three questions", "Resistance check: when a line says resist,
  dread, or avoid, run Drive and say nothing", "Morning plan: when I write
  'Today:'".
- Triggers: a door from L1, a regex, a time, or a tracked event (a block ends, a
  habit is missed). Start with door and time.
- **Made by chat**: "make a process that checks every evening whether I texted
  Elijah back" → a `do` that drafts a flow from known parts and shows it in the
  lab for a yes. Like Cursor for the person's own routines.
- **Per-person instructions**, guarded (handoff "Decided" 4): they may change
  routing and wording; they may not widen what a node writes, reach outside the
  vault, or turn off undo.

## Where it runs

- The **hub** runs the pipeline when a line lands, after the executor: Telegram,
  the desktop chat, and the iOS chat all post to the same place. One transcript,
  in the vault, not `localStorage`.
- The graph and the model table move into the vault (handoff "Decided" 3), so the
  hub and the lab run the same thing.
- Today the hub is this Mac; later the Mac mini (`docs/ORACLE_INTERIM_SYNC.md`).
  With the Mac asleep, L0 still files when it wakes (drain), and L1+ catch up in
  order, saying "(late)" on old lines.

## Reply design

- **Two beats.** L0 answers at once ("Logged"). When L2 finishes, BIM edits that
  same message (Telegram `editMessageText`; the chat replaces the line): "Logged ·
  cooking from 09:50 · on *cook*". Never a second ping for a filing.
- **Say what was done, with one undo.** Every reply names its writes and offers
  undo / fix as buttons (`bimChoices`).
- **Quiet by default.** Filing never asks a question unless a write would be
  wrong without it (which Rebecca; a list that does not exist yet).
- **"Why?"** on any reply shows the trace: which door, which nodes, which
  evidence lines, which model. Every chat run is kept in Runs with origin
  `brain2-chat` (the person asked for production runs to be stored for review).

## Trust ladder per lane

1. **Shadow**: the lane runs, writes nothing, results go to Runs and Suggest.
2. **Suggest**: shown in the chat as a one-tap row.
3. **Auto, marked**: writes with `llm` and one undo; shown in the reply.

A lane moves up only when its live score on `real-feed.ts` clears the bar and
the person's reject rate in the last 14 days stays low. It moves down by itself
when rejects rise.

## Phases

Each phase is small, ends in something usable, and is scored on the real set.

1. **Front door, shadow.** Add `door` labels to `real-feed.ts`; build the L1
   route as a flow `chat-door`; score 3B and 14B. Run it on the hub after every
   line, write nothing, keep the runs. _Done when_ the door beats "always file"
   on the set and runs under 1 s.
2. **Ask in the chat.** A line the door calls `ask` gets an `ask-calc` answer,
   edited into the reply. _Done when_ the counted-question cases from
   `scenarios.live.test.ts` and the real Ask tests pass from the chat.
3. **Fix lane.** "no, that was X" / "wrong list" / "undo that" undo or edit BIM's
   last write and become taught examples. _Done when_ a corrected line's
   example shows in the inspector and the next run of that line changes.
4. **File lane, auto for the best two rooms.** Two-beat replies; auto-write the
   rooms that score best (likely activity blocks with a stated clock, and
   head-named lists); the rest stay Suggest.
5. **Talk lane.** Profile triples, day read, small reply, one offered action,
   question budget. Start with "I want to …" → goal.
6. **Processes.** Name, trigger, reply rule on flows; a time trigger for the
   night recap; "make a process that …" drafts a flow for a yes.
7. **Move to the vault and the hub.** Graph, model table, transcript; the iOS
   chat posts there.
8. **L3 overnight** re-read with 30B-a3b and disagreement rows.

## How we know it got better

- `real-feed.live.test.ts` per room and per model, kept by date, compared run
  to run; add a `door` score and a reply check.
- Latency per layer in each run (the steps already carry `ms`).
- From use: share of lines filed with no correction, reject rate per lane,
  questions asked per day, "why?" taps.

## Open questions for the person

- Should BIM ever start a conversation (a morning question), or only answer?
- Which two rooms should auto-write first?
- Is a reply on every Telegram line wanted, or silence for plain filings as now?
- Pull `nomic-embed-text` for similar-line search (a download)?
