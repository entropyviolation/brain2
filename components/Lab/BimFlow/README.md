# BIM flow lab

_Last mapped: 2026-10-30_

Next steps and lessons for whoever picks this up: [`docs/BIM_FLOW_HANDOFF.md`](../../../docs/BIM_FLOW_HANDOFF.md).

A bench for building BIM's routed model flow and testing it on real BIM text.
Route: `/lab/bim-flow/` (`app/lab/bim-flow/page.tsx`). Nothing in the app
links here. It writes nothing to the vault.

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
| `flow-canvas.tsx` | Node board: drag, wire from ports, select a wire, lit trace |
| `flow-inspector.tsx` | Edit a node, read its step for the open message, teach a gate |
| `bim-flow.css` | Green phosphor, the BIM console's glass |

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

**Planned:** keep the graph in the vault, not per device; a labelled test set
with a score per gate; embedding search beside word search; and running the
graph on the hub when a message lands.
