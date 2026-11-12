/**
 * lib/follow-through/learn.ts — What the linked records say, counted from the person's own data
 *
 * Pure. Only confirmed links and feelings are counted (a tap or an Accept stands behind each one).
 * Every finding names how many cases it rests on and the days they fell on, and says "not enough
 * yet" below its minimum. Nothing here is a model's opinion: code counts, and the sentence is built
 * from the count.
 */
import { clock, span, unplanned } from "./link"
import { contentWords } from "./read"
import { allSteps, VERDICT_LABEL, type Action, type Feeling, type Intention, type Ledger, type Step } from "./types"

/** Fewer cases than this and a finding is not stated. */
export const MIN_CASES = 3

export interface Finding {
  id: string
  title: string
  /** The sentence, built from counts. */
  text: string
  n: number
  days: string[]
  /** False when there are too few cases; the text then says what is missing. */
  ready: boolean
}

const counted = (s: Step) => s.standing === "confirmed"
const stood = (f: Feeling) => f.standing === "confirmed"
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}
const pct = (x: number) => `${Math.round(x * 100)}%`
const uniq = (xs: string[]) => [...new Set(xs)].sort()
const need = (id: string, title: string, n: number, what: string): Finding => ({ id, title, text: `Not enough yet: ${n} of ${MIN_CASES} ${what}.`, n, days: [], ready: false })

interface Pair {
  step: Step
  day: string
  before: Feeling
  after: Feeling
}

/** Steps with a feeling before and a feeling after the action that fulfilled them. */
function pairs(l: Ledger): Pair[] {
  const out: Pair[] = []
  for (const i of l.intentions)
    for (const step of i.steps) {
      if (!step.actionId) continue
      const before = l.feelings.find((f) => f.phase === "before" && f.stepId === step.id && stood(f))
      const after = l.feelings.find((f) => f.phase === "after" && f.actionId === step.actionId && stood(f) && f.satisfaction !== undefined)
      if (before && after) out.push({ step, day: i.day, before, after })
    }
  return out
}

/** Did things you dreaded turn out fine? Did things you were excited about disappoint? */
export function predictionError(l: Ledger): Finding[] {
  const all = pairs(l)
  const dreaded = all.filter((p) => (p.before.resistance ?? 0) >= 3)
  const excited = all.filter((p) => (p.before.excitement ?? 0) >= 3)
  const out: Finding[] = []
  if (dreaded.length < MIN_CASES) out.push(need("dread", "Dreaded, then done", dreaded.length, "dreaded steps with a feeling before and after"))
  else {
    const fine = dreaded.filter((p) => p.after.satisfaction! >= 2).length
    out.push({ id: "dread", title: "Dreaded, then done", text: `Of ${dreaded.length} things you resisted strongly and then did, ${fine} sat fine or better afterwards (${pct(fine / dreaded.length)}).`, n: dreaded.length, days: uniq(dreaded.map((p) => p.day)), ready: true })
  }
  if (excited.length < MIN_CASES) out.push(need("excite", "Excited, then done", excited.length, "exciting steps with a feeling before and after"))
  else {
    const flat = excited.filter((p) => p.after.satisfaction! <= 1).length
    out.push({ id: "excite", title: "Excited, then done", text: `Of ${excited.length} things you were excited about and then did, ${flat} disappointed (${pct(flat / excited.length)}).`, n: excited.length, days: uniq(excited.map((p) => p.day)), ready: true })
  }
  return out
}

/** How long each level of resistance delays a step, and how often it gets done anyway. */
export function resistanceCost(l: Ledger): Finding {
  const rows: { level: number; done: boolean; delay?: number; day: string }[] = []
  for (const i of l.intentions)
    for (const s of i.steps) {
      if (!counted(s) || s.verdict === "open") continue
      const before = l.feelings.find((f) => f.phase === "before" && f.stepId === s.id && stood(f) && f.resistance !== undefined)
      if (!before) continue
      rows.push({ level: before.resistance!, done: s.verdict === "done" || s.verdict === "late", ...(s.delayMin !== undefined ? { delay: s.delayMin } : {}), day: i.day })
    }
  if (rows.length < MIN_CASES) return need("cost", "What resistance costs", rows.length, "closed steps with a resistance mark")
  const groups: [string, (n: number) => boolean][] = [["low (0–1)", (n) => n <= 1], ["medium (2)", (n) => n === 2], ["high (3–4)", (n) => n >= 3]]
  const parts = groups.flatMap(([name, test]) => {
    const g = rows.filter((r) => test(r.level))
    if (!g.length) return []
    const delays = g.filter((r) => r.done && r.delay !== undefined).map((r) => r.delay!)
    return [`${name}: ${g.filter((r) => r.done).length} of ${g.length} done${delays.length ? `, median wait ${span(median(delays))}` : ""}`]
  })
  return { id: "cost", title: "What resistance costs", text: `By resistance before the step. ${parts.join("; ")}.`, n: rows.length, days: uniq(rows.map((r) => r.day)), ready: true }
}

const stem = (s: string) => contentWords(s).slice(0, 2).join(" ") || s.toLowerCase().slice(0, 24)

/** What displaces what: "scrolling" took the place of "tidy" 3 times. */
export function displaces(l: Ledger): Finding {
  const tally = new Map<string, { n: number; days: string[] }>()
  for (const i of l.intentions)
    for (const s of i.steps) {
      if (!counted(s) || s.verdict !== "displaced" || !s.displacedBy) continue
      const key = `${stem(s.displacedBy)} → ${stem(s.what)}`
      const t = tally.get(key) ?? { n: 0, days: [] }
      tally.set(key, { n: t.n + 1, days: [...t.days, i.day] })
    }
  const n = [...tally.values()].reduce((a, t) => a + t.n, 0)
  if (n < MIN_CASES) return need("displaces", "What displaces what", n, "confirmed displacements")
  const top = [...tally].sort((a, b) => b[1].n - a[1].n).slice(0, 5)
  return { id: "displaces", title: "What displaces what", text: top.map(([k, t]) => `${k} (${t.n})`).join("; ") + ".", n, days: uniq(top.flatMap(([, t]) => t.days)), ready: true }
}

const closed = (i: Intention) => i.steps.length > 0 && i.steps.every((s) => counted(s) && s.verdict !== "open")
const doneShare = (i: Intention) => i.steps.filter((s) => s.verdict === "done" || s.verdict === "late").length / i.steps.length

/** What share of a plan you typically finish. Plans said before noon are also given on their own. */
export function planRealism(l: Ledger): Finding & { share?: number } {
  const plans = l.intentions.filter((i) => i.steps.length >= 2 && closed(i))
  if (plans.length < MIN_CASES) return need("realism", "Plan realism", plans.length, "closed plans of two or more steps")
  const share = mean(plans.map(doneShare))
  const morning = plans.filter((i) => new Date(i.at).getHours() < 12)
  const extra = morning.length >= MIN_CASES ? ` Morning plans: ${pct(mean(morning.map(doneShare)))} (${morning.length}).` : ""
  return { id: "realism", title: "Plan realism", text: `You finish ${pct(share)} of the steps in a plan, over ${plans.length} plans.${extra}`, n: plans.length, days: uniq(plans.map((i) => i.day)), ready: true, share }
}

/** A day's follow-through: the share of its closed steps that were done. Null when the day has none. */
function dayShare(l: Ledger, day: string): number | null {
  const steps = l.intentions.filter((i) => i.day === day).flatMap((i) => i.steps).filter((s) => counted(s) && s.verdict !== "open")
  return steps.length ? steps.filter((s) => s.verdict === "done" || s.verdict === "late").length / steps.length : null
}

/**
 * What sets up good days. A marker is something a day has or lacks: a kind of action ("walk"),
 * an early first action, a good feeling about something. Days with it are compared to days without.
 */
export function setups(l: Ledger): Finding[] {
  const days = uniq(l.intentions.map((i) => i.day)).filter((d) => dayShare(l, d) !== null)
  if (days.length < MIN_CASES * 2) return [need("setups", "What sets up good days", days.length, "days with closed plans (twice that are needed to compare)")]
  const markers = new Map<string, Set<string>>()
  const mark = (name: string, day: string) => markers.set(name, (markers.get(name) ?? new Set()).add(day))
  for (const a of l.actions) {
    if (a.kind === "activity" || a.kind === "other" || a.kind === "wake") mark(`did: ${stem(a.what)}`, a.day)
  }
  for (const day of days) {
    const first = l.actions.find((a) => a.day === day)
    if (first && new Date(first.at).getHours() < 8) mark("first action before 8:00", day)
  }
  for (const f of l.feelings) if (f.phase === "after" && stood(f) && (f.satisfaction ?? 0) >= 3) mark(f.aboutWords ? `felt good about: ${stem(f.aboutWords)}` : "a good feeling said", f.day)
  const out: Finding[] = []
  for (const [name, set] of markers) {
    const withIt = days.filter((d) => set.has(d))
    const without = days.filter((d) => !set.has(d))
    if (withIt.length < MIN_CASES || without.length < MIN_CASES) continue
    const a = mean(withIt.map((d) => dayShare(l, d)!))
    const b = mean(without.map((d) => dayShare(l, d)!))
    if (Math.abs(a - b) < 0.2) continue
    out.push({ id: `setup:${name}`, title: "What sets up good days", text: `Days with "${name}": ${pct(a)} of planned steps done (${withIt.length} days). Days without: ${pct(b)} (${without.length} days).`, n: withIt.length, days: withIt, ready: true })
  }
  return out.length ? out.sort((x, y) => y.n - x.n).slice(0, 5) : [{ id: "setups", title: "What sets up good days", text: `No marker separates good days from the rest yet, over ${days.length} days.`, n: days.length, days: [], ready: false }]
}

export function findings(l: Ledger): Finding[] {
  return [...predictionError(l), resistanceCost(l), displaces(l), planRealism(l), ...setups(l)]
}

/** Links and feelings that are read but not yet confirmed: they are not in any finding. */
export function unconfirmed(l: Ledger): number {
  return allSteps(l).filter((s) => s.standing === "proposed" && s.verdict !== "open").length + l.feelings.filter((f) => f.standing === "proposed").length
}

// ── What it gives back ─────────────────────────────────────────────────

/** Before a dreaded step: how the last ones like it sat afterwards. Null without enough of your own cases. */
export function dreadLine(l: Ledger, resistance: number): string | null {
  if (resistance < 3) return null
  const like = pairs(l).filter((p) => (p.before.resistance ?? 0) >= 3).slice(-5)
  if (like.length < MIN_CASES) return null
  const fine = like.filter((p) => p.after.satisfaction! >= 2).length
  return `The last ${like.length} times you resisted something this much and did it, you rated ${fine} of them fine or better afterwards.`
}

/** When planning: a four-step plan flagged as a two-step day, from your own follow-through. */
export function realismLine(l: Ledger, steps: number): string | null {
  if (steps < 2) return null
  const r = planRealism(l)
  if (!r.ready || r.share === undefined) return null
  const likely = Math.max(1, Math.round(steps * r.share))
  return likely >= steps ? null : `You usually finish ${pct(r.share)} of a plan (${r.n} plans), so this ${steps}-step plan is more like a ${likely}-step day.`
}

/** The day's plan next to what happened, with nothing to write. */
export function dayEnd(l: Ledger, day: string): string {
  const plans = l.intentions.filter((i) => i.day === day)
  const actionOf = (id?: string): Action | undefined => l.actions.find((a) => a.id === id)
  const lines: string[] = []
  if (!plans.length) lines.push("No plan was said today.")
  for (const i of plans) {
    lines.push(`Plan at ${clock(i.at)}:`)
    for (const s of i.steps) {
      const a = actionOf(s.actionId)
      const tail = s.verdict === "displaced" && s.displacedBy ? ` by ${s.displacedBy}` : a ? ` at ${clock(a.at)}${s.delayMin ? `, ${span(s.delayMin)} after the plan` : ""}` : ""
      lines.push(`  ${s.order + 1}. ${s.what} — ${VERDICT_LABEL[s.verdict]}${tail}${s.standing === "proposed" && s.verdict !== "open" ? " (not confirmed)" : ""}`)
    }
  }
  const extra = unplanned(l, day)
  if (extra.length) lines.push(`Unplanned: ${extra.map((a) => `${a.what} at ${clock(a.at)}`).join(", ")}.`)
  const felt = l.feelings.filter((f) => f.day === day && f.phase === "after" && f.words)
  if (felt.length) lines.push(`Said afterwards: ${felt.map((f) => `"${f.words.slice(0, 80)}"`).join("; ")}.`)
  const steps = plans.flatMap((i) => i.steps)
  if (steps.length) lines.push(`${steps.filter((s) => s.verdict === "done" || s.verdict === "late").length} of ${steps.length} planned steps done.`)
  return lines.join("\n")
}
