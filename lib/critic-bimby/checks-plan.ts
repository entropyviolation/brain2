/**
 * lib/critic-bimby/checks-plan.ts — The free, certain checks on a Plan BIMBY draft (pure, no model)
 *
 * Each check holds the plan up to the person's own sentence. A `certain` finding means the sentence contradicts the
 * plan (a number or a deadline the person never said). A `hint` means probably wrong and worth a look. The rules
 * parser is a second, independent reader of the same line, so a clause it finds that no row touches is a hint.
 */

import { detectFlight, nameWords } from "@/lib/plan-bimby/links"
import { parseByRules } from "@/lib/plan-bimby/parse"
import type { PlanDraft, PlanItem } from "@/lib/plan-bimby/types"
import type { Finding } from "./types"

type Draft = Pick<PlanDraft, "items" | "remarks" | "source">

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, quarter: 15, half: 30,
}

/** The same split `parseByRules` uses, kept as parts of the original sentence so a quote is really in it. */
const LEAD = /^\s*(?:plan|plans|today|rn|right now)(?:\s+for\s+[^-–—:,]*)?\s*[-–—:]\s*/i
const SPLIT = /\n|;|,(?![^()]*\))|\bthen\b|\band then\b/i

export function clausesOf(source: string): string[] {
  return source.replace(LEAD, "").split(SPLIT).map((p) => p.trim()).filter(Boolean)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()

/** Share a stem when they are equal or one starts with the other (at least four letters). */
const sameStem = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))

function numbersIn(source: string): Set<number> {
  const out = new Set<number>()
  for (const m of source.toLowerCase().matchAll(/\d+(?:\.\d+)?/g)) out.add(Number(m[0]))
  for (const w of source.toLowerCase().split(/[^a-z]+/)) if (w in WORD_NUMBERS) out.add(WORD_NUMBERS[w]!)
  return out
}

/** Could the person have said this many minutes, in digits, words, hours, or "an hour"? */
export function minutesSaid(source: string, minutes: number): boolean {
  const nums = numbersIn(source)
  const lower = source.toLowerCase()
  if (nums.has(minutes)) return true
  if (minutes % 60 === 0 && nums.has(minutes / 60)) return true
  if (nums.has(minutes / 60)) return true
  if (minutes === 60 && /\b(an|one|1)\s*(hour|hr)\b/.test(lower)) return true
  if (minutes === 30 && /\bhalf\s+(an\s+)?(hour|hr)\b/.test(lower)) return true
  if (minutes === 15 && /\bquarter\s+(of\s+an\s+)?(hour|hr)\b/.test(lower)) return true
  if (minutes === 90 && /\bhour\s+and\s+a\s+half\b/.test(lower)) return true
  return false
}

/** Every token of a phrase appears in the sentence, so a trimmed or reordered quote still counts. */
function phraseSaid(source: string, phrase: string): boolean {
  const have = new Set(norm(source).split(" "))
  const tokens = norm(phrase).split(" ").filter(Boolean)
  return tokens.every((t) => have.has(t))
}

const f = (kind: Finding["kind"], where: string, reason: string, strength: Finding["strength"], quote?: string): Finding => ({
  kind,
  where,
  reason: reason.slice(0, 140),
  by: "code",
  strength,
  ...(quote ? { quote } : {}),
})

function bagOf(draft: Draft): string[] {
  const parts: string[] = []
  for (const i of draft.items) {
    parts.push(i.title, i.paceNote ?? "")
    for (const s of i.subtasks) parts.push(s.title, s.due ?? "")
    if (i.link) parts.push(i.link.kind === "task" ? i.link.title : i.link.kind === "intake" ? i.link.label : "flight")
  }
  parts.push(...draft.remarks)
  return nameWords(parts.join(" "))
}

/** Position of the earliest source word a row's name shares, or null. */
function firstMention(item: PlanItem, sourceWords: string[]): number | null {
  const mine = nameWords(item.title)
  for (let at = 0; at < sourceWords.length; at++) if (mine.some((w) => sameStem(w, sourceWords[at]!))) return at
  return null
}

export function planChecks(draft: Draft): Finding[] {
  const out: Finding[] = []
  const source = draft.source
  if (!source.trim()) return out

  if (!draft.items.length && parseByRules(source).items.length) {
    out.push(f("dropped", "plan", "The plan has no tasks, but the sentence has some.", "certain", source.slice(0, 80)))
    return out
  }

  const sourceWords = nameWords(source)
  const rowWords = (i: PlanItem) => nameWords(i.title)

  for (const item of draft.items) {
    if (item.minutes && item.minutes > 0 && !minutesSaid(source, item.minutes)) {
      out.push(f("invented", item.id, `“${item.title}” has ${item.minutes} min, a length you did not say.`, "certain"))
    }
    if (item.paceNote && !phraseSaid(source, item.paceNote)) {
      out.push(f("invented", item.id, `“${item.title}” has a pace note that is not in your words.`, "certain"))
    }
    for (const s of item.subtasks) {
      if (s.due && !phraseSaid(source, s.due)) out.push(f("invented", item.id, `A deadline on “${item.title}” (“${s.due}”) is not in your words.`, "certain"))
    }
    const mine = rowWords(item)
    if (mine.length && !mine.some((w) => sourceWords.some((sw) => sameStem(w, sw)))) {
      out.push(f("invented", item.id, `Nothing in what you said matches “${item.title}”.`, "hint"))
    }
    const link = item.link
    if (link?.kind === "intake" && !new RegExp(`\\b${link.label}\\b`, "i").test(source)) {
      out.push(f("wrong-link", item.id, `“${item.title}” logs ${link.label}, but you never said ${link.label}.`, "certain"))
    }
    if (link?.kind === "flight" && !detectFlight(item.title) && !/\bflights?\b/i.test(source)) {
      out.push(f("wrong-link", item.id, `“${item.title}” waits for a flight confirmation, but you did not mention a flight.`, "certain"))
    }
    if (link?.kind === "task" && !link.confirmed && mine.length) {
      const have = new Set(nameWords(link.title))
      const share = mine.filter((w) => have.has(w)).length / mine.length
      if (share < 0.67) out.push(f("wrong-link", item.id, `“${item.title}” may not be your task “${link.title}”.`, "hint"))
    }
  }

  const bag = bagOf(draft)
  for (const clause of clausesOf(source)) {
    const words = nameWords(clause.replace(/\([^)]*\)/g, " "))
    if (!words.length) continue
    if (!words.some((w) => bag.some((b) => sameStem(w, b)))) {
      out.push(f("dropped", "plan", `“${clause.slice(0, 60)}” is in your sentence but in no task.`, "hint", clause))
    }
  }

  let last = -1
  for (const item of draft.items) {
    const at = firstMention(item, sourceWords)
    if (at === null) continue
    if (at < last) {
      out.push(f("misordered", item.id, `“${item.title}” comes after tasks you said later.`, "hint"))
      break
    }
    last = at
  }
  return out
}
