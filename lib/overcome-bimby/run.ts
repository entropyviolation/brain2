/**
 * lib/overcome-bimby/run.ts — The whole pipeline: READ → LOG → GATHER → PICK → PUSH
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { gather, pickTactics } from "./pick"
import { writePush } from "./push"
import { readMessage } from "./read"
import { useOvercomeStore } from "./store"
import type { Push, Reading } from "./types"

export interface OvercomeResult {
  entryId: string
  reading: Reading
  readBy: "model" | "rules"
  push: Push
}

export async function overcome(input: { text: string; call: ModelCall | null; extract: string[]; prose: string[]; now?: Date }): Promise<OvercomeResult> {
  const { reading, by: readBy } = await readMessage({ text: input.text, call: input.call, ladder: input.extract })
  const prior = useOvercomeStore.getState().log
  const history = gather(reading, prior)
  const tactics = pickTactics(reading, history, prior)
  const entryId = useOvercomeStore.getState().add(input.text.trim(), reading, tactics.map((t) => t.id), input.now)
  const push = await writePush({ reading, history, tactics, call: input.call, ladder: input.prose })
  return { entryId, reading, readBy, push }
}
