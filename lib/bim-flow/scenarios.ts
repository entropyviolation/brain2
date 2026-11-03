/**
 * lib/bim-flow/scenarios.ts — A made-up week of BIM data, a scripted model, and the scenarios run on them
 *
 * Tests need a vault whose answers are known by hand. `SCENARIO_VAULT` is one
 * week (Oct 24–30, 2026; "now" is Fri Oct 30 15:00) with streaks, a gap, a
 * machine-painted row that must not count, two people who share a first name,
 * and a French note. `scriptedModel` stands in for Ollama: the first rule that
 * matches a request answers, and anything unmatched gets the safe default
 * (gate no, pick none, nothing found). So a scenario states only the model
 * answers it depends on, and what code does with them is what gets tested.
 */

import type { ModelCall } from "./ollama"
import type { FlowMessage } from "./types"
import type { HistoryEntry, VaultSnapshot } from "./vault-search"

export const NOW = new Date("2026-10-30T15:00:00")

export const at = (hm: string, day = "2026-10-30") => new Date(`${day}T${hm}:00`).toISOString()

const mins = (hm: string) => {
  const [h, m] = hm.split(":").map(Number)
  return h! * 60 + m!
}

/** `entry("2026-10-29", "activity", "walking", "17:00", "17:45")` */
export function entry(date: string, scope: string, pen: string, from: string, to: string, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return { date, scope, pen, startMin: mins(from), endMin: mins(to), text: "", ...extra }
}

const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, "0")}`)

const entries: HistoryEntry[] = [
  // Walking: Oct 26–30 in a row (5 days, 45m each), earlier Oct 20, 21 (a 4-day gap between).
  ...days(26, 30).map((d) => entry(d, "activity", "walking", "17:00", "17:45")),
  entry("2026-10-20", "activity", "walking", "17:00", "17:30"),
  entry("2026-10-21", "activity", "walking", "17:00", "17:30"),
  // Brain2 work: 3h Mon, 2h Tue, 90m Thu, 4h Fri so far. Mon the week before has 5h.
  entry("2026-10-26", "activity", "computer work", "09:00", "12:00", { text: "brain2 bim flow" }),
  entry("2026-10-27", "activity", "computer work", "10:00", "12:00", { text: "brain2 analytics" }),
  entry("2026-10-29", "activity", "computer work", "13:00", "14:30", { text: "brain2 mobile" }),
  entry("2026-10-30", "activity", "computer work", "08:00", "12:00", { text: "brain2 flow tests" }),
  entry("2026-10-19", "activity", "computer work", "09:00", "14:00", { text: "brain2 hub" }),
  // Showers, last on Oct 28.
  entry("2026-10-24", "activity", "shower", "08:00", "08:20"),
  entry("2026-10-26", "activity", "shower", "08:00", "08:15"),
  entry("2026-10-28", "activity", "shower", "08:10", "08:30"),
  // Gym: Oct 12, 13 and nothing since.
  entry("2026-10-12", "activity", "gym", "18:00", "19:00"),
  entry("2026-10-13", "activity", "gym", "18:00", "19:15"),
  // Cooking, two days; one of them painted by a machine (must not count).
  entry("2026-10-29", "activity", "cooking", "13:30", "14:00", { text: "garlic confit" }),
  entry("2026-10-28", "activity", "cooking", "19:00", "19:40", { confirmed: false, source: "screentime" }),
  // Moods and company (not activity scope).
  entry("2026-10-29", "mood", "anxious", "21:00", "22:00"),
  entry("2026-10-30", "mood", "calm", "09:00", "10:00"),
  entry("2026-10-29", "company", "Elijah Moore", "14:10", "15:30"),
  entry("2026-10-27", "company", "Elijah Gibbins-Croft", "19:00", "21:00"),
  // A point event.
  entry("2026-10-30", "activity", "orgasm", "11:00", "11:00", { instant: true, text: "x2" }),
]

export const SCENARIO_VAULT: VaultSnapshot = {
  items: [
    { id: "i1", title: "Garlic confit", listIds: ["cook"] },
    { id: "i2", title: "Macbook charger brick", listIds: ["needed"] },
    { id: "i3", title: "Replace bike tube", listIds: ["errands"] },
    { id: "i4", title: "White linen shirt", listIds: ["needed"] },
    { id: "i5", title: "Elijah Gibbins-Croft", type: "person", listIds: [] },
    { id: "i6", title: "Elijah Moore", type: "person", listIds: [] },
    { id: "i7", title: "Alexis Reed", type: "person", listIds: [] },
    { id: "i8", title: "Apprendre les verbes irréguliers", listIds: ["francais"] },
  ],
  lists: [
    { id: "cook", name: "Cooking" },
    { id: "needed", name: "Needed" },
    { id: "errands", name: "Errands" },
    { id: "francais", name: "Français" },
    { id: "ig", name: "People who follow me on Instagram" },
  ],
  habits: [{ id: "h1", title: "Go outside" }, { id: "h2", title: "Stretch" }],
  scopes: [
    { id: "activity", name: "Activity", pens: ["walking", "computer work", "shower", "gym", "cooking", "orgasm", "reading"].map((p) => ({ id: p, name: p })) },
    { id: "mood", name: "Mood", pens: ["anxious", "calm"].map((p) => ({ id: p, name: p })) },
  ],
  skipListIds: new Set(["ig"]),
  people: [
    { id: "i5", title: "Elijah Gibbins-Croft", names: ["Elijah Gibbins-Croft", "Eli G"] },
    { id: "i6", title: "Elijah Moore", names: ["Elijah Moore"] },
    { id: "i7", title: "Alexis Reed", names: ["Alexis Reed", "Lex"] },
  ],
  history: {
    entries,
    feed: [
      { at: at("13:30", "2026-10-29"), text: "making garlic confit now" },
      { at: at("14:00", "2026-10-29"), text: "garlic done" },
      { at: at("09:12"), text: "écrit un peu de français ce matin" },
    ],
    logs: [{ at: at("14:42", "2026-10-29"), text: "need more macbook bricks" }],
    dayNotes: [{ date: "2026-10-29", text: "Hung out with Elijah Moore. Wore the white linen shirt again." }],
    scopeNames: { activity: "Activity", mood: "Mood", company: "Company" },
  },
}

export interface Rule {
  /** Which request this answers. */
  when: (req: { system: string; user: string; schema: Record<string, unknown> }) => boolean
  reply: unknown | ((req: { system: string; user: string }) => unknown)
}

const props = (req: { schema: Record<string, unknown> }) => Object.keys((req.schema as { properties?: Record<string, unknown> }).properties ?? {})

/** Any gate whose question starts with `prefix`. */
export const gateStarting = (prefix: string, answer: "yes" | "no"): Rule => ({ when: (r) => props(r).includes("answer") && !props(r).includes("confidence") && r.user.startsWith(`Question: ${prefix}`), reply: { answer } })
/** The plan extract (fields intent, subject, person, days). */
export const plan = (p: { intent?: string; subject: string; person?: string; days?: number }): Rule => ({ when: (r) => props(r).includes("subject") && props(r).includes("intent"), reply: { intent: p.intent ?? "fact", subject: p.subject, person: p.person ?? "", days: p.days ?? 0 } })
/** Any extract with these field names. */
export const extract = (fields: string[], reply: Record<string, unknown>): Rule => ({ when: (r) => fields.every((f) => props(r).includes(f)), reply })
/** A choose node. */
export const pick = (picks: string[]): Rule => ({ when: (r) => props(r).includes("picks"), reply: { picks } })
/** The answer node. `echo` repeats the first fact so a scenario can see what the model was handed. */
export const say = (confidence: "high" | "medium" | "low" | "none", text = "ok"): Rule => ({
  when: (r) => props(r).includes("answer") && props(r).includes("confidence"),
  reply: (r: { user: string }) => ({ answer: text === "echo" ? (/FACTS COUNTED BY CODE:\n- ([^\n]*)/.exec(r.user)?.[1] ?? "no facts") : text, confidence, used: [1] }),
})

export interface ScriptedModel {
  call: ModelCall
  /** Every request, in order. */
  calls: { system: string; user: string; props: string[] }[]
}

export function scriptedModel(rules: Rule[]): ScriptedModel {
  const calls: ScriptedModel["calls"] = []
  const call: ModelCall = async (req) => {
    calls.push({ system: req.system, user: req.user, props: props(req) })
    for (const r of rules) {
      if (r.when(req)) return typeof r.reply === "function" ? (r.reply as (q: typeof req) => unknown)(req) : r.reply
    }
    const p = props(req)
    if (p.includes("confidence")) return { answer: "", confidence: "none", used: [] }
    if (p.includes("answer")) return { answer: "no" }
    if (p.includes("picks")) return { picks: [] }
    if (p.includes("routes")) return { routes: [] }
    if (p.includes("terms")) return { terms: [] }
    if (p.includes("insights")) return { insights: [] }
    return {}
  }
  return { call, calls }
}

export const message = (text: string, o: Partial<FlowMessage> = {}): FlowMessage => ({ id: "m", text, at: NOW.toISOString(), prior: [], ...o })
