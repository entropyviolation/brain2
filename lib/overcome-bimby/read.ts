/**
 * lib/overcome-bimby/read.ts — READ: one message → task, resistance, barrier, their motivation and consequences
 *
 * One schema-bound model call on the `extract` ladder. With no model, `readByRules` takes a best guess so a log entry
 * still exists. The model only quotes and classifies; it never invents a reason the person did not say.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { BARRIERS } from "./tactics"
import type { Barrier, Reading } from "./types"

export const READ_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["task", "resistance", "barrier", "overdueDays", "motivation", "consequences"],
  properties: {
    task: { type: "string", maxLength: 80 },
    resistance: { type: "string", maxLength: 160 },
    barrier: { type: "string", enum: BARRIERS },
    overdueDays: { type: "integer", minimum: 0, maximum: 3650 },
    motivation: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    consequences: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
  },
}

export const READ_SYSTEM = `You read one message from a person who is avoiding a task.
task: the thing to do, short, starts with a verb. resistance: how the avoidance feels, in their words.
barrier: dread (it feels bad or scary), boring, overwhelm (too big), vague (unclear first step), perfectionism, choices (too many options to decide between), cost (worried about money or price), or unknown.
overdueDays: days late if said ("a week ago" = 7), else 0.
motivation: reasons they gave for wanting it done, quoted. consequences: what happens if it stays undone, quoted or plainly stated.
Quote only what they said. Empty lists when nothing was said. Never invent a reason.`

export const READ_EXAMPLE = {
  text: "i really have to finish those cds but i feel a lot of resistance but it needs to be done a week ago (super overdue)",
  json: JSON.stringify({ task: "finish the CDs", resistance: "a lot of resistance", barrier: "unknown", overdueDays: 7, motivation: [], consequences: ["super overdue"] }),
}

export function readSystemText(): string {
  return `${READ_SYSTEM}\n\nEXAMPLE\nTEXT: ${READ_EXAMPLE.text}\nANSWER: ${READ_EXAMPLE.json}`
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [])

/** Keep only a well-formed reading. Null when there is no task. */
export function cleanReading(out: unknown): Reading | null {
  const o = out as Partial<Record<keyof Reading, unknown>> | null
  const task = String(o?.task ?? "").trim()
  if (!task) return null
  const days = Number(o?.overdueDays)
  return {
    task,
    resistance: String(o?.resistance ?? "").trim(),
    barrier: BARRIERS.includes(o?.barrier as Barrier) ? (o!.barrier as Barrier) : "unknown",
    overdueDays: days > 0 ? Math.round(days) : 0,
    motivation: strings(o?.motivation),
    consequences: strings(o?.consequences),
  }
}

const BARRIER_WORDS: [Barrier, RegExp][] = [
  ["perfectionism", /\b(perfect|not good enough|good enough)\b/i],
  ["overwhelm", /\b(overwhelm\w*|too (much|big)|so much)\b/i],
  ["vague", /\b(don'?t know where|where to start|not sure how|unclear|stuck)\b/i],
  ["choices", /\b(too many (options|choices)|can'?t (decide|choose)|which one|so many options|decision)\b/i],
  ["cost", /\b(expensive|budget|afford|too much money|price|cost)\b/i],
  ["boring", /\b(boring|tedious|dull)\b/i],
  ["dread", /\b(resist\w*|dread\w*|avoid\w*|hate|scared|anxious|can'?t make myself)\b/i],
]

export function overdueIn(text: string): number {
  if (/\bweek\w* (ago|late|overdue)\b|\ba week\b/i.test(text)) return 7
  const n = /\b(\d+)\s*days?\b/i.exec(text)
  if (n) return Number(n[1])
  return /\b(overdue|late|ages ago|yesterday)\b/i.test(text) ? 1 : 0
}

/** No model: the task is what follows "finish/do/start", the barrier is the first matching word. */
export function readByRules(text: string): Reading {
  const t = text.trim().replace(/\s+/g, " ")
  const verb = /\b(?:finish|do|start|write|send|make|clean|call|submit|file|book|pay|buy|schedule|fix|plan|email|apply|cancel|renew|pack|sort|organi[sz]e|reply)\b\s+(?:the\s+|those\s+|my\s+|a\s+)?([^.,;]+?)(?=\s+(?:but|and|because|,)|[.,;]|$)/i.exec(t)
  const resist = /[^.,;]*\bresist\w*[^.,;]*/i.exec(t)
  const hit = BARRIER_WORDS.find(([, re]) => re.test(t))
  return {
    task: verb ? verb[0].trim() : t.slice(0, 60),
    resistance: resist ? resist[0].trim() : "",
    barrier: hit ? hit[0] : "unknown",
    overdueDays: overdueIn(t),
    motivation: [],
    consequences: [],
  }
}

export async function readMessage(input: { text: string; call: ModelCall | null; ladder: string[] }): Promise<{ reading: Reading; by: "model" | "rules" }> {
  const text = input.text.trim()
  if (!input.call || !input.ladder.length) return { reading: readByRules(text), by: "rules" }
  const { out } = await escalate<unknown>(
    input.call,
    input.ladder,
    { system: readSystemText(), user: `TEXT: ${text}`, schema: READ_SCHEMA, maxTokens: 400 },
    (o) => (cleanReading(o) ? null : "no task found"),
  )
  const reading = cleanReading(out)
  return reading ? { reading, by: "model" } : { reading: readByRules(text), by: "rules" }
}
