/**
 * lib/swarm-vote/reword.ts — Turn a split vote into one plain sentence per surviving action
 *
 * One mid-model call. It sees the person's line and the surviving actions and says, for each, how the line would
 * read if that action were meant, in the BIMBY's own grammar. It never decides and never writes: each sentence
 * becomes a key, and a pick is a normal line into the code grammar (`docs/BIMBY_IDEAS.md` §1, steps 3 and 4).
 * With no model, or an answer that is off the list, the keys fall back to the action names themselves.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Tally } from "./types"
import { survivors } from "./tally"

export interface RewordKey {
  action: string
  /** A sentence in the BIMBY's grammar; a pick sends this as the person's next line. */
  sentence: string
  /** False when the model did not supply it and the label is only the action name. */
  reworded: boolean
}

export const REWORD_SYSTEM = `A small model must read the same way every time. You are given a person's line and the actions it might mean.
For each action, write ONE short plain sentence in the imperative that asks for exactly that action and nothing else, using the person's own nouns.
Do not choose between actions. Do not add actions. Keep the order given.`

export const rewordSchema = (actions: readonly string[]): Record<string, unknown> => ({
  type: "object",
  required: ["keys"],
  properties: {
    keys: {
      type: "array",
      maxItems: actions.length,
      items: {
        type: "object",
        required: ["action", "sentence"],
        properties: { action: { type: "string", enum: [...actions] }, sentence: { type: "string", maxLength: 140 } },
      },
    },
  },
})

/** Pure: keep one clean sentence per surviving action, in survivor order; missing ones fall back to the name. */
export function cleanKeys(out: unknown, actions: readonly string[]): RewordKey[] {
  const said = new Map<string, string>()
  const keys = (out as { keys?: unknown } | null)?.keys
  if (Array.isArray(keys)) {
    for (const k of keys) {
      const a = (k as { action?: unknown })?.action
      const s = (k as { sentence?: unknown })?.sentence
      if (typeof a === "string" && typeof s === "string" && actions.includes(a) && s.trim() && !said.has(a)) said.set(a, s.trim())
    }
  }
  return actions.map((action) => ({ action, sentence: said.get(action) ?? action, reworded: said.has(action) }))
}

/**
 * What to show after a vote. `clear` has no reword (go to the plan); `empty` has no keys (ask the person);
 * `split` asks the mid model once, and falls back to bare action names if it fails.
 */
export async function rewordSplit(call: ModelCall | null, line: string, t: Tally, model?: string): Promise<RewordKey[]> {
  if (t.verdict !== "split") return []
  const actions = survivors(t).slice(0, 4)
  if (!actions.length) return []
  if (!call) return cleanKeys(null, actions)
  try {
    const out = await call({
      model,
      system: REWORD_SYSTEM,
      user: `Line: ${line}\nActions: ${actions.join(", ")}`,
      schema: rewordSchema(actions),
      maxTokens: 300,
    })
    return cleanKeys(out, actions)
  } catch {
    return cleanKeys(null, actions)
  }
}
