# `lib/agents/` — Blueprints for every agent

_Last mapped: 2026-11-01_

One description of an agent, whatever its mind is made of. Plan:
[`docs/AGENT_LAB_PLAN.md`](../../docs/AGENT_LAB_PLAN.md) (slice `PH-1`).

**Read-only.** Nothing here runs an agent, writes storage, or changes a saved
flow. An adapter reads a flow and fills the envelope. The flow inside the
Blueprint is the same object the old runtime reads.

## The Blueprint

`blueprint.ts`. Every agent has the same thirteen keys (`ENVELOPE_KEYS`): `id`,
`name`, `owner`, `rev`, `purpose`, `senses`, `memory`, `tools`, `models`,
`limits`, `door`, `checks`, `mind`. Only `mind` differs:

| Mind | Body | Built from |
|------|------|------------|
| `graph` | A BIM `Flow` (nodes, edges, ports) | `adapters/bim-flow.ts` |
| `pipeline` | Ordered stages plus a `HelperFlow` | `adapters/tracking-helper.ts` |
| `policy` | Weighted rules | **Planned.** Typed, no adapter yet (friend, Budget). |

`NODE_TAG` says what each BIM node kind is in the loop (sense, attend, remember,
reason, act, check, halt) and which of the paper's four modules it plays
(generator, evaluator, halter, controller). It is exhaustive on purpose: a new
node kind cannot ship without a role.

`validateBlueprint` returns plain problems: empty fields, a bad owner, duplicate
tools, non-positive limits, dangling edges, a graph with no message node.

## What an adapter fills in

- **Tools.** The kinds of node a BIM flow uses (`search` is `vault-search`,
  `retrieve`, `compute`, and so on). Every tool says `writes: false`. Slice 4
  gives each a contract.
- **Memory reads.** From search, link, retrieve, and context nodes. `writes` is
  empty: agents propose; the accept door writes.
- **Door.** The flow's `propose` actions, plus `time-block` when it has a
  `blocks` node. The surface is `bim-flow` or `tracking-helper`.
- **Models.** Models pinned on nodes, or the Helper's ladder. `localOnly` is true.
- **Limits.** Empty for BIM (it declares none). The Helper has one call and its
  token cap.

## Registry

`registry.ts`. `builtinBlueprints()` is the Helper plus every shipped BIM flow.
`registerBlueprint` adds a module's agent (plan `MOD-1`) and throws on an
unsound Blueprint or a reused id. `listBlueprints` and `getBlueprint` read both.
Nothing here reads storage; to show a person's saved copy, pass it to
`bimBlueprints({ [flowId]: { flow, rev } })` or `helperBlueprint(flow)`.

## Files

- `blueprint.ts`: types, `NODE_TAG`, `validateBlueprint`.
- `adapters/bim-flow.ts`, `adapters/tracking-helper.ts`.
- `registry.ts`.
- `blueprint.test.ts`: every shipped flow validates and survives a JSON round
  trip; both agents share one envelope; the registry refuses bad and duplicate
  Blueprints.

## Planned

The common Trace (slice 2), the Theater and Blueprint form (3), the tool
contracts (4), evals and compare (5). A `policy` adapter for the friend and
Budget. The rail (`components/Lab/Agents/AgentRail.tsx`) and the
`/lab/tracking-helper` route have landed; both read Blueprints from here.
