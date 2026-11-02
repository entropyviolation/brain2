/**
 * lib/habit-helper/compute.ts — COMPUTE + PROPOSE: turn the model's pointers into exact cell writes
 *
 * Code does every number. An amount converts to the habit's unit (an hour is 60 min); an amount in a unit
 * the habit does not count ("2 miles" for a minutes habit) sets the goal and says so; no amount sets the
 * goal; "another 10 pages" adds. A miss keeps the reason word for word: the "because" part when there is
 * one, else the whole sentence. A clause the words score two habits the same on becomes an `Ask`. A day
 * still ahead, a miss on a cell already done, or a value already there is skipped with a note.
 */

import { dateKey } from "@/lib/tracking-helper/clock"
import { headOf } from "./match"
import { scoreClause, tiedAtTop } from "./lexicon"
import type { Tagged } from "./tags"
import type { Ask, HabitBrief, HelperContext, MatchItem, Matching, Proposal, Tag } from "./types"
import { displayName } from "./words"

export interface Computed {
  proposals: Proposal[]
  asks: Ask[]
  /** Plain lines about what was skipped and why. */
  notes: string[]
}

const PLURAL: Record<string, string> = { min: "min", hour: "hours", page: "pages", glass: "glasses", step: "steps", rep: "reps", mile: "miles", km: "km", time: "times", chapter: "chapters", word: "words", liter: "liters", oz: "oz" }
const shown = (h: HabitBrief) => ((h.per ?? 1) === 60 ? "hour" : h.unit)
export const unitText = (n: number, unit?: string) => (unit ? `${n} ${n === 1 && unit !== "min" ? unit : PLURAL[unit] ?? `${unit}s`}` : String(n))

export function computeAll(m: Matching, t: Tagged, ctx: HelperContext): Computed {
  const out: Computed = { proposals: [], asks: [], notes: [] }
  const seen = new Set<string>()
  for (const item of m.items) {
    const c = t.clauses.find((x) => x.id === item.clause)
    if (!c) continue
    const options = askOptions(item, headOf(c, t.tags), ctx.habits)
    if (options.length > 1) {
      if (seen.has(`ask:${c.id}`)) continue
      seen.add(`ask:${c.id}`)
      out.asks.push({ id: `a-${c.id}`, words: c.text, options: options.map((id) => ({ id, name: displayName(ctx.habits.find((h) => h.id === id)!) })), item: { ...item, habit: "", maybe: "" } })
      continue
    }
    const r = computeItem(item, t, ctx)
    if (typeof r === "string") {
      out.notes.push(r)
      continue
    }
    // Two clauses on one habit and day: the later one wins.
    out.proposals = out.proposals.filter((p) => !(p.habitId === r.habitId && p.day === r.day))
    out.proposals.push(r)
  }
  return out
}

/** The habits to ask between, or one or none when there is nothing to ask. */
function askOptions(item: MatchItem, head: string, habits: HabitBrief[]): string[] {
  const exists = (id: string) => habits.some((h) => h.id === id)
  if (item.maybe && exists(item.maybe)) return [...new Set([item.habit, item.maybe].filter((id) => id && exists(id)))]
  const tie = tiedAtTop(scoreClause(head, habits))
  return item.habit && tie.includes(item.habit) ? tie : []
}

/** One item as a proposal, or a note saying why it was skipped. */
export function computeItem(item: MatchItem, t: Tagged, ctx: HelperContext): Proposal | string {
  const c = t.clauses.find((x) => x.id === item.clause)
  const h = ctx.habits.find((x) => x.id === item.habit)
  if (!c || !h) return ""
  const tag = (id: string) => t.tags.find((x) => x.id === id && c.tags.includes(id)) ?? t.tags.find((x) => x.id === id)
  const inClause = (kind: Tag["kind"]) => t.tags.find((x) => x.kind === kind && c.tags.includes(x.id))
  const today = dateKey(ctx.now)
  const day = tag(item.day)?.day ?? c.day ?? today
  const name = displayName(h)
  if (day > today) return `${name}: ${day} has not happened yet.`
  const cell = h.days[day]
  const words = c.text
  const id = `p-${h.id}-${day}-${item.kind}`
  const byModel = scoreClause(headOf(c, t.tags), [h]).length ? undefined : "matched by the model; no word of this habit is in the clause"

  if (item.kind === "missed") {
    if (cell?.met) return `${name} is already done on ${day}, so it was not marked missed.`
    const because = tag(item.reason) ?? inClause("because")
    const reason = because?.reason ?? c.sentence
    return { id, kind: "missed", habitId: h.id, habit: name, day, from: cell?.missed ? "missed" : stateText(h, cell), to: "missed", write: { missedOpportunity: true, missReason: reason }, words, why: byModel }
  }

  if (h.kind === "yesno") {
    if (cell?.completed) return `${name} is already on for ${day}.`
    return { id, kind: "set", habitId: h.id, habit: name, day, from: "off", to: "on", write: { completed: true }, words, why: byModel }
  }
  if (h.kind === "text") {
    const text = headOf(c, t.tags).trim()
    return { id, kind: "set", habitId: h.id, habit: name, day, from: cell?.text ? `“${cell.text}”` : "empty", to: `“${text}”`, write: { text }, words, why: byModel }
  }

  const amt = tag(item.amount) ?? inClause("amount")
  const goal = h.goal || 1
  let value = goal
  let why = byModel
  if (amt?.amount !== undefined) {
    const n = convert(amt, h.unit, h.per)
    if (n === null) why = `said ${amt.raw}; ${name} counts ${shown(h) ?? "a number"}, so it is set to the goal`
    else {
      value = amt.adds ? (cell?.value ?? 0) + n : n
      if (amt.unit === "min" && (h.per ?? 1) !== 1) why = `${amt.raw} = ${n} hours`
      else if (amt.unit === "min" && /hour/i.test(amt.raw)) why = `${amt.raw} = ${n} min`
      if (amt.adds) why = `${cell?.value ?? 0} + ${n}`
    }
  } else why = why ?? "no amount said, so it is set to the goal"
  value = Math.round(value * 100) / 100
  if (cell?.value === value) return `${name} already reads ${unitText(value, shown(h))} on ${day}.`
  return { id, kind: "set", habitId: h.id, habit: name, day, from: unitText(cell?.value ?? 0, shown(h)), to: unitText(value, shown(h)), write: { value }, words, why }
}

/** An amount in the habit's unit, or null when the units do not compare. A bare number is taken as the habit's unit. */
export function convert(amt: Tag, unit: string | undefined, per = 1): number | null {
  const n = amt.amount ?? 0
  if (!amt.unit) return n
  if (!unit) return n
  return amt.unit === unit ? n / per : null
}

function stateText(h: HabitBrief, cell: HabitBrief["days"][string] | undefined): string {
  if (!cell) return "blank"
  if (h.kind === "goal") return unitText(cell.value ?? 0, shown(h))
  if (h.kind === "text") return cell.text ? `“${cell.text}”` : "blank"
  return cell.completed ? "on" : "off"
}

/** A card edited by hand: the new value, reason or name typed into it. Code re-derives the write. */
export function editProposal(p: Proposal, raw: string): Proposal {
  const text = raw
  if (p.kind === "shorthand") return { ...p, to: text.trim(), shorthand: text.trim() }
  if (p.kind === "missed" || p.kind === "reason") return { ...p, ...(p.kind === "reason" ? { to: `“${text}”` } : {}), write: { ...p.write, missedOpportunity: true, missReason: text } }
  if (p.write?.text !== undefined) return { ...p, to: `“${text}”`, write: { text } }
  const n = Number(text.replace(/[^\d.]/g, ""))
  if (!Number.isFinite(n) || text.trim() === "") return p
  const unit = p.to.replace(/^[\d.]+\s*/, "")
  return { ...p, to: unit ? `${n} ${unit}` : String(n), write: { value: n }, why: "typed by you" }
}
