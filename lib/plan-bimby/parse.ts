/**
 * lib/plan-bimby/parse.ts — One spoken plan → ordered items
 *
 * SEGMENT (one schema-bound model call, `wire`) → LINK (code, `links.ts`). With no model, or when every rung
 * comes back empty, `parseByRules` splits on commas and "then" so the person still gets rows to edit. Nothing
 * here writes; the confirm screen is the person's edit, and `run.ts` turns the confirmed items into a run.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Task } from "@/lib/types"
import { withLinks } from "./links"
import type { PlanDraft, PlanItem, PlanPace, PlanSub } from "./types"

let seq = 0
export const planItemId = (): string => `pb-${Date.now().toString(36)}-${(seq++).toString(36)}`

const PACES: PlanPace[] = ["urgent", "steady", "relaxed"]

export const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["items", "remarks"],
  properties: {
    items: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        required: ["title", "minutes", "pace", "paceNote", "subtasks"],
        properties: {
          title: { type: "string", maxLength: 60 },
          minutes: { type: "integer", minimum: 0, maximum: 600 },
          pace: { type: "string", enum: PACES },
          paceNote: { type: "string", maxLength: 80 },
          subtasks: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              required: ["title", "due"],
              properties: { title: { type: "string", maxLength: 60 }, due: { type: "string", maxLength: 40 } },
            },
          },
        },
      },
    },
    remarks: { type: "array", maxItems: 6, items: { type: "string", maxLength: 120 } },
  },
}

export const PLAN_SYSTEM = `You split one spoken plan for right now into ordered tasks.
Keep the order spoken. One task per thing to do. A task is short and starts with a verb ("make more coffee").
When one task has stages with their own goals or deadlines, put them in subtasks, with the deadline words in due ("by 8am"), and keep the parent task.
minutes: only when a length was said ("for 15 min" = 15), else 0.
pace: urgent when the person stresses hurry (nowww, ASAP, urgent), relaxed when they say no rush, else steady. paceNote: their words about speed or deadline.
remarks: feelings or asides that are not tasks. Never invent tasks. Never drop a task.`

export const PLAN_EXAMPLE = {
  text: "Plan for rn - make more coffee, take another adderall, book ny flights (nowwww) then clean space for 15 min, then finish cds by first fully finishing chaos (adding inner copy) hopefully done by 8am, then entropy done by 9am (10 latest), as quickly as possible. Then merch designs. I'm super happy with brain2.",
  json: JSON.stringify({
    items: [
      { title: "make more coffee", minutes: 0, pace: "steady", paceNote: "", subtasks: [] },
      { title: "take another adderall", minutes: 0, pace: "steady", paceNote: "", subtasks: [] },
      { title: "book ny flights", minutes: 0, pace: "urgent", paceNote: "nowwww", subtasks: [] },
      { title: "clean space", minutes: 15, pace: "steady", paceNote: "", subtasks: [] },
      {
        title: "finish cds",
        minutes: 0,
        pace: "urgent",
        paceNote: "as quickly as possible",
        subtasks: [
          { title: "finish chaos (inner copy, other messages, variations)", due: "by 8am" },
          { title: "finish entropy and send all", due: "by 9am (10 latest)" },
        ],
      },
      { title: "work on merch designs", minutes: 0, pace: "steady", paceNote: "", subtasks: [] },
    ],
    remarks: ["super happy with brain2 progress"],
  }),
}

export function planSystemText(): string {
  return `${PLAN_SYSTEM}\n\nEXAMPLE\nTEXT: ${PLAN_EXAMPLE.text}\nANSWER: ${PLAN_EXAMPLE.json}`
}

interface WiredItem {
  title?: string
  minutes?: number
  pace?: string
  paceNote?: string
  subtasks?: { title?: string; due?: string }[]
}

/** Keep only well-formed rows; the grammar already did most of this. */
export function cleanPlan(out: unknown): { items: PlanItem[]; remarks: string[] } {
  const raw = out as { items?: WiredItem[]; remarks?: unknown[] } | null
  const items: PlanItem[] = []
  for (const row of Array.isArray(raw?.items) ? raw!.items! : []) {
    const title = String(row?.title ?? "").trim()
    if (!title) continue
    const subtasks: PlanSub[] = (Array.isArray(row.subtasks) ? row.subtasks : [])
      .map((s) => ({ id: planItemId(), title: String(s?.title ?? "").trim(), ...(s?.due?.trim() ? { due: s.due.trim() } : {}) }))
      .filter((s) => s.title)
    const minutes = Number(row.minutes)
    const paceNote = String(row.paceNote ?? "").trim()
    items.push({
      id: planItemId(),
      title,
      subtasks,
      pace: PACES.includes(row.pace as PlanPace) ? (row.pace as PlanPace) : "steady",
      ...(paceNote ? { paceNote } : {}),
      ...(minutes > 0 ? { minutes: Math.round(minutes) } : {}),
    })
  }
  const remarks = (Array.isArray(raw?.remarks) ? raw!.remarks! : []).map((r) => String(r).trim()).filter(Boolean)
  return { items, remarks }
}

const LEAD = /^\s*(?:plan|plans|today|rn|right now)(?:\s+for\s+[^-–—:,]*)?\s*[-–—:]\s*/i
const FEELING = /\b(happy|love|glad|proud|excited|grateful|stressed|tired)\b/i
const HURRY = /\b(now+|asap|urgent|immediately|quickly|hurry)\b/i

function minutesIn(text: string): number | undefined {
  const m = /\b(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hours?)\b/i.exec(text)
  if (!m) return undefined
  const n = Number(m[1])
  return Math.round(/^h/i.test(m[2]!) ? n * 60 : n)
}

/** No model: split on commas, semicolons, new lines and "then". The person edits what comes out. */
export function parseByRules(text: string): { items: PlanItem[]; remarks: string[] } {
  const body = text.replace(LEAD, "")
  const parts = body.split(/\n|;|,(?![^()]*\))|\bthen\b|\band then\b/i).map((p) => p.trim()).filter(Boolean)
  const items: PlanItem[] = []
  const remarks: string[] = []
  for (const part of parts) {
    const aside = [...part.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim()).filter(Boolean)
    const title = part.replace(/\([^)]*\)/g, " ").replace(/^(?:and|but|also|hopefully)\s+/i, "").replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim()
    if (title.length < 3) continue
    if (FEELING.test(title) && !/^(take|make|book|clean|finish|work|call|send|buy|do|get)\b/i.test(title)) {
      remarks.push(title)
      continue
    }
    const paceNote = aside.join("; ")
    const minutes = minutesIn(title)
    items.push({
      id: planItemId(),
      title: title.replace(/\s+for\s+\d+\s*(?:min(?:ute)?s?|hrs?|hours?)\b/i, "").trim() || title,
      subtasks: [],
      pace: HURRY.test(`${title} ${paceNote}`) ? "urgent" : "steady",
      ...(paceNote ? { paceNote } : {}),
      ...(minutes ? { minutes } : {}),
    })
  }
  return { items, remarks }
}

export interface ParseInput {
  text: string
  /** The model, or null for rules only. */
  call: ModelCall | null
  /** Smallest first. */
  ladder: string[]
  /** Open tasks to look for a match among. */
  tasks: readonly Task[]
  now?: Date
}

export async function parsePlan(input: ParseInput): Promise<PlanDraft> {
  const text = input.text.trim()
  const done = (read: { items: PlanItem[]; remarks: string[] }, extra: Pick<PlanDraft, "by"> & Partial<PlanDraft>): PlanDraft => ({
    items: withLinks(read.items, input.tasks),
    remarks: read.remarks,
    source: text,
    ...extra,
  })
  if (!text) return done({ items: [], remarks: [] }, { by: "rules" })
  if (!input.call || !input.ladder.length) {
    return done(parseByRules(text), { by: "rules", fallback: input.call ? "no model installed" : "no model reachable" })
  }
  const now = (input.now ?? new Date()).toDateString()
  const { out, hops } = await escalate<unknown>(
    input.call,
    input.ladder,
    { system: planSystemText(), user: `TODAY: ${now}\nTEXT: ${text}`, schema: PLAN_SCHEMA, maxTokens: 900 },
    (o) => (cleanPlan(o).items.length ? null : "no tasks found"),
  )
  const read = cleanPlan(out)
  if (!read.items.length) return done(parseByRules(text), { by: "rules", fallback: "the model found nothing" })
  return done(read, { by: "model", model: hops[hops.length - 1]?.model })
}
