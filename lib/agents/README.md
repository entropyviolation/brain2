# `lib/agents/` — Blueprints for every agent

_Last mapped: 2026-11-02_

One description of an agent, whatever its mind is made of. Plan:
[`docs/AGENT_LAB_PLAN.md`](../../docs/AGENT_LAB_PLAN.md) (slice `PH-1`).

**Read-only.** Nothing here runs an agent, writes storage, or changes a saved
flow. An adapter reads a flow and fills the envelope. The flow inside the
Blueprint is the same object the old runtime reads.

## BIMBIES

A **BIMBY** (BIM + baby) is a small sub-agent that does one specific job: the Tracking Helper, the Lists BIMBY. Every BIMBY is an agent here with a Blueprint, usually a `pipeline` mind. A BIM is the big routed flow; a BIMBY is not. New ones are named BIMBY in docs and UI copy.

### Rules every BIMBY keeps

- **Never destroy.** A bulk write has a hard cap, may only touch fields its tool is allowed to, is verified after it runs, and is put back if the check fails. Only a merge removes items. The Lists BIMBY's version is `lib/lists-helper/guard.ts`.
- **Doubt becomes keys.** Where the line is unclear, show the choices on screen and in the chat (the exact sentence, one key per candidate). No dead ends.
- **Swarm vote.** Built as `lib/swarm-vote/` and `/lab/swarm-vote` (tally, runner, reword keys, replay bench).
- **Type `/info`.** The command is `/info`; a line that is only `info` (any case, `info?`) is an alias. gets the BIMBY's manual and runs nothing else: `info.ts` (_2026-11-07_). Built into the Tracking, Habits and Lists chats; in BIM chat, "tracking bimby info" or "info on the lists bimby" works for every BIMBY (`lib/ingest/bimby-handoff.ts`). A line that merely contains the word is not info.
- **Planned.** Confidence-driven escalation: [`docs/BIMBY_IDEAS.md`](../../docs/BIMBY_IDEAS.md).

## The Blueprint

`blueprint.ts`. Every agent has the same fourteen keys (`ENVELOPE_KEYS`): `id`,
`name`, `owner`, `rev`, `purpose`, `senses`, `memory`, `tools`, `skills`,
`models`, `limits`, `door`, `checks`, `mind`. Only `mind` differs:

| Mind | Body | Built from |
|------|------|------------|
| `graph` | A BIM `Flow` (nodes, edges, ports) | `adapters/bim-flow.ts` |
| `pipeline` | Ordered stages, plus a `HelperFlow` or a `HabitsBimbyFlow` when the agent has one | `adapters/tracking-helper.ts`, `adapters/habit-helper.ts`, `adapters/lists-helper.ts` (no flow, no model) |
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
  `blocks` node. The surface is `bim-flow`, `tracking-helper` or `habit-helper`
  (which proposes `habit-cell`, `miss-reason`, `shorthand-name`).
- **Models.** Models pinned on nodes, or the Helper's ladder. `localOnly` is true.
- **Limits.** Empty for BIM (it declares none). The Helper has one call and its
  token cap.

## Skills

_Last mapped: 2026-11-02_ `skills` is the list of hand-written `Skill`s an agent ships with (`lib/skills/seeds.ts`; BIM
flows ship none yet). A skill is prompt text and never writes, so the accept door is unchanged. `validateBlueprint`
refuses a repeated skill id or an empty principle. Skills learned on a device live in the per-device bank, not in the
Blueprint. Design: [`docs/SKILLRL_RESEARCH.md`](../../docs/SKILLRL_RESEARCH.md); code: [`lib/skills/README.md`](../skills/README.md).

## Registry

_Last mapped: 2026-11-02_

`registry.ts`. `builtinBlueprints()` is the Tracking Helper, Lists, Overcome and Habits BIMBIES, the Plan, Critic, Link and Inbox BIMBIES (_2026-11-07_), the Social BIMBY (_2026-11-11_), and every shipped BIM flow.
`agentLabHref` (`components/Lab/Agents/agent-href.ts`) names the lab page a rail click opens.
`registerBlueprint` adds a module's agent (plan `MOD-1`) and throws on an
unsound Blueprint or a reused id. `listBlueprints` and `getBlueprint` read both.
Nothing here reads storage; to show a person's saved copy, pass it to
`bimBlueprints({ [flowId]: { flow, rev } })` or `helperBlueprint(flow)`.

## Files

- `blueprint.ts`: types, `NODE_TAG`, `validateBlueprint`.
- `adapters/overcome-bimby.ts` (_2026-11-02_): the Overcome BIMBY and its one built pipeline, five stages; lab `/lab/overcome`; code `lib/overcome-bimby/`.
- `adapters/bim-flow.ts`, `adapters/tracking-helper.ts`, `adapters/lists-helper.ts` (_2026-11-02_: five code stages and the tool list from `lib/lists-helper/tools.ts`; its lab is `/lab/lists-helper`). `Mind.pipeline.flow` is optional now.
- `adapters/bim-flow.ts`, `adapters/tracking-helper.ts`, `adapters/habit-helper.ts`. The two
  helper adapters tell their flows apart by shape (`wire` or `match`), so `helperOfBlueprint` and
  `habitsBimbyOfBlueprint` each return null for the other.
- `adapters/plan-bimby.ts`, `adapters/critic-bimby.ts`, `adapters/link-bimby.ts`, `adapters/inbox-bimby.ts` (_2026-11-07_): one `pipeline` Blueprint each, stages taken from each BIMBY's README, one built named pipeline that is also a tool. Only Plan has a lab page (`/lab/plan-bimby`). _2026-11-11:_ Plan has a second built pipeline, "Plan the rest of today" (`PLAN_DAY_STAGES`), which runs in BIM chat. Critic, Link and Inbox have none, so the desk shows no **Open lab** for them. Also (_2026-11-07_): `adapters/idea-swarm.ts` (lab `/lab/idea-swarm`), `adapters/swarm-vote.ts` (lab `/lab/swarm-vote`; a shared tool, not a BIMBY) and `adapters/skills-evolve.ts` (no lab page). Still unregistered: Flight and Report BIMBY (no model code yet). `adapters/finance-bimby.ts` (_2026-11-11_): the Financial BIMBY, four built pipelines (log a money line, attach a receipt, keep a verdict, before you buy) and two planned; lab `/lab/finance-bimby`. Its tools say `writes: true`: it files a sure reading directly, with undo, as the Flight BIMBY does. _2026-11-11:_ `adapters/social-bimby.ts`: the Social BIMBY, one built pipeline ("File a social message", all code) and two planned (birthday nudges, friends you haven't seen). It runs in BIM chat's `social` lane; no lab page.
- `registry.ts`.
- `info.ts`, `info.test.ts` (_2026-11-07_): `isInfoRequest`, `infoText(blueprint)`, and `INFO_EXAMPLES` (hand-written "try saying" lines by Blueprint id). The facts come from the Blueprint. A new BIMBY with its own chat calls both functions first, and adds its id to `INFO_EXAMPLES`.
- `bench.ts` (_2026-11-02_): `Case`, `Variant`, `runSuite` → `Scorecard`, `compareCards` (gained / lost / stuck / held on shared lines), `confusions`, `trimHistory`. Pure, no model inside. A decline is never a pass; a thrown call is a named miss. Slice `EV-1` to `EV-4`, `EV-8` of the plan.
- `bench-variants.ts`: `keywordBaseline` (free; declines on no overlap or a tie), `swarmVariant` (with `declineOnSplit`), `singleModelVariant`. A new idea from `docs/BIMBY_IDEAS.md` is one more `Variant`.
- `bench-cases.ts`: `LISTS_CASES`, hand-labelled lines tagged by what makes them hard. The swarm lab's replay bench reads the same set.
- `bench.test.ts`.
- `blueprint.test.ts`: every shipped flow validates and survives a JSON round
  trip; both agents share one envelope; the registry refuses bad and duplicate
  Blueprints.

## Planned

The common Trace (slice 2), the Theater and Blueprint form (3), the tool
contracts (4), evals and compare (5). A `policy` adapter for the friend and
Budget. The rail (`components/Lab/Agents/AgentRail.tsx`) and the
`/lab/tracking-helper` and `/lab/habit-helper` routes have landed; they read Blueprints from here. The Tracking helper is now the **Tracking BIMBY** (2026-11-02): one `pipeline` mind with `pipelines: NamedPipeline[]` (`description-to-timeblock` and `generate-gap-questions` built, each also a tool; `gap-readings` and `account-to-other-kinds` planned). The **Agents** Go tab (`components/Lab/Agents/AgentsDesk.tsx`, added 2026-11-02) lists them and links to each lab.
