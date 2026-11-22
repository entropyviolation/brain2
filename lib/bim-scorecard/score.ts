/**
 * lib/bim-scorecard/score.ts — Score one replayed BIM chat turn against its label (pure)
 *
 * A labelled line (`LabelledLine`) says which lane the person meant and what should have happened. A replayed turn
 * (`Observed`) is what BIM really did: the reply, the writes the executor applied, the cards it proposed, and the
 * turn's Trace. Three checks per line:
 *
 * - **lane**: did BIM take the line the way the person meant (`observedLane` against `ACCEPTS`)?
 * - **action**: did it also do the thing (a To Do with the words, a block, an answer that is not "I don't know")?
 * - **no invented write**: nothing was written to a room the line did not ask for. A plain log or an unsorted Inbox
 *   capture is a fallback, not an invention; a mood set from "grocery list: …" is an invention.
 *
 * Plus the time per stage of the turn, read from the Trace (`stagesOf`). Nothing here runs BIM.
 */

import type { Trace } from "@/lib/agents/trace"
import type { IngestEvent } from "@/lib/ingest/types"

/** One row of `data/bim-log-export/real-lines.labelled.jsonl`, or of the committed fixture. */
export interface LabelledLine {
  text: string
  ts: string
  source: string
  expectedLane: string
  expectedAction: string
  notes?: string
  labelConfidence: number
  /** A case the person flagged: it is listed first in the printed scorecard. */
  priority?: boolean
  /** A fuller expectation, for lines one lane cannot judge. */
  expect?: { social?: SocialExpect }
}

/**
 * What a line about many people should give (`docs/BIM_CHAT_USAGE.md` §5, failure 1): everyone named found or
 * proposed, the new people proposed as new, a birthday said in passing kept, the hang-out kept as an event with
 * its place, and questions back for what was not said (which show, when, who was there).
 */
export interface SocialExpect {
  /** Every person named, known or new, first names as said. */
  named: string[]
  /** The ones to make in People I Know. */
  newPeople: string[]
  /** The person whose birthday the line gives. */
  birthdayOf?: string
  /** A hang-out or trip event should be proposed. */
  event: boolean
  /** A word the place should carry ("apartment", "city"). */
  place?: string
  /** BIM should ask at least one question back. */
  followUp: boolean
}

/** One proposed change of a card (`lib/report-bimby/types.ts`), cut to what the scorecard reads. */
export interface PlannedEffect {
  kind: string
  title: string
  fields: Record<string, string>
}

export interface SocialScore {
  named: number
  namedOf: number
  newPeople: number
  newOf: number
  birthday: boolean | null
  event: boolean
  place: boolean | null
  followUp: boolean
  /** Checks passed, of checks that apply. */
  passed: number
  of: number
}

const first = (s: string) => s.trim().split(/\s+/)[0]!.toLowerCase()

export function scoreSocial(want: SocialExpect, o: Observed): SocialScore {
  const effects = o.plan ?? []
  const people = new Set<string>()
  const made = new Set<string>()
  for (const e of effects) {
    for (const k of ["name", "person"]) if (e.fields[k]) people.add(first(e.fields[k]!))
    if (e.kind === "person" && /^new person/i.test(e.title) && e.fields.name) made.add(first(e.fields.name))
  }
  const named = want.named.filter((n) => people.has(first(n))).length
  const newPeople = want.newPeople.filter((n) => made.has(first(n))).length
  const birthday = want.birthdayOf ? effects.some((e) => e.kind === "birthday" && first(e.fields.person ?? "") === first(want.birthdayOf!)) : null
  const event = effects.some((e) => /plan-entry|event|hang|reminder|trip/.test(e.kind))
  const place = want.place ? effects.some((e) => Object.values(e.fields).some((v) => v.toLowerCase().includes(want.place!.toLowerCase())) && e.kind !== "person-note") : null
  const followUp = (o.choices ?? 0) > 0 || /\?\s*$/m.test(o.text)
  const checks = [named === want.named.length, newPeople === want.newPeople.length, birthday, want.event ? event : null, place, want.followUp ? followUp : null].filter((c): c is boolean => c !== null)
  return { named, namedOf: want.named.length, newPeople, newOf: want.newPeople.length, birthday, event, place, followUp, passed: checks.filter(Boolean).length, of: checks.length }
}

/** What a replayed turn did. `writes` are the applied ingest events of the turn, oldest first. */
export interface Observed {
  text: string
  status: string
  kind?: string
  route?: string
  /** Card ids the reply carries (report, stream, wire, day, habits): a proposal, nothing written yet. */
  cards: string[]
  writes: Pick<IngestEvent, "kind" | "raw" | "summary">[]
  trace?: Trace
  ms: number
  /** The card's proposed changes, when the reply carries a Report or Social card. */
  plan?: PlannedEffect[]
  /** Answer keys under the reply (a question back). */
  choices?: number
}

/** The lane a write's kind belongs to. A kind not here is its own lane name. */
const WRITE_LANE: Record<string, string> = {
  "event-log": "log",
  note: "log",
  "thought-process": "thought",
  link: "link",
  journal: "photo",
  pdf: "photo",
  receipt: "money",
  track: "track",
  start: "track",
  stop: "track",
  currently: "track",
  "switched-to": "track",
  "stopped-activity": "track",
  switch: "track",
  "switch-task": "track",
  "switch-objective": "track",
  sleep: "track",
  location: "track",
  "now-capture": "track",
  transit: "track",
  intake: "intake",
  "event-trigger": "intake",
  "habit-trigger": "intake",
  cycle: "intake",
  nfc: "intake",
  mood: "mood",
  habit: "habit",
  grocery: "shopping",
  needed: "shopping",
  bought: "shopping",
  plan: "plan-day",
  "plan-now": "plan-day",
  "todo-today": "todo",
  // `do` reads the Next actions list back; it changes nothing the person did not ask for.
  do: "command",
  tell: "tell",
  bulk: "bulk",
  inventory: "list",
}

/** Writes that only keep the words: a plain log, or a capture with no list path. A fallback, never an invention. */
export const FALLBACK = new Set(["log", "inbox"])

/** A capture lands on a list when the line names one (`Cleaning: bedroom: …`), else it is an unsorted Inbox line. */
const LIST_PATH = /^\s*[\p{L}\d][\p{L}\d &'/-]{0,30}:\s*\S/u
const BRAIN2 = /^\s*(brain ?2|bim)\b/i

export function laneOfWrite(w: Pick<IngestEvent, "kind" | "raw" | "summary">): string {
  if (w.kind === "capture") {
    if (BRAIN2.test(w.raw)) return "meta"
    if (/monkey brain/i.test(w.summary)) return "list"
    return LIST_PATH.test(w.raw) ? "list" : "inbox"
  }
  return WRITE_LANE[w.kind] ?? w.kind
}

/** The route chip's first word, upper case ("ASK", "KEEP", "HANDOFF"), or "". */
const chipOf = (route?: string) => (route ?? "").split(/\s/)[0]!.toUpperCase()

const FAILED_ANSWER = /\b(I don't know|did not log|not filed|can't tell|could not|failed|no phone number|need BIM chat with LLM on)\b/i

/**
 * What BIM took the line to be. Cards and lane chips first (they say what ran), then what was written, then the
 * reply alone: an answer, a readout, a question back.
 */
export function observedLane(o: Observed): string {
  const chip = chipOf(o.route)
  const byChip: Record<string, string> = {
    REPORT: "track",
    STREAM: "track",
    SOCIAL: "social",
    DAY: "plan-day",
    WIRE: "build",
    KEEP: "todo",
    MARK: "log",
    TEXTS: "texts",
    WEB: "web",
    CHAT: "chat",
    RESISTANCE: "chat",
    CORRECT: "correct",
    FOLLOW: "command",
    FLIGHT: "tell",
  }
  if (chip === "HANDOFF") return /habit/i.test(o.route ?? "") ? "habit" : /tracking/i.test(o.route ?? "") ? "track" : "handoff"
  if (chip === "ASK" && !o.writes.length) return FAILED_ANSWER.test(o.text) || o.status === "error" ? "ask-failed" : "ask"
  if (byChip[chip] && !(chip === "KEEP" && !o.writes.length)) return byChip[chip]!
  if (/^MONEY|FINANCE/.test(chip)) return "money"
  if (o.cards.length) return /habit/i.test(o.cards.join(" ")) ? "habit" : "track"
  // The first write that is not a fallback says the most; else the fallback.
  const lanes = o.writes.map(laneOfWrite)
  const real = lanes.find((l) => !FALLBACK.has(l))
  if (real) return real
  if (lanes.length) return lanes[0]!
  if (o.status === "needs_clarify") return "asked"
  if (o.status === "ignored") return "declined"
  if (o.status === "error") return "error"
  if (o.kind === "tell") return "answer"
  return "command"
}

/** For each expected lane, the observed lanes that count as right. */
export const ACCEPTS: Record<string, readonly string[]> = {
  link: ["link"],
  // A Brain2 idea kept on To Do or on a named list is kept where the person will see it.
  meta: ["meta", "todo", "list"],
  track: ["track"],
  log: ["log"],
  dream: ["log"],
  thought: ["thought"],
  list: ["list", "shopping"],
  shopping: ["shopping", "list"],
  todo: ["todo"],
  intake: ["intake"],
  mood: ["mood"],
  habit: ["habit"],
  // "Plan:", "Intention:", "Objective:" are list paths the person uses on purpose.
  "plan-day": ["plan-day", "list"],
  social: ["social"],
  // `stop`, `start o` and `nfc:` are commands that write a pen or an intake by design.
  command: ["command", "answer", "track", "intake"],
  chat: ["chat"],
  ask: ["ask", "answer"],
  tell: ["tell", "answer"],
  texts: ["texts"],
  web: ["web"],
  build: ["build", "answer", "tell"],
  money: ["money"],
  paste: ["paste"],
  handoff: ["handoff", "habit", "track"],
  correct: ["correct"],
  photo: ["photo"],
}

/** Lanes whose line asks for an answer, not a filing: their action is a reply that says something. */
const ANSWER_LANES = new Set(["ask", "tell", "texts", "web", "chat"])

const STOP = new Set("a an and are at be but for from i im in is it its me my of on or so the to too u up was with just also now really".split(" "))
const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length > 2 && !STOP.has(w)))

export interface LineScore {
  lane: string
  laneRight: boolean
  actionRight: boolean
  /** Writes to a room the line did not ask for, as `lane:kind`. Empty is good. */
  invented: string[]
}

export function scoreLine(want: LabelledLine, o: Observed): LineScore {
  const lane = observedLane(o)
  const accepts = ACCEPTS[want.expectedLane] ?? [want.expectedLane]
  const laneRight = accepts.includes(lane)
  const writeLanes = o.writes.map((w) => ({ w, lane: laneOfWrite(w) }))
  const invented = writeLanes.filter((x) => !FALLBACK.has(x.lane) && !accepts.includes(x.lane)).map((x) => `${x.lane}:${x.w.kind}`)
  let actionRight = laneRight
  if (laneRight) {
    if (ANSWER_LANES.has(want.expectedLane)) actionRight = o.status !== "error" && !!o.text.trim() && !FAILED_ANSWER.test(o.text)
    else if (want.expectedLane === "todo") {
      const said = words(want.text)
      actionRight = writeLanes.some((x) => x.lane === "todo" && [...words(x.w.raw)].some((w) => said.has(w)))
    } else if (["log", "dream", "thought"].includes(want.expectedLane)) actionRight = writeLanes.some((x) => accepts.includes(x.lane))
  }
  return { lane, laneRight, actionRight, invented }
}

/** Milliseconds per stage of one turn, from its Trace. Stages nest (the router runs inside the ladder), so they do not sum to the turn. */
export interface Stages {
  turnMs: number
  /** Code lanes before the ladder, together. */
  lanesMs: number
  crewMs: number
  routerMs: number
  askMs: number
  chatMs: number
  executorMs: number
  followMs: number
  cuesMs: number
  modelCalls: number
  modelMs: number
  /** Ollama's own model load time, summed: a cold or swapped model. */
  loadMs: number
  /** Model calls by the stage that asked. */
  callsBy: Record<string, number>
  /** The lane that took the line. */
  takenBy: string | null
}

export function stagesOf(trace: Trace | undefined, ms: number): Stages {
  const s: Stages = { turnMs: ms, lanesMs: 0, crewMs: 0, routerMs: 0, askMs: 0, chatMs: 0, executorMs: 0, followMs: 0, cuesMs: 0, modelCalls: 0, modelMs: 0, loadMs: 0, callsBy: {}, takenBy: null }
  if (!trace) return s
  for (const e of trace.events) {
    const d = e.t1 - e.t0
    if (e.kind === "model-reply") {
      s.modelCalls++
      s.modelMs += d
      s.callsBy[e.actor] = (s.callsBy[e.actor] ?? 0) + 1
      const load = (e.data as { loadMs?: number } | undefined)?.loadMs
      if (typeof load === "number") s.loadMs += load
      continue
    }
    if (e.kind === "decision" && !e.parent) {
      if (e.actor !== "ladder") s.lanesMs += d
      if (e.status === "ok") s.takenBy = e.actor
    }
    if (e.actor === "switchboard:crew") s.crewMs += d
    if (e.actor === "switchboard:router") s.routerMs += d
    if (e.actor === "switchboard:ask") s.askMs += d
    if (e.actor === "switchboard:chat") s.chatMs += d
    if (e.actor === "ladder:executor") s.executorMs += d
    if (e.actor === "follow-through") s.followMs += d
    if (e.actor === "cues") s.cuesMs += d
  }
  return s
}
