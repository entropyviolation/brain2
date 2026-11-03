/**
 * lib/overcome-bimby/run.ts — The whole pipeline: READ → LOG → GATHER → PICK → PUSH
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { withExperiment } from "./experiment"
import { gather, pickTactics } from "./pick"
import { fillTactic } from "./tactics"
import { writePush } from "./push"
import { readMessage } from "./read"
import { useOvercomeStore } from "./store"
import type { Push, Reading } from "./types"

export interface OvercomeResult {
  entryId: string
  reading: Reading
  readBy: "model" | "rules"
  push: Push
  /** The tactic included only to test it. */
  experiment?: string
}

export async function overcome(input: { text: string; call: ModelCall | null; extract: string[]; prose: string[]; now?: Date; explore?: boolean; reading?: Reading; source?: "lab" | "chat" }): Promise<OvercomeResult> {
  const { reading, by: readBy } = input.reading ? { reading: input.reading, by: "rules" as const } : await readMessage({ text: input.text, call: input.call, ladder: input.extract })
  const prior = useOvercomeStore.getState().log
  const history = gather(reading, prior)
  const picked = pickTactics(reading, history, prior)
  const chosen = input.explore ? withExperiment(picked, reading, prior) : { tactics: picked, experiment: undefined }
  const tactics = chosen.tactics.map((t) => fillTactic(t, reading))
  const experiment = chosen.experiment
  const entryId = useOvercomeStore.getState().add(input.text.trim(), reading, tactics.map((t) => t.id), input.now, { source: input.source ?? "lab", ...(experiment ? { experiment } : {}) })
  const push = await writePush({ reading, history, tactics, call: input.call, ladder: input.prose })
  return { entryId, reading, readBy, push, experiment }
}
