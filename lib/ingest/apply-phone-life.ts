/**
 * lib/ingest/apply-phone-life.ts — iPhone Calls + iPhone Texts from a phrase
 *
 * Telegram / Shortcuts only. Stock iOS cannot watch Phone recents or Messages.
 * Paints `iphone-calls` (intervals) and `iphone-texts` (instants). Never Mac
 * Screen Time, Activity, Location, or Mood. No `generatedBy.kind === "screentime"`.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { slugApp } from "@/lib/screentime/app-categories"
import {
  PEN_PALETTE,
  defaultIphoneCallsScope,
  defaultIphoneTextsScope,
  findIphoneCallsScope,
  findIphoneTextsScope,
  useTimeTrackingStore,
  type TrackPen,
  type TrackScope,
} from "@/lib/time-tracking-store"
import { resolveName, type Named } from "./name-resolve"
import { MINUTES_PER_DAY, addLocalDays, minutesPastMidnight, parseTrackWindow } from "./times"
import type { ApplyResult, IngestIntentKind } from "./types"

function formatClock(min: number): string {
  const wrapped = ((Math.floor(min) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const am = h < 12
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`
}

function hashPenColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PEN_PALETTE[hash % PEN_PALETTE.length]
}

function namedPens(scopeId: string): Named[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  return (scope?.pens ?? []).map((p) => ({ id: p.id, name: p.name }))
}

function ensureScope(
  find: (scopes: TrackScope[]) => TrackScope | undefined,
  create: () => TrackScope,
): TrackScope {
  const tracking = useTimeTrackingStore.getState()
  const existing = find(tracking.scopes)
  if (existing) return existing
  const created = create()
  useTimeTrackingStore.setState({ scopes: [...tracking.scopes, created] })
  return created
}

function ensurePersonPen(scopeId: string, prefix: string, name: string): string {
  const trimmed = name.trim().replace(/:$/, "") || "someone"
  const id = `${prefix}-${slugApp(trimmed)}`
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  if (!scope) return id
  if (scope.pens.some((pen) => pen.id === id)) return id
  const pen: TrackPen = {
    id,
    name: trimmed,
    color: hashPenColor(id),
    lastUsedAt: Date.now(),
  }
  useTimeTrackingStore.setState((state) => ({
    scopes: state.scopes.map((row) => (row.id === scopeId ? { ...row, pens: [...row.pens, pen] } : row)),
  }))
  return id
}

function resolvePerson(scopeId: string, prefix: string, query: string): { penId: string; label: string } {
  const resolved = resolveName(query, namedPens(scopeId))
  const penId = resolved.status === "match" ? resolved.candidate.id : ensurePersonPen(scopeId, prefix, query)
  const pen = useTimeTrackingStore
    .getState()
    .scopes.find((s) => s.id === scopeId)
    ?.pens.find((p) => p.id === penId)
  return { penId, label: pen?.name ?? query }
}

/** Who + optional trailing duration / clock window. First word is who when unknown. */
export function splitPersonAndRest(payload: string, items: Named[]): { query: string; rest: string } {
  const text = payload.trim()
  if (!text) return { query: "", rest: "" }

  const sorted = [...items].sort((a, b) => b.name.length - a.name.length)
  const lower = text.toLowerCase()
  for (const item of sorted) {
    const n = item.name.toLowerCase()
    if (lower === n) return { query: item.name, rest: "" }
    if (lower.startsWith(`${n} `) || lower.startsWith(`${n}:`)) {
      return { query: item.name, rest: text.slice(item.name.length).replace(/^[:\s]+/, "").trim() }
    }
  }

  const windowHit = text.match(
    /^(.*?)(?:\s+)(\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b.*|[0-9]{1,2}:[0-9]{2}\s*(?:-|–|—|to)\s*.*)$/i,
  )
  if (windowHit?.[1]?.trim()) {
    return { query: windowHit[1].trim().replace(/:$/, ""), rest: windowHit[2].trim() }
  }

  const parts = text.split(/\s+/)
  if (parts.length === 1) return { query: text.replace(/:$/, ""), rest: "" }
  return { query: parts[0].replace(/:$/, ""), rest: parts.slice(1).join(" ") }
}

function paintCallWindow(scopeId: string, date: string, startMin: number, endMin: number, penId: string): void {
  const start = Math.min(Math.max(0, Math.floor(startMin)), MINUTES_PER_DAY - 1)
  let end = Math.floor(endMin)
  if (end <= start) end = start + 1
  if (end > MINUTES_PER_DAY) end = MINUTES_PER_DAY
  useTimeTrackingStore.getState().paintMinutes(date, scopeId, start, end, penId, undefined, undefined, "estimated")
}

export function applyIphoneCall(payload: string, now = new Date()): ApplyResult {
  const rest = payload.trim()
  if (!rest) {
    return { status: "error", kind: "iphone-call", reply: "Who? Example: call: Jane 12m" }
  }
  const scope = ensureScope(findIphoneCallsScope, defaultIphoneCallsScope)
  const { query, rest: remainder } = splitPersonAndRest(rest, namedPens(scope.id))
  const name = query || rest
  const { penId, label } = resolvePerson(scope.id, "iphone-call", name)

  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  const window = parseTrackWindow(remainder, now)
  if (window?.previousDay) {
    const prev = formatLocalDateKey(addLocalDays(now, -1))
    paintCallWindow(scope.id, prev, window.startMin, window.endMin, penId)
    if (nowMin > 0) paintCallWindow(scope.id, date, 0, nowMin || 1, penId)
  } else if (window) {
    paintCallWindow(scope.id, date, window.startMin, window.endMin, penId)
  } else {
    paintCallWindow(scope.id, date, nowMin, nowMin + 1, penId)
  }

  const when = window
    ? `${formatClock(window.startMin)}–${formatClock(window.previousDay ? nowMin : window.endMin)}`
    : `at ${formatClock(nowMin)} (1m)`
  return ok("iphone-call", `Call: ${label} ${when}`, `iPhone Calls → ${label}`)
}

export function applyIphoneText(payload: string, now = new Date()): ApplyResult {
  const rest = payload.trim()
  if (!rest) {
    return { status: "error", kind: "iphone-text", reply: "Who and what? Example: text: Jane on my way" }
  }
  const scope = ensureScope(findIphoneTextsScope, defaultIphoneTextsScope)
  const { query, rest: body } = splitPersonAndRest(rest, namedPens(scope.id))
  const name = query || rest
  if (!body.trim()) {
    return { status: "error", kind: "iphone-text", reply: "What did you text? Example: text: Jane on my way" }
  }
  const { penId, label } = resolvePerson(scope.id, "iphone-text", name)
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  useTimeTrackingStore.getState().paintMinutes(date, scope.id, nowMin, nowMin, penId, undefined, undefined, "estimated", {
    kind: "instant",
    title: body,
    notes: body,
  })
  return ok("iphone-text", `Text: ${label} — ${body}`, `iPhone Texts → ${label}`)
}

function ok(kind: IngestIntentKind, reply: string, summary: string): ApplyResult {
  return { status: "ok", kind, reply, summary }
}
