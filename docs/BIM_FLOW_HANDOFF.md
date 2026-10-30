# BIM flow — handoff

_Last mapped: 2026-10-30_

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

- `npx vitest run lib/bim-flow`
- `npx tsc --noEmit -p .` (grep for `bim-flow` / `BimFlow`)
- Open `/lab/bim-flow` and run a BIM day. Ollama must be running.
- Update `components/Lab/BimFlow/README.md` and the `bim-flow/` row in
  `lib/README.md`.
