/**
 * lib/plan-bimby/day/tweak.ts — Change the day plan by saying so (pure, rules only)
 *
 * While a day plan is live, a chat line or the card's tweak box can change it: "pack will take 2 hours",
 * "drop shave legs", "also call mom", "plan ny is a must", "foxtide first", "why dye hair: photos in NY",
 * "dreading pack", "until 11pm". A line that names nothing on the plan is not a tweak and goes on to the
 * rest of the chat. `act` asks the caller to file, start, or mark a row.
 */

import { estimateFor, span, type PastRun } from "./estimate"
import { nameScore, startsWithVerb } from "./read"
import { dayItemId, TIER_LABEL, type DayItem, type DayPlan, type DayTier } from "./types"

export type DayAct = { kind: "file" } | { kind: "start" } | { kind: "done"; itemId: string } | { kind: "play"; itemId: string } | { kind: "reject" }

export interface Tweak {
  plan: DayPlan
  said: string
  act?: DayAct
}

/** The item a phrase names. Either the phrase holds the item's name, or the item's name holds the phrase. A tie is no answer. */
export function findItem(plan: Pick<DayPlan, "items">, phrase: string): DayItem | null {
  let best: DayItem | null = null
  let top = 0
  let tied = false
  for (const item of plan.items) {
    const s = Math.max(nameScore(item.title, phrase), nameScore(phrase, item.title))
    if (s > top) {
      top = s
      best = item
      tied = false
    } else if (s && s === top) tied = true
  }
  return tied ? null : best
}

export function newItem(title: string, tier: DayTier, past: readonly PastRun[], minutes?: number): DayItem {
  return { id: dayItemId(), title, said: title, tier, urgent: false, subtasks: [], estimate: estimateFor(title, minutes, past), why: "", ifNot: "", blocker: "", reasons: ["You added it."] }
}

const patchItem = (plan: DayPlan, id: string, patch: Partial<DayItem>): DayPlan => ({ ...plan, revisions: plan.revisions + 1, items: plan.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })

function minutesOf(n: string, unit: string): number {
  return Math.max(1, Math.round(/^h/i.test(unit) ? Number(n) * 60 : Number(n)))
}

function clockOf(h: string, m: string | undefined, ap: string | undefined): string | null {
  let hour = Number(h)
  if (ap) {
    if (/pm/i.test(ap) && hour < 12) hour += 12
    if (/am/i.test(ap) && hour === 12) hour = 0
  } else if (hour >= 1 && hour <= 6) hour += 12
  if (hour > 24) return null
  return `${String(hour === 24 ? 23 : hour).padStart(2, "0")}:${hour === 24 ? "59" : (m ?? "00")}`
}

const TIER_WORD: [RegExp, DayTier][] = [
  [/^(?:a\s+)?(?:must|non[- ]?negotiable|required)$/i, "must"],
  [/^(?:important|a priority)$/i, "important"],
  [/^(?:optional|if time|not urgent|a bonus)$/i, "rest"],
]

export function tweakDay(plan: DayPlan, line: string, past: readonly PastRun[] = []): Tweak | null {
  const t = line.trim().replace(/[.!]+$/, "")
  if (!t || /\?\s*$/.test(t) || t.length > 240) return null
  let m: RegExpExecArray | null

  if (/^(?:file it|file the plan|put (?:it|them|that|the plan) on (?:my )?to ?do(?: list)?(?: today)?|add (?:it|them|the plan) to (?:my )?to ?do(?: list)?|accept the plan)$/i.test(t)) return { plan, said: "", act: { kind: "file" } }
  if (/^(?:start (?:the |my )?plan|let'?s (?:go|start)|run the plan|begin the plan)$/i.test(t)) return { plan, said: "", act: { kind: "start" } }
  if (/^(?:scrap|reject|cancel|forget) (?:the|this|that) plan$/i.test(t)) return { plan, said: "", act: { kind: "reject" } }

  // "until 11pm", "I have until 10:30", "bedtime is 12am"
  if ((m = /^(?:i have |i'?ve got )?(?:until|till|done by|bed ?time (?:is|at)|ending at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t))) {
    const until = clockOf(m[1]!, m[2], m[3])
    return until ? { plan: { ...plan, until, revisions: plan.revisions + 1 }, said: `The day now ends at ${until}.` } : null
  }

  // "pack will take 2 hours", "dye hair: 90 min", "20 min for shave legs"
  m = /^(.+?)\s*(?:will take|takes|should take|is|=|:|-)\s*(?:about|around|like|~|maybe)?\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)$/i.exec(t)
  const rev = m ? null : /^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\s+(?:for|on)\s+(.+)$/i.exec(t)
  if (m || rev) {
    const item = findItem(plan, m ? m[1]! : rev![3]!)
    if (!item) return null
    const minutes = m ? minutesOf(m[2]!, m[3]!) : minutesOf(rev![1]!, rev![2]!)
    return { plan: patchItem(plan, item.id, { estimate: { minutes, source: "you", basis: "You set it." } }), said: `"${item.title}" is now ${span(minutes)}.` }
  }

  // "done dye hair", "finished packing", "starting foxtide"
  if ((m = /^(?:done(?: with)?|finished|did|completed)\s+(.+)$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    return item ? { plan, said: "", act: { kind: "done", itemId: item.id } } : null
  }
  if ((m = /^(?:starting|start|doing|working on|on to)\s+(.+?)(?:\s+now)?$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    return item && plan.runId ? { plan, said: "", act: { kind: "play", itemId: item.id } } : null
  }

  // "drop shave legs", "not doing plan outfits today"
  if ((m = /^(?:drop|remove|cut|scrap|nix|forget(?: about)?|skip|take off)\s+(.+)$/i.exec(t)) || (m = /^(?:not|no longer) (?:doing|going to do)\s+(.+?)(?:\s+today)?$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    if (!item) return null
    return { plan: { ...plan, revisions: plan.revisions + 1, items: plan.items.filter((i) => i.id !== item.id).map((i) => (i.after === item.id ? { ...i, after: undefined } : i)) }, said: `Dropped "${item.title}".` }
  }

  // "plan ny is a must", "shave legs is optional", "must do pack"
  if ((m = /^(.+?)\s+(?:is|are|=)\s+(.+)$/i.exec(t))) {
    const tier = TIER_WORD.find(([re]) => re.test(m![2]!.trim()))?.[1]
    const item = tier ? findItem(plan, m[1]!) : null
    if (tier && item) return { plan: patchItem(plan, item.id, { tier, reasons: [...item.reasons, `You said it is ${TIER_LABEL[tier]}.`] }), said: `"${item.title}" is now ${TIER_LABEL[tier]}.` }
  }

  // "foxtide first", "dye hair before pack", "pack after dinner" (both named)
  if ((m = /^(?:do\s+)?(.+?)\s+first$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    if (!item) return null
    return { plan: { ...plan, revisions: plan.revisions + 1, items: [item, ...plan.items.filter((i) => i.id !== item.id)] }, said: `"${item.title}" is first.` }
  }
  if ((m = /^(?:do\s+)?(.+?)\s+(before|after)\s+(.+)$/i.exec(t))) {
    const a = findItem(plan, m[1]!)
    const b = findItem(plan, m[3]!)
    if (!a || !b || a.id === b.id) return null
    const [first, later] = m[2]!.toLowerCase() === "before" ? [a, b] : [b, a]
    const rest = plan.items.filter((i) => i.id !== later.id).map((i) => (i.id === first.id && i.after === later.id ? { ...i, after: undefined } : i))
    const wasBefore = plan.items.indexOf(later) < plan.items.indexOf(first)
    const at = wasBefore ? rest.findIndex((i) => i.id === first.id) + 1 : plan.items.indexOf(later)
    rest.splice(at, 0, { ...later, after: first.id })
    return { plan: { ...plan, revisions: plan.revisions + 1, items: rest }, said: `"${first.title}" now comes before "${later.title}".` }
  }

  // "why dye hair: photos in NY", "dye hair because …", "if I don't pack: we miss the flight"
  if ((m = /^why\s+(.+?)\s*[:–-]\s*(.+)$/i.exec(t)) || (m = /^(.+?)\s+because\s+(.+)$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    return item ? { plan: patchItem(plan, item.id, { why: m[2]!.trim() }), said: `Why "${item.title}" matters: ${m[2]!.trim()}` } : null
  }
  if ((m = /^if i (?:don'?t|do not|skip)\s+(.+?)\s*[:,–-]\s*(.+)$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    return item ? { plan: patchItem(plan, item.id, { ifNot: m[2]!.trim() }), said: `If "${item.title}" is not done: ${m[2]!.trim()}` } : null
  }
  if ((m = /^(?:resistance(?: to(?:ward)?)?|dreading|dread)\s+(.+?)(?:\s*[:=]?\s*([0-4]))?$/i.exec(t))) {
    const item = findItem(plan, m[1]!)
    if (!item) return null
    const value = m[2] ? Number(m[2]) : 4
    return { plan: patchItem(plan, item.id, { resistance: value }), said: `Resistance toward "${item.title}": ${value}.` }
  }

  // "also call mom", "add call mom to the plan"
  if ((m = /^(?:add|put)\s+(.+?)\s+(?:to|on|in)\s+(?:the|my|today'?s)\s+(?:day\s+)?plan$/i.exec(t)) || (m = /^(?:also|plus|oh and|and also)\s+(.+)$/i.exec(t))) {
    const title = m[1]!.replace(/^(?:i\s+)?(?:have to|need to|gotta|must|should)\s+/i, "").trim()
    if (title.length < 3 || !startsWithVerb(title) || /\b(?:shopping|grocery|inbox|links?)\b/i.test(title) || findItem(plan, title)) return null
    const tier: DayTier = /\bmust\b/i.test(m[1]!) ? "must" : "rest"
    const item = newItem(title, tier, past)
    return { plan: { ...plan, revisions: plan.revisions + 1, items: [...plan.items, item] }, said: `Added "${title}" (${span(item.estimate.minutes)}, ${item.estimate.source === "history" ? "from your history" : "a rough guess"}).` }
  }
  return null
}
