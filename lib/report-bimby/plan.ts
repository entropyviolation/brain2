/**
 * lib/report-bimby/plan.ts — Turn a parsed report into a plan: effects, reasons, and Chrome cross-checks
 *
 * Pure. The caller hands in what the stores hold (inventory counts, the end of the last tracked
 * activity, Activity pen names) and the Chrome visits kept on this computer, so the same plan
 * can be built in a test. Every guess says it is a guess and why, and every number it chose is
 * an editable field.
 *
 * Time blocks run backward from the message: the newest thing ends now, "before that" ends where
 * the newer one starts. A vague "for a while" is assumed to be `VAGUE_MIN`. The oldest block starts
 * at the end of the last tracked activity when there is one. Chrome then checks each block: which
 * visits fall inside, and, when the stated start has no number behind it, where the first matching
 * visit actually is.
 */

import { categoryOf, devTitles, runsOf, type Visit } from "@/lib/browser-history"
import { fmtClock, fmtDateTime } from "./time"
import type { Parsed, Segment } from "./parse"
import type { Effect, EffectField, ReportPlan } from "./types"

export const VAGUE_MIN = 180
/** With nothing tracked to anchor "before that", assume this long. */
export const UNANCHORED_MIN = 120
export const EARLIER_MIN = 120
const MIN = 60_000
/** A Chrome-suggested boundary only moves the stated one when it differs by at least this. */
const MOVE_MIN = 10

export interface PlanDeps {
  /** An inventory item matching the name, with its count; null when none. */
  inventory: (name: string) => { name: string; qty: number } | null
  /** End (epoch ms) of the latest tracked activity that ended before `beforeMs` and within the last 12h; null when none. */
  lastTrackedEnd: (beforeMs: number) => number | null
  /** An Activity pen that fits the label, or null. */
  matchPen: (label: string) => string | null
  /** Chrome visits kept on this computer; null when this device has none. */
  visits: Visit[] | null
}

let seq = 0
const eid = (kind: string) => `${kind}-${Date.now().toString(36)}-${++seq}`

const field = (key: string, label: string, type: EffectField["type"], value: string | number, options?: string[]): EffectField => ({ key, label, type, value: String(value), ...(options ? { options } : {}) })

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Kind = "video" | "social" | "dev"

/** Which Chrome categories would show this label's activity. */
export function kindsFor(label: string): Kind[] {
  const l = label.toLowerCase()
  const out: Kind[] = []
  if (/youtube|video|watch|netflix|twitch/.test(l)) out.push("video")
  if (/scroll|social|insta|reddit|tiktok|twitter/.test(l)) out.push("social")
  if (/game|code|coding|build|app|brain2|dev|work|design/.test(l)) out.push("dev")
  return out
}

function kindOfVisit(v: Visit): Kind | null {
  const c = categoryOf(v.host)
  if (c === "Video") return "video"
  if (c === "Social") return "social"
  if (c === "Local dev" || c === "Code" || c === "AI & image gen") return "dev"
  return null
}

export interface ChromeCheck {
  /** Lines for the evidence list. */
  evidence: string[]
  /** First matching visit (epoch ms) inside the window, or null. */
  first: number | null
  last: number | null
  matchedMin: number
}

/** What Chrome shows for one block: matching visits inside [start, end], their time, and the pages. */
export function chromeCheck(label: string, startMs: number, endMs: number, visits: Visit[] | null): ChromeCheck {
  const none = (why: string): ChromeCheck => ({ evidence: [why], first: null, last: null, matchedMin: 0 })
  if (!visits) return none("Chrome history: none kept on this device, so nothing to cross-check.")
  const kinds = kindsFor(label)
  if (!kinds.length) return none(`Chrome history: "${label}" has no site pattern to look for.`)
  const inWindow = visits.filter((v) => v.t >= startMs && v.t <= endMs).sort((a, b) => a.t - b.t)
  const matching = inWindow.filter((v) => {
    const k = kindOfVisit(v)
    return k !== null && kinds.includes(k)
  })
  const window = `${fmtClock(startMs)}–${fmtClock(endMs)}`
  if (!matching.length) {
    const newest = visits.length ? Math.max(...visits.map((v) => v.t)) : 0
    const stale = newest && newest < endMs - 30 * MIN ? ` Chrome's newest kept visit is ${fmtDateTime(newest)}, so it may not have synced since.` : ""
    return none(`Chrome history ${window}: no ${kinds.join("/")} visits among ${inWindow.length} pages.${stale}`)
  }
  let ms = 0
  for (const run of runsOf(matching)) ms += Math.max(0, Math.min(run.end, endMs) - Math.max(run.start, startMs))
  const hosts = new Map<string, number>()
  for (const v of matching) hosts.set(v.host, (hosts.get(v.host) ?? 0) + 1)
  const top = [...hosts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, n]) => `${h.startsWith("localhost") ? (devTitles(matching).get(h) ?? h) : h} ×${n}`)
  const titles = [...new Set(matching.map((v) => v.title.trim()).filter((t) => t.length > 3))].slice(0, 2)
  const first = matching[0]!.t
  const last = matching[matching.length - 1]!.t
  return {
    evidence: [`Chrome history ${window}: ${matching.length} matching pages, about ${Math.round(ms / MIN)} min (${top.join(", ")}). First ${fmtClock(first)}, last ${fmtClock(last)}.`, ...titles.map((t) => `   > ${t}`)],
    first,
    last,
    matchedMin: Math.round(ms / MIN),
  }
}

interface Block {
  seg: Segment
  label: string
  startMs: number
  endMs: number
  reasoning: string[]
  /** The start was assumed, not stated, so Chrome may refine it. */
  assumedStart: boolean
}

function layoutBlocks(segments: Segment[], nowMs: number, deps: PlanDeps, trace: string[]): Block[] {
  const bound = deps.lastTrackedEnd(nowMs)
  if (bound !== null) trace.push(`Your last tracked activity ended at ${fmtClock(bound)}. Time after that is unknown, so blocks may start there.`)
  else trace.push("Nothing is tracked in the last 12 hours, so there is no anchor for how far back blocks go.")
  const blocks: Block[] = []
  let cursor = nowMs
  segments.forEach((seg, i) => {
    const pen = deps.matchPen(seg.label)
    const label = pen ?? seg.label
    const reasoning: string[] = [`You said: "${seg.phrase}".`]
    if (pen && pen !== seg.label) reasoning.push(`"${seg.label}" matches your existing Activity pen "${pen}", so the block uses it.`)
    const oldest = i === segments.length - 1
    const end = cursor
    let start: number
    let assumed = false
    if (seg.minutes !== undefined) {
      start = end - seg.minutes * MIN
      reasoning.push(`You gave ${seg.minutes} minutes, so it runs ${fmtClock(start)}–${fmtClock(end)}.`)
    } else if (seg.vague && !seg.before) {
      start = end - VAGUE_MIN * MIN
      assumed = true
      reasoning.push(`"For a while" has no number. I assumed ${VAGUE_MIN / 60} hours back from ${fmtClock(end)}; change the start if that is off.`)
    } else if (bound !== null && bound < end) {
      start = bound
      assumed = true
      reasoning.push(`No length given. It fills from the end of your last tracked activity (${fmtClock(bound)}) to ${fmtClock(end)}.`)
    } else {
      start = end - UNANCHORED_MIN * MIN
      assumed = true
      reasoning.push(`No length given and nothing tracked to anchor it. I assumed ${UNANCHORED_MIN / 60} hours.`)
    }
    if (bound !== null && oldest && start < bound) {
      start = bound
      reasoning.push(`Clamped to start at ${fmtClock(bound)}, when your last tracked activity ended, so it does not cover time you already tracked.`)
    }
    if (end - start < 5 * MIN) reasoning.push("This is very short; check the times.")
    blocks.push({ seg, label, startMs: start, endMs: end, reasoning, assumedStart: assumed })
    cursor = start
  })
  return blocks
}

/** Move boundaries where Chrome says the activities really switched. */
function refineWithChrome(blocks: Block[], visits: Visit[] | null): Map<Block, ChromeCheck> {
  const checks = new Map<Block, ChromeCheck>()
  if (!visits) {
    for (const b of blocks) checks.set(b, chromeCheck(b.label, b.startMs, b.endMs, null))
    return checks
  }
  // Blocks are newest first. Each older block's end is the newer block's start.
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    const newer = blocks[i - 1]
    let c = chromeCheck(b.label, b.startMs, b.endMs, visits)
    if (b.assumedStart && c.first !== null && c.first - b.startMs >= MOVE_MIN * MIN) {
      const from = b.startMs
      b.startMs = Math.floor(c.first / (5 * MIN)) * 5 * MIN
      b.reasoning.push(`Chrome moved the start from ${fmtClock(from)} to ${fmtClock(b.startMs)}: the first matching page was at ${fmtClock(c.first)}, and the earlier start was only my assumption.`)
      c = chromeCheck(b.label, b.startMs, b.endMs, visits)
    }
    // Where the older activity's last page is followed by the newer one's first page, that is the switch.
    if (newer) {
      const older = c
      const newerCheck = chromeCheck(newer.label, b.startMs, newer.endMs, visits)
      if (older.last !== null && newerCheck.first !== null && newerCheck.first > older.last) {
        const at = Math.round((older.last + newerCheck.first) / 2 / (5 * MIN)) * 5 * MIN
        if (Math.abs(at - b.endMs) >= MOVE_MIN * MIN && at > b.startMs && at < newer.endMs) {
          const from = b.endMs
          b.endMs = at
          newer.startMs = at
          b.reasoning.push(`Chrome moved the switch from ${fmtClock(from)} to ${fmtClock(at)}: your last ${b.label} page was ${fmtClock(older.last)} and the first ${newer.label} page ${fmtClock(newerCheck.first)}.`)
          newer.reasoning.push(`Start moved to ${fmtClock(at)} to match the switch Chrome shows.`)
          c = chromeCheck(b.label, b.startMs, b.endMs, visits)
          checks.set(newer, chromeCheck(newer.label, newer.startMs, newer.endMs, visits))
        }
      }
    }
    checks.set(b, c)
  }
  // A newer block whose start moved was checked before it moved; re-check so evidence matches the final times.
  for (const b of blocks) checks.set(b, chromeCheck(b.label, b.startMs, b.endMs, visits))
  return checks
}

export function buildPlan(text: string, parsed: Parsed, now: Date, deps: PlanDeps): ReportPlan {
  const nowMs = now.getTime()
  const trace: string[] = [`Read your message as of ${fmtDateTime(nowMs)}.`]
  const effects: Effect[] = []

  if (parsed.period) {
    const day = new Date(now)
    day.setDate(day.getDate() + parsed.period.dayOffset)
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    trace.push(`Found a period starting ${parsed.period.dayOffset === 0 ? "today" : "yesterday"}: "${parsed.period.phrase}".`)
    effects.push({
      id: eid("cycle"),
      kind: "cycle",
      title: `Cycle: mark bleeding on ${date}`,
      reasoning: [`"${parsed.period.phrase}" says your period started ${parsed.period.dayOffset === 0 ? "today" : "yesterday"}.`, "The Cycle calendar marks a period's first day as a bleeding day, so I mark that day. Spotting and ovulation are not touched."],
      evidence: [],
      fields: [field("date", "Day", "text", date), field("flag", "Mark", "select", "bleeding", ["bleeding", "spotting", "ovulation"])],
      status: "pending",
    })
  }

  for (const dose of parsed.doses) {
    const supply = parsed.supply.find((s) => s.name === dose.name)
    const item = deps.inventory(dose.name)
    const name = item?.name ?? titleCase(dose.name)
    trace.push(`Found a dose: ${dose.count} ${dose.name} ("${dose.phrase}").${supply ? ` Supply left: ${supply.remaining} ("${supply.phrase}").` : ""}`)
    const reasoning: string[] = []
    const evidence: string[] = []
    let qty: number
    if (supply) {
      qty = supply.remaining
      reasoning.push(`You said ${supply.remaining} left, so the count is set to ${supply.remaining}, not counted down from a stored number.`)
    } else if (item) {
      qty = Math.max(0, item.qty - dose.count)
      reasoning.push(`You did not say how many are left. Counting down: ${item.qty} - ${dose.count} = ${qty}.`)
    } else {
      qty = 0
      reasoning.push("You did not say how many are left and Inventory has no count, so the count starts at 0. Set the right number.")
    }
    if (item) {
      evidence.push(`Inventory has ${item.name} at ${item.qty}.`)
      if (supply && item.qty - dose.count !== supply.remaining) reasoning.push(`Inventory said ${item.qty}; minus this dose is ${item.qty - dose.count}, which is not ${supply.remaining}. I trust what you just said.`)
    } else {
      reasoning.push(`Inventory has no "${dose.name}" item. Accepting creates it.`)
    }
    effects.push({ id: eid("inventory"), kind: "inventory", title: `Inventory: ${name} → ${qty}`, reasoning, evidence, fields: [field("name", "Item", "text", name), field("qty", "Count", "number", qty)], status: "pending" })
    effects.push({
      id: eid("intake"),
      kind: "intake",
      title: `Intake: ${dose.count > 1 ? `${dose.count} ` : ""}${dose.name} at ${fmtClock(nowMs)}`,
      reasoning: [`"${dose.phrase}" is a dose with no time given, so it is logged at the time you sent the message.`],
      evidence: [],
      fields: [field("what", "What", "text", dose.name), field("class", "Class", "select", "drug", ["drug", "drink", "food"]), field("at", "When", "datetime", fmtDateTime(nowMs, true))],
      status: "pending",
    })
  }
  for (const s of parsed.supply) {
    if (!parsed.doses.some((d) => d.name === s.name)) trace.push(`Found "${s.phrase}" (${s.remaining} left) but no dose to attach it to, so I made no inventory change. Say which one.`)
  }

  for (const drink of parsed.drinks) {
    const at = drink.earlier ? nowMs - EARLIER_MIN * MIN : nowMs
    trace.push(`Found a drink: ${drink.name} ("${drink.phrase}").`)
    effects.push({
      id: eid("intake"),
      kind: "intake",
      title: `Intake: ${drink.name} at ${fmtClock(at)}`,
      reasoning: [drink.earlier ? `"Earlier" has no time. I put it ${EARLIER_MIN / 60} hours before your message; set the real time.` : `No time given, so it is logged at ${fmtClock(nowMs)}.`],
      evidence: [],
      fields: [field("what", "What", "text", drink.name), field("class", "Class", "select", "drink", ["drug", "drink", "food"]), field("at", "When", "datetime", fmtDateTime(at, true))],
      status: "pending",
    })
  }

  if (parsed.segments.length) {
    // Textual order is newest first; a "before that" is older than the segment before it.
    const blocks = layoutBlocks(parsed.segments, nowMs, deps, trace)
    trace.push(`Found ${parsed.segments.length} thing${parsed.segments.length === 1 ? "" : "s"} you were doing: ${parsed.segments.map((s) => s.label).join("; then before it ")}.`)
    const checks = refineWithChrome(blocks, deps.visits)
    trace.push(deps.visits ? `Cross-checked against ${deps.visits.length.toLocaleString()} kept Chrome visits.` : "No Chrome history is kept on this device, so these times are your words and my assumptions only.")
    for (const b of blocks) {
      const c = checks.get(b)!
      const reasoning = [...b.reasoning]
      if (c.matchedMin) reasoning.push(`Chrome backs this up with about ${c.matchedMin} minutes of matching pages.`)
      effects.push({
        id: eid("timeblock"),
        kind: "timeblock",
        title: `Activity: ${b.label} ${fmtClock(b.startMs)}–${fmtClock(b.endMs)}`,
        reasoning,
        evidence: c.evidence,
        fields: [field("label", "Activity", "text", b.label), field("start", "From", "datetime", fmtDateTime(b.startMs, true)), field("end", "To", "datetime", fmtDateTime(b.endMs, true))],
        status: "pending",
      })
    }
  }

  if (!effects.length) trace.push("I found nothing in that to change.")
  return { id: `report-${nowMs.toString(36)}`, text, at: now.toISOString(), trace, effects }
}
