/**
 * lib/follow-through/link.ts — Keep the links between the four records honest
 *
 * Pure. `merge` adds a reading to the ledger (same text read twice lands on the same records).
 * `proposeLinks` matches later actions to earlier steps and gives each step a verdict:
 * done as planned, done late, displaced, dropped, or still open. An action no step predicted is
 * unplanned. A feeling said about an action ("because I woke up early") is tied to that action.
 * Every link here is `proposed`: the person confirms it on the card. A confirmed or rejected link
 * is never changed by a later proposal.
 */
import { contentWords, overlap, type Displacement, type Reading } from "./read"
import type { Action, Feeling, Ledger, Step, Verdict } from "./types"

/** A step is "late" when it starts more than this many minutes after the plan, per place in the order. */
export const LATE_AFTER_MIN = 60
/** A step still open this many days after its plan is proposed as dropped. */
export const DROP_AFTER_DAYS = 2
/** A stream is typed a little out of order: an action up to this long before the plan line still answers it. */
export const GRACE_MIN = 15

const byAt = <T extends { at: string }>(a: T, b: T) => a.at.localeCompare(b.at)

export function merge(ledger: Ledger, r: Pick<Reading, "intentions" | "actions" | "feelings">): Ledger {
  const intentions = [...ledger.intentions]
  for (const i of r.intentions) if (!intentions.some((x) => x.id === i.id)) intentions.push(i)
  const actions = [...ledger.actions]
  for (const a of r.actions) if (!actions.some((x) => x.id === a.id || sameAction(x, a))) actions.push(a)
  const feelings = [...ledger.feelings]
  for (const f of r.feelings) if (!feelings.some((x) => x.id === f.id)) feelings.push(f)
  return { intentions: intentions.sort(byAt), actions: actions.sort(byAt), feelings: feelings.sort(byAt) }
}

/** The same thing said in a stream and later seen in Tracking: within 3 minutes and sharing a word. */
export function sameAction(a: Action, b: Action): boolean {
  if (a.day !== b.day) return false
  if (Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) > 3 * 60_000) return false
  return overlap(a.what, b.what) > 0 || overlap(b.what, a.what) > 0 || a.what.toLowerCase() === b.what.toLowerCase()
}

const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)

export interface LinkChange {
  stepId: string
  verdict: Verdict
  actionId?: string
  delayMin?: number
  displacedBy?: string
  /** One sentence for the card. */
  why: string
}

/** How well an action answers a step: the share of the step's words the action carries. */
export function matchScore(step: Step, action: Action): number {
  return Math.max(overlap(step.what, action.what), overlap(step.what, action.said) * 0.9)
}

/**
 * Propose a verdict for every step not yet confirmed or rejected. Earlier steps choose first, and an
 * action fulfils one step only. Returns the ledger with the proposals written in, and what changed.
 */
export function proposeLinks(ledger: Ledger, now: Date, displacements: Displacement[] = []): { ledger: Ledger; changes: LinkChange[] } {
  const changes: LinkChange[] = []
  const taken = new Set(ledger.intentions.flatMap((i) => i.steps).filter((s) => s.standing === "confirmed" && s.actionId).map((s) => s.actionId!))
  const actionStep = new Map<string, string>()

  const intentions = ledger.intentions.map((intention) => {
    const steps = intention.steps.map((step) => {
      if (step.standing !== "proposed") return step
      const from = new Date(new Date(intention.at).getTime() - GRACE_MIN * 60_000).toISOString()
      const after = ledger.actions.filter((a) => a.at >= from && !taken.has(a.id) && !step.refused?.includes(a.id))
      let best: Action | null = null
      let score = 0
      for (const a of after) {
        const s = matchScore(step, a)
        if (s > score) [best, score] = [a, s]
      }
      if (best && score >= 0.5) {
        taken.add(best.id)
        actionStep.set(best.id, step.id)
        const delayMin = Math.max(0, minutesBetween(intention.at, best.at))
        const late = delayMin > LATE_AFTER_MIN * (step.order + 1) || best.day !== intention.day
        const verdict: Verdict = late ? "late" : "done"
        const next = { ...step, verdict, actionId: best.id, delayMin }
        if (step.verdict !== verdict || step.actionId !== best.id) changes.push({ stepId: step.id, verdict, actionId: best.id, delayMin, why: `"${best.what}" at ${clock(best.at)} matches "${step.what}", ${span(delayMin)} after the plan.` })
        return next
      }
      // Said outright: "Didn't; ended up scrolling". The piece names what it missed, or it is the next open step.
      const moved = displacements.find((d) => d.at >= intention.at && (d.missed ? overlap(step.what, d.missed) >= 0.5 || overlap(d.missed, step.what) >= 0.5 : false))
      if (moved) {
        if (step.verdict !== "displaced") changes.push({ stepId: step.id, verdict: "displaced", displacedBy: moved.by, why: `You said "${moved.said}".` })
        return { ...step, verdict: "displaced" as Verdict, displacedBy: moved.by }
      }
      const ageDays = Math.floor((now.getTime() - new Date(intention.at).getTime()) / 86_400_000)
      if (step.verdict === "open" && ageDays >= DROP_AFTER_DAYS) {
        changes.push({ stepId: step.id, verdict: "dropped", why: `Planned ${ageDays} days ago and nothing since matches it.` })
        return { ...step, verdict: "dropped" as Verdict }
      }
      return step
    })
    return { ...intention, steps }
  })

  // A displacement that names nothing takes the first step still open from the newest plan before it.
  let linkedIntentions = intentions
  for (const d of displacements.filter((x) => !x.missed)) {
    const plan = [...linkedIntentions].reverse().find((i) => i.at <= d.at && i.steps.some((s) => s.verdict === "open" && s.standing === "proposed"))
    const step = plan?.steps.find((s) => s.verdict === "open" && s.standing === "proposed")
    if (!plan || !step) continue
    linkedIntentions = linkedIntentions.map((i) => (i.id !== plan.id ? i : { ...i, steps: i.steps.map((s) => (s.id === step.id ? { ...s, verdict: "displaced" as Verdict, displacedBy: d.by } : s)) }))
    changes.push({ stepId: step.id, verdict: "displaced", displacedBy: d.by, why: `You said "${d.said}" after planning "${step.what}".` })
  }

  const actions = ledger.actions.map((a) => (actionStep.has(a.id) ? { ...a, stepId: actionStep.get(a.id) } : a))
  const linked: Ledger = { intentions: withRepeats(linkedIntentions), actions, feelings: tieFeelings(ledger.feelings, actions, linkedIntentions.flatMap((i) => i.steps)) }
  return { ledger: linked, changes }
}

/** A step said again after going undone points back at its earlier selves. */
function withRepeats(intentions: Ledger["intentions"]): Ledger["intentions"] {
  const seen: Step[] = []
  return intentions.map((i) => ({
    ...i,
    steps: i.steps.map((s) => {
      const earlier = seen.filter((p) => p.intentionId !== s.intentionId && p.verdict !== "done" && p.verdict !== "late" && overlap(s.what, p.what) >= 0.6 && overlap(p.what, s.what) >= 0.6).map((p) => p.id)
      seen.push(s)
      return earlier.length === s.repeats.length ? s : { ...s, repeats: earlier }
    }),
  }))
}

/** Tie an after-feeling to the action its words name, and a before-feeling to its step's action once there is one. */
function tieFeelings(feelings: Feeling[], actions: Action[], steps: Step[]): Feeling[] {
  return feelings.map((f) => {
    if (f.phase !== "after" || f.actionId || !f.aboutWords) return f
    let best: Action | null = null
    let score = 0
    for (const a of actions.filter((x) => x.day === f.day && x.at <= f.at)) {
      const s = Math.max(overlap(a.what, f.aboutWords), overlap(f.aboutWords, a.what))
      if (s > score) [best, score] = [a, s]
    }
    if (best && score >= 0.5) return { ...f, actionId: best.id, ...(best.stepId ? { stepId: best.stepId } : {}) }
    const step = steps.find((s) => overlap(s.what, f.aboutWords!) >= 0.6)
    return step?.actionId ? { ...f, actionId: step.actionId, stepId: step.id } : f
  })
}

/** Actions after the day's first plan that no step predicted. Counts and drinks are left out: nobody plans a sip. */
export function unplanned(ledger: Ledger, day: string): Action[] {
  const first = ledger.intentions.find((i) => i.day === day)
  if (!first) return []
  // Only what came after the day's first plan: nothing before it could have been predicted.
  return ledger.actions.filter((a) => a.day === day && a.at >= first.at && !a.stepId && (a.kind === "activity" || a.kind === "food" || a.kind === "other"))
}

export const clock = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function span(min: number): string {
  const m = Math.abs(min)
  if (m < 60) return `${m} min`
  const h = m / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

/** Whether two steps are the same thing said twice. */
export const sameStep = (a: string, b: string): boolean => {
  const wa = contentWords(a)
  return wa.length > 0 && overlap(a, b) >= 0.6 && overlap(b, a) >= 0.6
}
