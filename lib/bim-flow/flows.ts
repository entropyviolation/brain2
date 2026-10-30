/**
 * lib/bim-flow/flows.ts — The named flows the bench can load
 *
 * Each task type has its own graph and its own default way of feeding it:
 * `messages` runs once per BIM message, `question` runs the typed question,
 * `day` runs the whole day as one input.
 */

import { defaultFlow } from "./default-flow"
import { askCalcFlow, askFlow, grammarFirstFlow, dayFlow, textsDayFlow, morningRitualFlow, nightRitualFlow, phoneCaptureFlow, reasonFlow, routedLogFlow, timeGridNoteFlow, topicFlow } from "./task-flows"
import type { Flow } from "./types"

export type FlowId = "log" | "log-routed" | "log-grammar" | "log-phone" | "log-grid" | "ask" | "ask-calc" | "topic" | "day" | "texts-day" | "reason" | "ritual-night" | "ritual-morning"
export type InputKind = "messages" | "question" | "day"

export interface FlowDef {
  id: FlowId
  name: string
  blurb: string
  input: InputKind
  build: () => Flow
}

export const FLOWS: FlowDef[] = [
  { id: "log", name: "Log a message", blurb: "One lane per room: blocks, habits, lists, people, intake, mood, place, company.", input: "messages", build: defaultFlow },
  { id: "log-routed", name: "Log: BIM text (routed)", blurb: "A front door picks one family (doing, keeping, body or mind, people), then one lane, instead of asking all ten lanes at once.", input: "messages", build: routedLogFlow },
  { id: "log-grammar", name: "Log: grammar first", blurb: "BIM's own verbs (log:, intake:, dh:, a link first, the read commands) are decided by code with no model. Only a plain line goes on to the routed log flow.", input: "messages", build: grammarFirstFlow },
  { id: "log-phone", name: "Log: phone capture", blurb: "A short phone fragment: a command or question goes to Ask, anything else is routed like BIM text.", input: "messages", build: phoneCaptureFlow },
  { id: "log-grid", name: "Log: time-grid note", blurb: "A note on an entry whose activity is already known, so only who-with, intake, mood, and person are routed.", input: "messages", build: timeGridNoteFlow },
  { id: "ask", name: "Ask about me", blurb: "A question in plain words, answered from tracked entries and notes, then checked.", input: "question", build: askFlow },
  { id: "ask-calc", name: "Ask: count it", blurb: "Totals, streaks, gaps and week-over-week counted by code. Stops early when the notes never mention the subject, and asks which person when a name fits two.", input: "question", build: askCalcFlow },
  { id: "topic", name: "Summarize a topic", blurb: "What the notes say about a project, idea, or person.", input: "question", build: topicFlow },
  { id: "reason", name: "Ritual: why-blocked reason", blurb: "A reason typed beside a task, compared with earlier reasons and the push history for that task.", input: "question", build: reasonFlow },
  { id: "ritual-night", name: "Ritual: night answer", blurb: "What was written at night, routed by what it is (worry, plan, judgment) to the earlier answers that matter.", input: "question", build: nightRitualFlow },
  { id: "ritual-morning", name: "Ritual: morning plan", blurb: "Morning intentions compared with earlier plans.", input: "question", build: morningRitualFlow },
  { id: "texts-day", name: "Texts: what was I doing", blurb: "One day of phone texts, with counts of when I was sending, read for what I was probably doing. Texts older than two weeks are never read.", input: "day", build: textsDayFlow },
  { id: "day", name: "Recap a day", blurb: "The whole day as one input, turned into a recap.", input: "day", build: dayFlow },
]

export const flowDef = (id: FlowId) => FLOWS.find((f) => f.id === id) ?? FLOWS[0]!

/**
 * Flows whose shipped graph changed shape. A browser holding a saved copy of an older graph gets the new one,
 * and the saved copy is kept under `bimflow-graph-v2:<id>:backup:<rev it replaced>` (the lab does this on load).
 */
export const FLOW_REV: Partial<Record<FlowId, string>> = {
  ask: "2026-10-30-route-fallback",
  "ask-calc": "2026-10-30-fallback",
  "log-phone": "2026-10-30-command-examples",
}
