/**
 * lib/plan-bimby/day/llm.ts — The model's part of a day plan: time guesses and guessed reasons
 *
 * The rules decide what is on the plan and how it is weighed. A local model then looks at each numbered
 * item and gives minutes with a short reason, a guess at why it matters, and a guess at what happens if it
 * is not done. It may also name a task the rules missed, with the words it came from. Every answer is
 * checked: a number out of range, an item that is not on the list, or a missed task whose words are not in
 * the message is dropped. A model minute replaces only a rule of thumb; a guessed reason is never filed
 * unless the person takes it.
 */

import { chatCrew } from "@/lib/bim-flow/chat-models"
import { escalate } from "@/lib/bim-flow/crew"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { fromHistory, type PastRun } from "./estimate"
import { nameScore } from "./read"
import { newItem } from "./tweak"
import type { DayItem, DayPlan } from "./types"

const TIMEOUT_MS = 180_000

export const DAY_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["items", "missed"],
  properties: {
    items: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        required: ["n", "minutes", "minutesWhy", "why", "ifNot"],
        properties: {
          n: { type: "integer", minimum: 1, maximum: 24 },
          minutes: { type: "integer", minimum: 1, maximum: 600 },
          minutesWhy: { type: "string", maxLength: 140 },
          why: { type: "string", maxLength: 160 },
          ifNot: { type: "string", maxLength: 160 },
        },
      },
    },
    missed: {
      type: "array",
      maxItems: 4,
      items: { type: "object", required: ["title", "source"], properties: { title: { type: "string", maxLength: 60 }, source: { type: "string", maxLength: 120 } } },
    },
  },
}

export const DAY_SYSTEM = `You help one person plan the rest of their day. You get their message and the numbered tasks already read from it.
For every numbered task answer with its number n and:
minutes: a realistic total for one person at home, including set-up and waiting that keeps them busy. Round to 5.
minutesWhy: one short clause on what the time is made of.
why: your best guess, from their own message only, at why this task matters to them today. Empty string when the message gives no hint.
ifNot: your best guess, from their own message only, at what happens if it is not done today. Empty string when the message gives no hint.
missed: tasks clearly in the message that are not in the numbered list, each with source = the exact words from the message. Usually empty.
Never invent facts about their life. Never rename or merge the numbered tasks.`

interface Wired {
  items?: { n?: number; minutes?: number; minutesWhy?: string; why?: string; ifNot?: string }[]
  missed?: { title?: string; source?: string }[]
}

export interface DayNotes {
  items: DayItem[]
  added: string[]
  dropped: string[]
  timed: number
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "")

/** Put a model's answer onto the items, keeping only what passes the checks. Pure. */
export function notesFromModel(raw: unknown, plan: Pick<DayPlan, "items" | "text">, past: readonly PastRun[] = []): DayNotes {
  const out = raw as Wired | null
  const dropped: string[] = []
  const added: string[] = []
  let timed = 0
  const items = plan.items.map((i) => ({ ...i }))
  for (const row of Array.isArray(out?.items) ? out!.items! : []) {
    const item = Number.isInteger(row?.n) ? items[Number(row.n) - 1] : undefined
    if (!item) {
      dropped.push(`no task numbered ${String(row?.n)}`)
      continue
    }
    const minutes = Number(row.minutes)
    if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 600) {
      // Your own history, your own words and your own edit all outrank a model's guess.
      if (item.estimate.source === "rule" || item.estimate.source === "default") {
        const why = clean(row.minutesWhy, 140)
        item.estimate = { minutes: Math.round(minutes), source: "model", basis: `A model's guess${why ? `: ${why}` : ""}. Not from your data.` }
        timed++
      }
    } else dropped.push(`"${item.title}": minutes out of range`)
    const why = clean(row.why, 160)
    const ifNot = clean(row.ifNot, 160)
    if (why || ifNot) item.guess = { ...(why ? { why } : {}), ...(ifNot ? { ifNot } : {}) }
  }
  const text = plan.text.toLowerCase()
  for (const miss of Array.isArray(out?.missed) ? out!.missed! : []) {
    const title = clean(miss?.title, 60)
    const source = clean(miss?.source, 120)
    if (!title || !source || !text.includes(source.toLowerCase())) {
      dropped.push(`missed task not in your words ("${title || "?"}")`)
      continue
    }
    if (items.some((i) => nameScore(i.title, title) > 0 || nameScore(title, i.title) > 0 || nameScore(i.title, source) > 0)) continue
    const item = newItem(title, "rest", past)
    items.push({ ...item, said: source, reasons: [`A model noticed it in your words: "${source}".`] })
    added.push(title)
  }
  return { items, added, dropped, timed }
}

function userText(plan: Pick<DayPlan, "items" | "text">, past: readonly PastRun[], now: Date): string {
  const rows = plan.items.map((i, n) => {
    const hist = fromHistory(i.title, past)
    return `${n + 1}. ${i.title} [${i.tier}]${i.subtasks.length ? ` (steps: ${i.subtasks.join(", ")})` : ""}${hist ? ` (their own history: ${hist.minutes} min)` : ""}`
  })
  return `NOW: ${now.toString().slice(0, 21)}\nMESSAGE: ${plan.text}\nTASKS:\n${rows.join("\n")}`
}

export interface DayThought extends DayNotes {
  model: string
}

/** Ask the crew's extract ladder. Null when no model is reachable or none gave a usable answer. */
export async function thinkWithModel(plan: Pick<DayPlan, "items" | "text">, past: readonly PastRun[], now = new Date()): Promise<DayThought | null> {
  const crew = await chatCrew()
  if (!crew) return null
  const call = ollamaCall(crew.main, AbortSignal.timeout(TIMEOUT_MS))
  const usable = (raw: unknown) => Array.isArray((raw as Wired | null)?.items) && (raw as Wired).items!.some((r) => Number.isInteger(r?.n) && Number(r.n) <= plan.items.length)
  const { out, hops } = await escalate<unknown>(call, crew.extract.length ? crew.extract : [crew.main], { system: DAY_SYSTEM, user: userText(plan, past, now), schema: DAY_SCHEMA, maxTokens: 1600 }, (raw) => (usable(raw) ? null : "no usable rows"))
  if (!out || !usable(out)) return null
  return { ...notesFromModel(out, plan, past), model: hops.at(-1)?.model ?? crew.main }
}
