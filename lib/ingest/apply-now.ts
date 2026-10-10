/**
 * lib/ingest/apply-now.ts — `now <payload>` / `/now` three-part capture
 *
 * Bare `now`, `status`, and `where` stay the status readout (`apply-read`).
 * A payload is this capture, not Status. Segments are split on `|`.
 * Empty segments are skipped and do not shift the others:
 *   1 doing now → Activity through now (`applyScopeNowUpdate`, future cleared)
 *   2 just did → Tracking log Event (`submitTrackingLog`)
 *   3 about to do → header plan (`createHeaderPlan`, 30 minutes)
 * One segment and no bar is doing-now, so the prose is kept.
 * `/now` with nothing after it replies with the template and the current lanes.
 */
import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey } from "@/lib/date-utils"
import { createHeaderPlan } from "@/lib/header-tracking-plan"
import { hhmmToMinutes } from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { ACTIVITY_SCOPE_ID } from "@/lib/operation-work-session"
import { applyScopeNowUpdate } from "@/lib/tracking-presence"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesPastMidnight } from "./times"
import type { ApplyResult } from "./types"

const ABOUT_TO_MINUTES = 30

export function splitNowCapture(payload: string): { doing: string; did: string; next: string } {
  const parts = payload.split("|").map((part) => part.trim())
  return {
    doing: parts[0] ?? "",
    did: parts[1] ?? "",
    next: parts.slice(2).filter(Boolean).join(" | "),
  }
}

export function applyNowCapture(payload: string, now = new Date()): ApplyResult {
  const parts = splitNowCapture(payload)
  if (!parts.doing && !parts.did && !parts.next) return nowTemplate(now)

  const lines: string[] = []
  const itemIds: string[] = []

  if (parts.doing) {
    const painted = applyScopeNowUpdate(ACTIVITY_SCOPE_ID, parts.doing, now, "open")
    lines.push(painted ? `Now: ${parts.doing}` : `Now (not painted): ${parts.doing}`)
  }
  if (parts.did) {
    const id = submitTrackingLog({
      date: formatLocalDateKey(now),
      title: parts.did,
      mode: "event",
      clock: "exact",
      minute: minutesPastMidnight(now),
    })
    if (id) itemIds.push(id)
    lines.push(`Just did: ${parts.did}`)
  }
  if (parts.next) {
    const plan = createHeaderPlan({
      date: formatLocalDateKey(now),
      startMin: minutesPastMidnight(now),
      startEstimated: false,
      actions: [{ title: parts.next, minutes: ABOUT_TO_MINUTES }],
    })
    itemIds.push(...plan.taskIds)
    lines.push(`About to: ${parts.next} (${ABOUT_TO_MINUTES}m)`)
  }

  return {
    status: "ok",
    kind: "now-capture",
    reply: lines.join("\n"),
    summary: lines[0] ?? "Now capture",
    itemIds: itemIds.length ? itemIds : undefined,
  }
}

function nowTemplate(now: Date): ApplyResult {
  const date = formatLocalDateKey(now)
  const minute = minutesPastMidnight(now)
  const doing = penCovering(ACTIVITY_SCOPE_ID, date, minute)
  const last = latestInstantTitle()
  const next = nextPlanTitle(date, minute)
  return {
    status: "ok",
    kind: "now-capture",
    reply: [
      "Now capture: doing | just did | about to do",
      "Example: now putting laundry away | smoked | outfit store",
      `Doing: ${doing ?? "—"}`,
      `Last: ${last ?? "—"}`,
      `Next: ${next ?? "—"}`,
    ].join("\n"),
    summary: "Now capture template",
  }
}

function penCovering(scopeId: string, date: string, minute: number): string | null {
  const store = useTimeTrackingStore.getState()
  const entry = store.entries.find(
    (row) =>
      row.date === date &&
      row.scopeId === scopeId &&
      row.kind !== "instant" &&
      row.penId &&
      row.startMin <= minute &&
      minute < row.endMin,
  )
  if (!entry?.penId) return null
  return store.scopes.find((scope) => scope.id === scopeId)?.pens.find((pen) => pen.id === entry.penId)?.name ?? null
}

function latestInstantTitle(): string | null {
  const instants = useTimeTrackingStore
    .getState()
    .entries.filter((row) => row.kind === "instant" && row.title?.trim())
  if (instants.length === 0) return null
  const latest = [...instants].sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1)).at(-1)
  return latest?.title?.trim() || null
}

function nextPlanTitle(date: string, minute: number): string | null {
  const actions = usePlannedActionStore
    .getState()
    .actions.filter((action) => action.date === date)
    .sort((a, b) => hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime))
  const upcoming = actions.find((action) => hhmmToMinutes(action.startTime) >= minute) ?? actions[0]
  return upcoming?.title?.trim() || null
}
