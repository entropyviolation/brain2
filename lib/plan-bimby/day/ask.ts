/**
 * lib/plan-bimby/day/ask.ts — The reasons behind a day plan, asked one at a time (pure)
 *
 * For each must, then each important thing: why it matters today, how much resistance there is, what is in
 * the way when resistance is high, and (musts only) what happens if it is not done. One question per reply,
 * each with Skip, and "stop asking" ends it. The answer is the person's own words, put on the item.
 */

import type { AskKey, DayItem, DayPlan } from "./types"

export interface DayQuestion {
  itemId: string
  key: AskKey
  text: string
  choices: { label: string; text: string }[]
}

const LEVELS = ["none", "low", "medium", "high", "very high"]
const SKIP = { label: "skip", text: "skip" }
const QUIET = { label: "stop asking", text: "stop asking" }

function keysFor(item: DayItem): AskKey[] {
  const keys: AskKey[] = []
  if (!item.why.trim()) keys.push("why")
  if (item.resistance === undefined) keys.push("resistance")
  if ((item.resistance ?? 0) >= 3 && !item.blocker.trim()) keys.push("blocker")
  if (item.tier === "must" && !item.ifNot.trim()) keys.push("ifNot")
  return keys
}

export function nextAsk(plan: DayPlan): DayQuestion | null {
  if (plan.quiet || plan.rejected) return null
  const weighed = [...plan.items.filter((i) => i.tier === "must"), ...plan.items.filter((i) => i.tier === "important")].filter((i) => !i.doneAt)
  for (const item of weighed) {
    for (const key of keysFor(item)) {
      if (plan.asked.includes(`${item.id}:${key}`)) continue
      const t = `"${item.title}"`
      if (key === "why") {
        const guess = item.guess?.why?.trim()
        return { itemId: item.id, key, text: `Why does ${t} matter today?${guess ? ` My guess: ${guess}` : ""}`, choices: [...(guess ? [{ label: "use the guess", text: guess }] : []), SKIP, QUIET] }
      }
      if (key === "resistance") return { itemId: item.id, key, text: `How much resistance do you feel toward ${t}?`, choices: [...LEVELS.map((l, n) => ({ label: `${n} ${l}`, text: `resistance ${n}` })), SKIP] }
      if (key === "blocker") return { itemId: item.id, key, text: `What is in the way of ${t}?`, choices: [SKIP, QUIET] }
      const guess = item.guess?.ifNot?.trim()
      return { itemId: item.id, key, text: `What happens if ${t} does not get done today?${guess ? ` My guess: ${guess}` : ""}`, choices: [...(guess ? [{ label: "use the guess", text: guess }] : []), SKIP, QUIET] }
    }
  }
  return null
}

export interface DayAnswer {
  plan: DayPlan
  /** What BIM says it noted. Empty for a skip. */
  noted: string
}

/** The line that answers the open question. Null when it is a new question or nothing is open. */
export function readDayAnswer(plan: DayPlan, text: string): DayAnswer | null {
  const asking = plan.asking
  if (!asking) return null
  const item = plan.items.find((i) => i.id === asking.itemId)
  const t = text.trim()
  const closed: DayPlan = { ...plan, asking: undefined, asked: [...plan.asked, `${asking.itemId}:${asking.key}`] }
  if (!item) return { plan: closed, noted: "" }
  if (/^(?:stop asking|skip all|no more questions|enough)$/i.test(t)) return { plan: { ...closed, quiet: true }, noted: "Okay, no more questions. The reasons stay editable on the card." }
  if (/^(?:skip|pass|idk|i don'?t know|not sure|next)$/i.test(t)) return { plan: closed, noted: "" }
  if (/\?\s*$/.test(t)) return null
  const set = (patch: Partial<DayItem>): DayPlan => ({ ...closed, items: closed.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) })
  if (asking.key === "resistance") {
    const digit = /\b([0-4])\b/.exec(t)
    const word = LEVELS.findIndex((l) => new RegExp(`^${l}$`, "i").test(t))
    const value = digit ? Number(digit[1]) : word >= 0 ? word : /\bdread|hate|ugh\b/i.test(t) ? 4 : -1
    if (value < 0) return null
    return { plan: set({ resistance: value }), noted: `Resistance toward "${item.title}": ${value} (${LEVELS[value]}).` }
  }
  if (t.length < 2) return null
  if (asking.key === "why") return { plan: set({ why: t }), noted: `Why "${item.title}" matters: ${t}` }
  if (asking.key === "blocker") return { plan: set({ blocker: t }), noted: `In the way of "${item.title}": ${t}` }
  return { plan: set({ ifNot: t }), noted: `If "${item.title}" is not done: ${t}` }
}
