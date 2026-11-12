/**
 * lib/follow-through/ask.ts — Only the gaps, one tap each, at natural moments
 *
 * Pure. `nextQuestion` picks one gap in the ledger and returns it as tap choices; `readAnswer`
 * reads the line a tap sends back. In order: a displacement with no reason ("what pulled you
 * away?"), a step that keeps coming back undone ("what's in the way?"), a block that just ended
 * with no feeling ("how was that?"), then a fresh plan step with no pull or push stated.
 * Every question has Skip, and a skipped gap is never asked again.
 */
import { clock } from "./link"
import { AFTER_WORDS, LEVEL_WORDS, type Action, type Ledger, type Scale, type Step } from "./types"

export interface Choice {
  label: string
  text: string
}

export interface Question {
  kind: "away" | "blocker" | "after" | "pull" | "push"
  text: string
  choices: Choice[]
}

/** A step said this many times without being done earns "what's in the way?". */
export const REPEATS_TO_ASK = 2
/** "How was that?" is asked only about a block that ended this recently. */
export const AFTER_WINDOW_MIN = 180

const AWAY = ["phone", "tired", "did not want to", "something came up", "forgot"]
const BLOCKERS = ["dread", "boring", "too big", "unclear first step", "needs someone else", "no time"]

const levels = (verb: string, what: string): Choice[] => LEVEL_WORDS.map((w, i) => ({ label: `${i} ${w}`, text: `${verb} ${i}: ${what}` }))
const skip = (what: string): Choice => ({ label: "Skip", text: `skip: ${what}` })

const hasBefore = (l: Ledger, s: Step, key: "excitement" | "resistance") => l.feelings.some((f) => f.phase === "before" && f.stepId === s.id && f.standing !== "rejected" && f[key] !== undefined)
const hasAfter = (l: Ledger, a: Action) => l.feelings.some((f) => f.phase === "after" && f.actionId === a.id && f.standing !== "rejected" && f.satisfaction !== undefined)

export function nextQuestion(l: Ledger, now: Date): Question | null {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const steps = l.intentions.flatMap((i) => i.steps.map((s) => ({ s, i })))

  const away = steps.find(({ s, i }) => i.day === today && s.verdict === "displaced" && s.standing !== "rejected" && !s.awayReason && !s.asked.includes("away"))
  if (away) return { kind: "away", text: `What pulled you away from "${away.s.what}"?`, choices: [...AWAY.map((r) => ({ label: r, text: `away: ${r} | ${away.s.what}` })), skip(away.s.what)] }

  const stuck = [...steps].reverse().find(({ s, i }) => i.day === today && s.verdict === "open" && s.repeats.length >= REPEATS_TO_ASK && !s.blocker && !s.asked.includes("blocker"))
  if (stuck) return { kind: "blocker", text: `"${stuck.s.what}" has come up ${stuck.s.repeats.length + 1} times undone. What's in the way?`, choices: [...BLOCKERS.map((r) => ({ label: r, text: `in the way: ${r} | ${stuck.s.what}` })), skip(stuck.s.what)] }

  const ended = [...l.actions].reverse().find((a) => {
    if (a.day !== today || a.kind !== "activity" || !a.end || a.asked.includes("after") || hasAfter(l, a)) return false
    const ago = (now.getTime() - new Date(a.end).getTime()) / 60_000
    return ago >= 0 && ago <= AFTER_WINDOW_MIN
  })
  if (ended) return { kind: "after", text: `How was ${ended.what} (${clock(ended.at)}–${clock(ended.end!)})?`, choices: [...AFTER_WORDS.map((w, i) => ({ label: w, text: `after ${i}: ${ended.what}` })), skip(ended.what)] }

  // Only the newest plan of today is asked about, and only steps still ahead.
  const plan = [...l.intentions].reverse().find((i) => i.day === today && i.steps.some((s) => s.verdict === "open"))
  for (const s of plan?.steps ?? []) {
    if (s.verdict !== "open") continue
    if (!hasBefore(l, s, "excitement") && !s.asked.includes("pull")) return { kind: "pull", text: `"${s.what}": how much do you want to?`, choices: [...levels("pull", s.what), skip(s.what), { label: "Skip the rest", text: "skip all" }] }
    if (!hasBefore(l, s, "resistance") && !s.asked.includes("push")) return { kind: "push", text: `"${s.what}": how much resistance?`, choices: [...levels("push", s.what), skip(s.what), { label: "Skip the rest", text: "skip all" }] }
  }
  return null
}

export type Answer =
  | { kind: "pull" | "push"; value: Scale; what: string }
  | { kind: "after"; value: Scale; what: string }
  | { kind: "away" | "blocker"; reason: string; what: string }
  | { kind: "skip"; what: string }
  | { kind: "skip-all" }

/** The line a tap sends. Typed by hand works too: `push 3: call shelby`. */
export function readAnswer(text: string): Answer | null {
  const t = text.trim()
  if (/^skip all$/i.test(t)) return { kind: "skip-all" }
  const level = /^(pull|push|after)\s+([0-4]):\s*(.+)$/i.exec(t)
  if (level) return { kind: level[1]!.toLowerCase() as "pull" | "push" | "after", value: Number(level[2]) as Scale, what: level[3]!.trim() }
  const why = /^(away|in the way):\s*([^|]+?)\s*\|\s*(.+)$/i.exec(t)
  if (why) return { kind: why[1]!.toLowerCase() === "away" ? "away" : "blocker", reason: why[2]!.trim(), what: why[3]!.trim() }
  const sk = /^skip:\s*(.+)$/i.exec(t)
  if (sk) return { kind: "skip", what: sk[1]!.trim() }
  return null
}
