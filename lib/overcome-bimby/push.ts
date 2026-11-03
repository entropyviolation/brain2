/**
 * lib/overcome-bimby/push.ts — PUSH: turn the picked tactics, their own words and the cost into one short nudge
 *
 * The model only phrases. The tactics, quotes and consequences are handed in, so it cannot invent a reason. With no model,
 * `pushByRules` builds the same message from a template. Tone: warm, direct, the smallest next step first. No guilt, no shaming.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { History } from "./pick"
import type { Push, Reading, Tactic } from "./types"

export const PUSH_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["message"],
  properties: { message: { type: "string", maxLength: 900 } },
}

export const PUSH_SYSTEM = `You are a kind, direct coach for someone with ADHD who is avoiding a task. Shame and panic make ADHD paralysis worse, so lean on novelty, tiny starts and shrinking decisions, never guilt.
Write 4 to 6 short sentences. Use ONLY the tactics, quotes and costs you are given. Quote their own reasons back in their words.
Name the resistance as normal, say the cost once and plainly, then give the first tactic as a step small enough to do in five minutes.
Make each tactic concrete to THIS task: use the task's own nouns (a "flights" task gets "open one flight search tab"), and write out exact words for any message to send.
You may reword a tactic for the task, but never invent a reason, a deadline, a price or a fact about the person.
End with one line: if it still does not work, ask them to name what is in the way.`

export function pushPrompt(reading: Reading, history: History, tactics: Tactic[]): string {
  const lines = [
    `TASK: ${reading.task}`,
    `RESISTANCE: ${reading.resistance || "(not described)"}`,
    reading.overdueDays ? `OVERDUE: ${reading.overdueDays} days` : "",
    history.motivation.length ? `THEIR REASONS: ${history.motivation.map((m) => `"${m}"`).join("; ")}` : "THEIR REASONS: (none said yet)",
    history.consequences.length ? `COSTS: ${history.consequences.map((m) => `"${m}"`).join("; ")}` : "COSTS: (none said yet)",
    history.before.length ? `TIMES THEY HAVE BEEN STUCK ON THIS BEFORE: ${history.before.length}` : "",
    `TACTICS, best first:\n${tactics.map((t, i) => `${i + 1}. ${t.name}: ${t.do}`).join("\n")}`,
  ]
  return lines.filter(Boolean).join("\n")
}

export function pushByRules(reading: Reading, history: History, tactics: Tactic[]): string {
  const [first, ...rest] = tactics
  const parts: string[] = []
  parts.push(`Feeling stuck on “${reading.task}” is normal${reading.overdueDays ? `, even ${reading.overdueDays} days late` : ""}. Shame and panic make it harder, so go small and new.`)
  if (history.motivation[0]) parts.push(`You said: “${history.motivation[0]}”.`)
  if (history.consequences[0]) parts.push(`If it stays undone: ${history.consequences[0]}.`)
  if (first) parts.push(`First: ${first.name}. ${first.do}`)
  if (rest.length) parts.push(`If that does not land: ${rest.map((t) => t.name).join(", ")}.`)
  return parts.join(" ")
}

export async function writePush(input: { reading: Reading; history: History; tactics: Tactic[]; call: ModelCall | null; ladder: string[] }): Promise<Push> {
  const { reading, history, tactics } = input
  const rules = (): Push => ({ message: pushByRules(reading, history, tactics), tactics, by: "rules" })
  if (!input.call || !input.ladder.length || !tactics.length) return rules()
  const { out } = await escalate<{ message?: string }>(
    input.call,
    input.ladder,
    { system: PUSH_SYSTEM, user: pushPrompt(reading, history, tactics), schema: PUSH_SCHEMA, maxTokens: 400 },
    (o) => (String(o?.message ?? "").trim().length > 20 ? null : "message too short"),
  )
  const message = String(out?.message ?? "").trim()
  return message.length > 20 ? { message, tactics, by: "model" } : rules()
}
