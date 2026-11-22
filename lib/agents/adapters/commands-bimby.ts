/**
 * lib/agents/adapters/commands-bimby.ts — The Commands BIMBY, seen as a Blueprint
 *
 * One built pipeline, "Remember and recall a command": READ (code) → MATCH (code) → SAY or KEEP (code).
 * Code: `lib/commands-bimby/`. It runs in BIM chat (the `commands` lane) and in Terminal (`scripts/bim.mjs`).
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const COMMANDS_BIMBY_ID = "commands-bimby"

export const COMMANDS_BIMBY_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "code", does: "Reads “remember this command to …”, a pasted command, “what's the command to …?”, “list my commands” and “forget the command for …”." },
  { id: "match", label: "Match", cost: "code", does: "Scores the question's words on each command's name, extra words and what it does; a tie lists both." },
  { id: "keep", label: "Say or keep", cost: "code", does: "Says the command back word for word, or keeps the pasted one in the vault (`brain2-commands`)." },
]

export const COMMANDS_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "remember-command", name: "Remember and recall a command", does: "Keeps the shell commands you paste and says them back when you ask, in chat or with `bim` in Terminal.", status: "built", stages: COMMANDS_BIMBY_STAGES, asTool: "recall-command" },
  { id: "run-command", name: "Run a command from chat", does: "Runs a saved command on the Mac hub after you confirm it.", status: "planned", stages: [] },
]

export function commandsBimbyBlueprint(): Blueprint {
  return {
    id: COMMANDS_BIMBY_ID,
    name: "Commands BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Remembers how to run your programs (Brain2, the iPhone reinstall, Ollama, PlaylistLab, the baby animal game, and any command you paste) and says the command back when you ask.",
    senses: ["message"],
    memory: { reads: ["semantic"], writes: ["semantic"] },
    tools: [{ name: "recall-command", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: [], surface: "bim-chat" },
    checks: [],
    mind: { kind: "pipeline", stages: COMMANDS_BIMBY_STAGES, pipelines: COMMANDS_BIMBY_PIPELINES },
  }
}
