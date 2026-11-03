/**
 * Create a session draft and store it. `putSession` lets go of a pen clock the store bumped aside.
 */
import { useTaskStore } from "@/lib/task-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import type { SessionOpenRequest } from "@/lib/session-open-store"
import { releasePenClock } from "@/lib/session-pen"
import {
  BUILT_IN_TEMPLATES,
  addLine,
  emptySession,
  sessionFromTemplate,
  type SessionPlan,
  type SessionTemplate,
} from "@/lib/session-plan"

/** A new draft from another way in: a template, a length, a title and seed lines. Focused. */
function newDraftFrom(request: Omit<SessionOpenRequest, "startOn">): string {
  const store = useSessionPlanStore.getState()
  const tasks = useTaskStore.getState().tasks
  const template = request.templateId ? findTemplate(request.templateId, store.templates) : undefined
  let plan = template ? sessionFromTemplate(template, tasks, new Date(), request.seed) : emptySession(new Date(), request.durationMin ?? 180)
  if (!template) for (const ref of request.seed ?? []) plan = addLine(plan, "min", ref, tasks)
  if (request.durationMin) plan = { ...plan, durationMin: request.durationMin }
  if (request.title?.trim()) plan = { ...plan, title: request.title.trim() }
  store.put(plan)
  store.focus(plan.id)
  return plan.id
}

function findTemplate(id: string, saved: readonly SessionTemplate[]): SessionTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? saved.find((t) => t.id === id)
}

/** A new draft, seeded with what the last review kept, and focused. */
function newDraft(): void {
  const store = useSessionPlanStore.getState()
  let plan = emptySession(new Date())
  for (const ref of store.kept) plan = addLine(plan, ref.tier, ref, useTaskStore.getState().tasks)
  store.put(plan)
  store.focus(plan.id)
  store.clearKept()
}

/**
 * Store a session. A session parked to make room for another lets go of the
 * Tracking pen clock if it was painting there (the time so far is written as
 * on Stop). One parked by hand only pauses the pen (`lib/session-pen.ts`).
 * Returns the id.
 */
function putSession(next: SessionPlan): string {
  const bumped = useSessionPlanStore.getState().put(next, new Date())
  releasePenClock(bumped)
  return next.id
}

export { newDraftFrom, findTemplate, newDraft, putSession }
