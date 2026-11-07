/**
 * lib/wire-bimby/checks.ts — Prove a step works before it is offered or applied
 *
 * `checkStep` runs the step on a copy: it builds the habit as it would be after the step, then
 * pushes a made-up output through the same routing and breakdown code the real path uses. If the
 * routing would not reach the habit, or the breakdown would not add up, a check fails and the
 * Accept key stays closed. Nothing here reads a store: the caller hands in the habits and types.
 * Pure.
 */
import { breakdownForCell, foldOutput } from "@/lib/habit-contributions"
import { validateDetailView, withPanel } from "@/lib/habit-detail-view"
import { checkConnectFeed, connectFeed, habitTakesOutput } from "@/lib/habit-feeds"
import { measureDef, type ModuleOutput, type ModuleSession } from "@/lib/module-output"
import { sessionBlocks } from "@/lib/module-session"
import { moduleSpec } from "@/lib/module-output-registry"
import type { HabitDetailPanel, WeeklyTask } from "@/lib/types"
import type { WireDeps } from "./plan"
import { wireField, type WireCheck, type WireStep } from "./types"

const SAMPLE_AT = "2026-01-05T09:30:00.000Z"

function sample(moduleId: string, measure: string, subjectType: string | undefined): ModuleOutput {
  return {
    id: "check-sample",
    moduleId,
    measure,
    amount: 3,
    at: SAMPLE_AT,
    ...(subjectType ? { subject: { type: subjectType, title: "Sample" } } : {}),
  }
}

/** The habit as this step would leave it. Undefined when the step cannot be built. */
export function habitAfter(step: WireStep, habit: WeeklyTask): WeeklyTask {
  const measure = wireField(step, "measure")
  const subjectType = wireField(step, "subjectType") || undefined
  if (step.kind === "feed") return { ...habit, moduleFeeds: connectFeed(habit, wireField(step, "module"), measure) }
  const panel: HabitDetailPanel =
    step.kind === "breakdown" ? { kind: "breakdown", measure, ...(subjectType ? { subjectType } : {}) } : { kind: "entry", measure, ...(subjectType ? { subjectType } : {}) }
  const withEntryFeed = step.kind === "entry" ? connectFeed(habit, "habit-entry", measure) : habit.moduleFeeds ?? undefined
  return { ...habit, ...(withEntryFeed ? { moduleFeeds: withEntryFeed } : {}), detailView: withPanel(habit, panel) }
}

const SAMPLE_SESSION: ModuleSession = {
  id: "check-session",
  moduleId: "",
  startAt: "2026-01-05T09:30:00.000Z",
  endAt: "2026-01-05T09:52:00.000Z",
  subject: { type: "book", title: "Sample" },
  quantities: [{ measure: "pages", amount: 7 }],
}

function checkTrack(step: WireStep, deps: WireDeps): WireCheck[] {
  const out: WireCheck[] = []
  const moduleId = wireField(step, "module")
  const pen = wireField(step, "pen").trim()
  const parent = wireField(step, "parentPen").trim()
  const spec = moduleSpec(moduleId)
  out.push(spec ? { ok: true, text: `${spec.name} is a module that reports.` } : { ok: false, text: "Choose a module." })
  if (spec) out.push(spec.sessions ? { ok: true, text: `${spec.name} reports whole sessions with start and end.` } : { ok: false, text: `${spec.name} does not report sessions.` })
  out.push(pen ? { ok: true, text: `Pen “${pen}”.` } : { ok: false, text: "Type the pen's name." })
  if (parent && parent.toLowerCase() === pen.toLowerCase()) out.push({ ok: false, text: "A pen cannot count as itself." })
  const existing = deps.pens?.find((p) => p.name.trim().toLowerCase() === pen.toLowerCase())
  if (existing?.feedModule && existing.feedModule !== moduleId) out.push({ ok: false, text: `“${pen}” already follows ${moduleSpec(existing.feedModule)?.name ?? existing.feedModule}.` })
  else if (pen) out.push({ ok: true, text: existing ? `“${pen}” exists and will follow ${spec?.name ?? moduleId}.` : `“${pen}” will be made.` })
  if (parent) {
    const p = deps.pens?.find((x) => x.name.trim().toLowerCase() === parent.toLowerCase())
    out.push({ ok: true, text: p ? `“${parent}” exists; “${pen}” will count as it.` : `“${parent}” will be made, and “${pen}” will count as it.` })
  }
  if (spec?.sessions && pen) {
    const blocks = sessionBlocks({ ...SAMPLE_SESSION, moduleId })
    const note = blocks[0]?.notes ?? ""
    out.push(
      blocks.length === 1 && /7 pages of Sample/.test(note)
        ? { ok: true, text: "Dry run: a 22-minute session paints one block with the book and pages in its note." }
        : { ok: false, text: "Dry run: the session did not make a block with a note." },
    )
  }
  return out
}

export function checkStep(step: WireStep, deps: WireDeps): WireCheck[] {
  if (step.kind === "track") return checkTrack(step, deps)
  const out: WireCheck[] = []
  const habit = deps.habits.find((h) => h.id === wireField(step, "habit"))
  const measure = wireField(step, "measure")
  const subjectType = wireField(step, "subjectType") || undefined
  out.push(
    habit
      ? { ok: true, text: `Habit “${habit.name}” exists.` }
      : { ok: false, text: "Choose which habit this is for." },
  )
  out.push(measureDef(measure) ? { ok: true, text: `“${measure}” is a measure this house counts.` } : { ok: false, text: "Choose what it counts." })
  if (subjectType) {
    const known = deps.types.some((t) => t.id === subjectType)
    out.push({ ok: known, text: known ? `Item type “${subjectType}” exists.` : `There is no “${subjectType}” item type.` })
  }
  if (!habit || !measureDef(measure) || (subjectType && !deps.types.some((t) => t.id === subjectType))) return out

  const moduleId = step.kind === "feed" ? wireField(step, "module") : "habit-entry"
  if (step.kind === "feed") {
    const spec = moduleSpec(moduleId)
    out.push(spec ? { ok: true, text: `${spec.name} is a module that reports.` } : { ok: false, text: "Choose a module." })
    const emits = spec?.emits.some((e) => e.measure === measure)
    if (spec) out.push(emits ? { ok: true, text: `${spec.name} reports ${measureDef(measure)!.unit[1]}.` } : { ok: false, text: `${spec.name} does not report ${measureDef(measure)!.unit[1]}.` })
    if (spec) out.push(spec.reportsTime ? { ok: true, text: `${spec.name} reports when it happened.` } : { ok: false, text: `${spec.name} does not report a time.` })
    if (!spec || !emits) return out
  }
  const can = checkConnectFeed(habit, moduleId, measure)
  out.push(can.ok ? { ok: true, text: `“${habit.name}” can take ${measureDef(measure)!.unit[1]}.` } : { ok: false, text: can.reason })
  if (!can.ok) return out

  const after = habitAfter(step, habit)
  const probe = sample(moduleId, measure, subjectType)
  // A breakdown only reads what other doors wrote; it does not need its own feed.
  if (step.kind !== "breakdown")
    out.push(
      habitTakesOutput(after, probe)
        ? { ok: true, text: "Dry run: a sample report reaches the habit." }
        : { ok: false, text: "Dry run: a sample report would not reach the habit." },
    )
  if (step.kind !== "feed") {
    const view = validateDetailView(after, after.detailView, deps.types.map((t) => t.id))
    out.push(view.ok ? { ok: true, text: "The detail view is valid." } : { ok: false, text: view.errors.join("; ") })
  }
  const { record } = foldOutput(undefined, probe, [habit.id])
  const row = { id: "x", attributes: { habitContribution: JSON.stringify(record) } }
  const b = breakdownForCell([row], habit.id, measure, record.day, probe.amount)
  out.push(
    b.groups.length === 1 && b.rest === 0
      ? { ok: true, text: "Dry run: the breakdown adds up to the cell." }
      : { ok: false, text: "Dry run: the breakdown does not add up." },
  )
  return out
}

export const stepPasses = (checks: WireCheck[]): boolean => checks.length > 0 && checks.every((c) => c.ok)
