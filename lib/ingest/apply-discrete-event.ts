/**
 * lib/ingest/apply-discrete-event.ts — Instant tracker events from text
 *
 * `log:` / `log-` and whole-message trigger phrases (smoked weed, ate …) land
 * as `kind: "instant"` on the Activity scope, labeled from the text pipeline.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesPastMidnight } from "./times"
import {
  DEFAULT_DISCRETE_EVENT_TRIGGERS,
  fromTextMessageNote,
  matchDiscreteEventTrigger,
  type DiscreteTriggerDef,
} from "./text-triggers"
import type { ApplyResult, IngestIntentKind } from "./types"

const ACTIVITY = "activity"
const DEFAULT_PEN = "Text log"
const TEXT_LABEL = "from text pipeline"

export function applyDiscreteLog(payload: string, now = new Date()): ApplyResult {
  const title = payload.trim()
  if (!title) {
    return {
      status: "error",
      kind: "event-log",
      reply: "Log what? Example: log: drink water",
    }
  }
  return paintInstant(title, now, "event-log")
}

export function applyDiscreteTriggerLine(
  raw: string,
  triggers: DiscreteTriggerDef[],
  now = new Date(),
): ApplyResult | null {
  const list = triggers.length > 0 ? triggers : DEFAULT_DISCRETE_EVENT_TRIGGERS
  const hit = matchDiscreteEventTrigger(raw, list)
  if (!hit) return null
  return paintInstant(hit.title, now, "event-trigger")
}

function paintInstant(title: string, now: Date, kind: IngestIntentKind): ApplyResult {
  const penId = ensurePen(DEFAULT_PEN)
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  const notes = fromTextMessageNote(now, TEXT_LABEL)
  useTimeTrackingStore.getState().paintMinutes(date, ACTIVITY, nowMin, nowMin, penId, undefined, undefined, undefined, {
    kind: "instant",
    title,
    notes,
  })
  const just = useTimeTrackingStore
    .getState()
    .entries.filter(
      (e) =>
        e.date === date &&
        e.scopeId === ACTIVITY &&
        e.penId === penId &&
        e.kind === "instant" &&
        e.startMin === nowMin &&
        e.title === title,
    )
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (just) {
    useTimeTrackingStore.getState().updateEntry(just.id, {
      notes,
      generatedBy: { kind: "text", id: date },
    })
  }
  return {
    status: "ok",
    kind,
    reply: `Logged: ${title}`,
    summary: `Event → ${title}`,
  }
}

function ensurePen(name: string): string {
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((s) => s.id === ACTIVITY) ?? store.scopes[0]
  if (!scope) {
    store.addScope("Activity")
    const created = useTimeTrackingStore.getState().scopes.find((s) => s.id === ACTIVITY) ?? useTimeTrackingStore.getState().scopes[0]
    if (!created) throw new Error("No tracking scope")
    return store.addPen(created.id, { name, color: PEN_PALETTE[0] })
  }
  const existing = scope.pens.find((p) => p.name.trim().toLowerCase() === name.toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length],
  })
}
