/**
 * lib/plan-bimby/links.ts — What a plan item is also (pure, code only)
 *
 * `detectIntake`: "make more coffee" is a coffee intake. `detectFlight`: "book NY flights" waits for a
 * confirmation. `matchTasks`: "finish cds" is probably the existing task "Finish CDs". Matches are offered,
 * never forced: a task link starts unconfirmed.
 */

import type { IntakeClass } from "@/lib/time-entries"
import type { Task } from "@/lib/types"
import type { PlanItem, PlanLink } from "./types"

const DRINKS = "coffee espresso latte tea matcha water soda energy drink coke red bull monster kombucha juice".split(" ")
const DRUGS = "adderall vyvanse ritalin ibuprofen advil tylenol melatonin creatine magnesium vitamin vitamins zyrtec claritin caffeine pill pills supplement supplements".split(" ")
const FOODS = "breakfast lunch dinner snack eggs toast sandwich salad".split(" ")
/** Words that mean the person is putting it in their body, not just near it. */
const TAKES = /\b(make|brew|pour|drink|have|get|grab|take|taking|eat|down|pop|refill|another|more)\b/i

const KINDS: [IntakeClass, string[]][] = [
  ["drink", DRINKS],
  ["drug", DRUGS],
  ["food", FOODS],
]

/** "make more coffee" → coffee. "take another adderall" → adderall. Null when nothing is taken in. */
export function detectIntake(title: string): Extract<PlanLink, { kind: "intake" }> | null {
  const lower = title.toLowerCase()
  if (!TAKES.test(lower)) return null
  for (const [intakeClass, words] of KINDS) {
    const hit = words
      .filter((w) => new RegExp(`\\b${w}\\b`).test(lower))
      .sort((a, b) => b.length - a.length)[0]
    if (hit) return { kind: "intake", label: hit, intakeClass }
  }
  return null
}

/** "book ny flights" → a flight is coming. Needs the verb, so "flight attendant notes" is left alone. */
export function detectFlight(title: string): boolean {
  const lower = title.toLowerCase()
  return /\bflights?\b/.test(lower) && /\b(book|booking|buy|reserve|confirm|get)\b/.test(lower)
}

const STOP = new Set(
  "a an the my our some more another new old for to of on in at with and then up out finish finishing finished complete work working do doing start make get fully all and by before after".split(" "),
)

function stem(word: string): string {
  return word.length > 3 ? word.replace(/(ing|ed|es|s)$/, "") : word
}

/** The words that name the work, with filler and plurals removed. */
export function nameWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem)
}

export interface TaskMatch {
  taskId: string
  title: string
  score: number
}

/**
 * Open tasks whose name shares the plan item's name words. Score is the share of the item's words found in
 * the task title (so "finish cds" matches "Finish CDs for the release"), halved if the task is already done.
 */
export function matchTasks(item: Pick<PlanItem, "title">, tasks: readonly Task[], limit = 4): TaskMatch[] {
  const words = nameWords(item.title)
  if (!words.length) return []
  const out: TaskMatch[] = []
  for (const task of tasks) {
    if (task.loggedAction) continue
    const title = (task.title || task.description || "").trim()
    if (!title) continue
    const have = new Set(nameWords(title))
    const hits = words.filter((w) => have.has(w)).length
    if (!hits) continue
    // Penalize long titles slightly so the closer name wins a tie.
    const score = (hits / words.length) * (task.completed ? 0.5 : 1) - Math.min(0.2, Math.max(0, have.size - words.length) * 0.02)
    if (score >= 0.6) out.push({ taskId: task.id, title, score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Fill in `link` on each item that has none: intake, then flight, then the best task match (unconfirmed). */
export function withLinks(items: PlanItem[], tasks: readonly Task[]): PlanItem[] {
  return items.map((item) => {
    if (item.link) return item
    const intake = detectIntake(item.title)
    if (intake) return { ...item, link: intake }
    if (detectFlight(item.title)) return { ...item, link: { kind: "flight" } }
    const best = matchTasks(item, tasks, 1)[0]
    if (best) return { ...item, link: { kind: "task", taskId: best.taskId, title: best.title, confirmed: false } }
    return item
  })
}
