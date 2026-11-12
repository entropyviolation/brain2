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
import type { SleepOffsets } from "@/lib/bim-flow/text-sleep"
import { appMinutes, hardIn, isDevSignal, isMediaSignal, runsWhere, sourceCounts, type Evidence } from "./evidence"
import { resolveSleep } from "./sleep"
import { fmtClock, fmtDateTime } from "./time"
import type { Anchor, Parsed, Segment } from "./parse"
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
  /** Every sign of life the app holds (Screen Time, Chrome, texts, BIM, items, files); absent in older callers. */
  evidence?: Evidence | null
  /** How this person's sleep sits against their texts, learned from their own Sleep blocks; null with too few nights. */
  sleepOffsets?: SleepOffsets | null
  /** What a night keyed by this morning date already holds, worded; null when empty. */
  existingSleep?: (morningDate: string) => string | null
}

let seq = 0
const eid = (kind: string) => `${kind}-${Date.now().toString(36)}-${++seq}`

const field = (key: string, label: string, type: EffectField["type"], value: string | number, options?: string[]): EffectField => ({ key, label, type, value: String(value), ...(options ? { options } : {}) })

function anchoredReasons(phrase: string, b: { label: string; startMs: number; unknownStart: boolean }): string[] {
  return [
    `"${phrase}" ties this to the beginning of ${b.label}, so it is logged at that block's start, ${fmtClock(b.startMs)}.`,
    ...(b.unknownStart ? ["That start is a guess (see the Activity change), so this time is a guess too. Set both from memory."] : ["That start came from your words or from signs of life, so this time follows it. If you change the block's start, change this."]),
  ]
}

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
  /** The start is a guess with nothing in the data behind it ("stopped 4 hours ago after a while"). */
  unknownStart: boolean
  /** Signs of life placed this block's edges, so Chrome's switch logic leaves them alone. */
  locked: boolean
  /** Lines added to the effect's evidence. */
  notes: string[]
}

function layoutBlocks(segments: Segment[], nowMs: number, deps: PlanDeps, trace: string[], wokeMs: number | null): Block[] {
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
    const end = seg.endedAgoMin !== undefined ? nowMs - seg.endedAgoMin * MIN : cursor
    if (seg.endedAgoMin !== undefined) reasoning.push(`You said it stopped ${seg.endedAgoMin % 60 === 0 ? `${seg.endedAgoMin / 60} hours` : `${seg.endedAgoMin} minutes`} ago, so it ends ${fmtClock(end)}, not now.`)
    let start: number
    let assumed = false
    let unknown = false
    const fromWake = !!seg.sinceWake && wokeMs !== null && wokeMs < end
    if (fromWake) {
      start = wokeMs!
      reasoning.push(`You said it ran since you woke up, so it starts at the wake, ${fmtClock(start)}.`)
    } else if (seg.minutes !== undefined) {
      start = end - seg.minutes * MIN
      reasoning.push(`You gave ${seg.minutes} minutes, so it runs ${fmtClock(start)}–${fmtClock(end)}.`)
    } else if (seg.vague && !seg.before) {
      start = end - VAGUE_MIN * MIN
      assumed = true
      unknown = true
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
    if (bound !== null && oldest && start < bound && !fromWake) {
      start = bound
      reasoning.push(`Clamped to start at ${fmtClock(bound)}, when your last tracked activity ended, so it does not cover time you already tracked.`)
    }
    if (end - start < 5 * MIN) reasoning.push("This is very short; check the times.")
    blocks.push({ seg, label, startMs: start, endMs: end, reasoning, assumedStart: assumed, unknownStart: unknown, locked: false, notes: [] })
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
      b.unknownStart = false
      b.reasoning.push(`Chrome moved the start from ${fmtClock(from)} to ${fmtClock(b.startMs)}: the first matching page was at ${fmtClock(c.first)}, and the earlier start was only my assumption.`)
      c = chromeCheck(b.label, b.startMs, b.endMs, visits)
    }
    // Where the older activity's last page is followed by the newer one's first page, that is the switch.
    if (newer) {
      const older = c
      const newerCheck = chromeCheck(newer.label, b.startMs, newer.endMs, visits)
      if (!b.locked && !newer.locked && older.last !== null && newerCheck.first !== null && newerCheck.first > older.last) {
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

const HOUR = 60 * MIN

/** The words of an activity name that a path or title could carry. */
const same = (needle: string, hay: string) => {
  const ws = needle.toLowerCase().split(/\W+/).filter((w) => w.length >= 3)
  return ws.length > 0 && ws.every((w) => hay.toLowerCase().includes(w))
}

/**
 * Place edges with every sign of life the app holds. A work block (dev apps, local pages, file
 * changes naming it) whose start was only assumed starts where the run of work signs that reaches its
 * stop time began; the older block then ends there. A watching or scrolling block reports the signs
 * on both devices and any gap before the work. Presence moves a time; silence never does.
 */
function refineWithSignals(blocks: Block[], ev: Evidence | null, wokeMs: number | null): void {
  if (!ev) return
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    const kinds = kindsFor(b.label)
    const lo = wokeMs !== null && wokeMs < b.endMs ? wokeMs : b.endMs - 12 * HOUR
    if (kinds.includes("dev") && b.assumedStart) {
      const runs = runsWhere(ev, lo, b.endMs + 15 * MIN, (s) => isDevSignal(s, b.label), 45)
      const near = runs.filter((r) => r.end >= b.endMs - 90 * MIN && r.start < b.endMs - 5 * MIN)
      const run = near[near.length - 1]
      if (!runs.length) {
        b.notes.push(`Work signs (dev apps in Screen Time, local pages and code sites in Chrome, file changes naming "${b.label}") ${fmtClock(lo)}–${fmtClock(b.endMs)}: none found. The start is a guess.`)
      } else if (!run) {
        b.notes.push(`Work signs exist (${runs.length} run${runs.length === 1 ? "" : "s"}, latest ending ${fmtClock(runs[runs.length - 1]!.end)}) but none reaches the stop time ${fmtClock(b.endMs)}, so they do not place the start.`)
      } else {
        const found = Math.floor(run.start / (5 * MIN)) * 5 * MIN
        const from = b.startMs
        b.notes.push(`Work signs ${fmtClock(run.start)}–${fmtClock(run.end)}: ${run.n} signs (${run.tops.join(", ")}). This run reaches the stop time.`)
        if (Math.abs(found - from) >= MOVE_MIN * MIN && found >= lo && found < b.endMs - 5 * MIN) {
          b.startMs = found
          b.assumedStart = false
          b.unknownStart = false
          b.locked = true
          b.reasoning.push(`Signs of life moved the start from ${fmtClock(from)} to ${fmtClock(found)}: the run of work signs that reaches the stop time began then. It is still an estimate, not a clock you stated.`)
          const older = blocks[i + 1]
          if (older && older.endMs === from) {
            older.endMs = found
            older.locked = true
            older.reasoning.push(`Ends at ${fmtClock(found)}, where the work block's signs begin.`)
          }
        }
      }
    }
    if (kinds.some((k) => k === "video" || k === "social")) {
      const media = runsWhere(ev, b.startMs, b.endMs, isMediaSignal, 30)
      if (media.length) {
        const total = media.reduce((a, r) => a + (r.end - r.start), 0)
        b.notes.push(`Watching and scrolling signs ${fmtClock(b.startMs)}–${fmtClock(b.endMs)}: ${media.length} run${media.length === 1 ? "" : "s"}, about ${Math.round(total / MIN)} min (${[...new Set(media.flatMap((r) => r.tops))].slice(0, 4).join(", ")}). Last one ended ${fmtClock(media[media.length - 1]!.end)}.`)
        const lastEnd = media[media.length - 1]!.end
        if (b.endMs - lastEnd > 45 * MIN) b.notes.push(`Nothing watching or scrolling shows for ${Math.round((b.endMs - lastEnd) / MIN)} min before this block ends. Something not tracked may fill that time.`)
      } else b.notes.push(`Watching and scrolling signs ${fmtClock(b.startMs)}–${fmtClock(b.endMs)}: none in Screen Time or Chrome. Only your words back this block. (Other apps on the phone leave no trace.)`)
    }
    const inside = hardIn(ev, b.startMs, b.endMs)
    if (inside.length) {
      const apps = appMinutes(ev, b.startMs, b.endMs)
      b.notes.push(`All signs of you in this block: ${sourceCounts(inside)}.${apps ? ` Screen Time apps: ${apps}.` : ""}`)
    } else b.notes.push("No sign of you at a device during this block, in any source.")
  }
}

export function buildPlan(text: string, parsed: Parsed, now: Date, deps: PlanDeps): ReportPlan {
  const nowMs = now.getTime()
  const trace: string[] = [`Read your message as of ${fmtDateTime(nowMs)}.`]
  const effects: Effect[] = []

  const ev = deps.evidence ?? null
  if (ev) trace.push(...ev.sources.map((l) => `Looked at: ${l}`))
  const sleep = resolveSleep(parsed, nowMs, ev, deps.sleepOffsets ?? null)
  // Blocks first: a dose can be tied to the start of one.
  const blocks = parsed.segments.length ? layoutBlocks(parsed.segments, nowMs, deps, trace, sleep?.wokeMs ?? null) : []
  if (blocks.length) refineWithSignals(blocks, ev, sleep?.wokeMs ?? null)
  const checks = blocks.length ? refineWithChrome(blocks, deps.visits) : new Map<Block, ChromeCheck>()
  const blockFor = (anchor: Anchor | undefined) => (anchor ? blocks.find((b) => same(anchor.label, b.label) || same(anchor.label, b.seg.phrase)) : undefined)

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

  if (sleep) {
    const dateKey = fmtDateTime(sleep.wokeMs, true).slice(0, 10)
    const existing = deps.existingSleep?.(dateKey) ?? null
    trace.push(`Found a night of sleep ending ${fmtDateTime(sleep.wokeMs)}: ${fmtClock(sleep.sleptMs)}–${fmtClock(sleep.wokeMs)}.`)
    effects.push({
      id: eid("sleep"),
      kind: "sleep",
      title: `Sleep: ${fmtClock(sleep.sleptMs)}–${fmtClock(sleep.wokeMs)} (${(Math.round(((sleep.wokeMs - sleep.sleptMs) / HOUR) * 10) / 10).toString()} h), night of ${dateKey}`,
      reasoning: [...sleep.reasoning, "A night is saved in the sleep log, which paints the Sleep pen in Tracking and the Done row. Move the wake and the YouTube block's start together if you change it.", ...(sleep.bedGuessed ? ["The bedtime has nothing checking it; look hard at it."] : [])],
      evidence: [...(existing ? [`That night already holds: ${existing}. Accepting replaces its times.`] : []), ...sleep.evidence],
      fields: [field("bed", "Fell asleep", "datetime", fmtDateTime(sleep.sleptMs, true)), field("wake", "Woke up", "datetime", fmtDateTime(sleep.wokeMs, true)), field("wakeSure", "Wake time is", "select", sleep.wakeSure ? "definite" : "estimated", ["definite", "estimated"])],
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
    const tied = blockFor(dose.anchor)
    const doseAt = tied ? tied.startMs : nowMs
    effects.push({
      id: eid("intake"),
      kind: "intake",
      title: `Intake: ${dose.count > 1 ? `${dose.count} ` : ""}${dose.name} at ${fmtClock(doseAt)}`,
      reasoning: tied ? anchoredReasons(dose.phrase, tied) : [`"${dose.phrase}" is a dose with no time given, so it is logged at the time you sent the message.`],
      evidence: [],
      fields: [field("what", "What", "text", dose.name), field("class", "Class", "select", "drug", ["drug", "drink", "food"]), field("at", "When", "datetime", fmtDateTime(doseAt, true))],
      status: "pending",
    })
  }
  for (const s of parsed.supply) {
    if (!parsed.doses.some((d) => d.name === s.name)) trace.push(`Found "${s.phrase}" (${s.remaining} left) but no dose to attach it to, so I made no inventory change. Say which one.`)
  }

  for (const drink of parsed.drinks) {
    const tied = blockFor(drink.anchor)
    const at = tied ? tied.startMs : drink.earlier ? nowMs - EARLIER_MIN * MIN : nowMs
    trace.push(`Found a drink: ${drink.name} ("${drink.phrase}").`)
    effects.push({
      id: eid("intake"),
      kind: "intake",
      title: `Intake: ${drink.name} at ${fmtClock(at)}`,
      reasoning: tied ? anchoredReasons(drink.phrase, tied) : [drink.earlier ? `"Earlier" has no time. I put it ${EARLIER_MIN / 60} hours before your message; set the real time.` : `No time given, so it is logged at ${fmtClock(nowMs)}.`],
      evidence: [],
      fields: [field("what", "What", "text", drink.name), field("class", "Class", "select", "drink", ["drug", "drink", "food"]), field("at", "When", "datetime", fmtDateTime(at, true))],
      status: "pending",
    })
  }

  if (blocks.length) {
    trace.push(`Found ${parsed.segments.length} thing${parsed.segments.length === 1 ? "" : "s"} you were doing: ${parsed.segments.map((s) => s.label).join("; then before it ")}.`)
    trace.push(deps.visits ? `Cross-checked against ${deps.visits.length.toLocaleString()} kept Chrome visits.` : "No Chrome history is kept on this device, so Chrome could not check these times.")
    for (const b of blocks) {
      const c = checks.get(b)!
      const reasoning = [...b.reasoning]
      if (b.unknownStart) reasoning.push("START UNKNOWN: nothing in your words or your data placed it, so the start is only a guess. Set it from memory before you accept.")
      if (c.matchedMin) reasoning.push(`Chrome backs this up with about ${c.matchedMin} minutes of matching pages.`)
      effects.push({
        id: eid("timeblock"),
        kind: "timeblock",
        title: `Activity: ${b.label} ${b.unknownStart ? "(start unknown) " : ""}${fmtClock(b.startMs)}–${fmtClock(b.endMs)}`,
        reasoning,
        evidence: [...c.evidence, ...(b.unknownStart ? [`Start unknown: ${fmtClock(b.startMs)} is a guess.`] : []), ...b.notes],
        fields: [field("label", "Activity", "text", b.label), field("start", "From", "datetime", fmtDateTime(b.startMs, true)), field("end", "To", "datetime", fmtDateTime(b.endMs, true))],
        status: "pending",
      })
    }
  }

  if (!effects.length) trace.push("I found nothing in that to change.")
  return { id: `report-${nowMs.toString(36)}`, text, at: now.toISOString(), trace, effects }
}
