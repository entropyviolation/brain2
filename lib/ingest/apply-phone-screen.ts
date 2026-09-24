/**
 * lib/ingest/apply-phone-screen.ts — Paint iPhone Screen Time from a phrase
 *
 * Telegram / Shortcuts only. Never Mac `screentime`, never Activity / Location /
 * Mood. No `generatedBy.kind === "screentime"` stamp — Mac AW replace must not
 * delete these minutes. Precision is estimated. Apple cannot export Screen Time.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { categoryForApp, slugApp } from "@/lib/screentime/app-categories"
import {
  IPHONE_SCREENTIME_CATEGORY_PENS,
  PEN_PALETTE,
  defaultIphoneScreenTimeScope,
  findIphoneScreenTimeScope,
  useTimeTrackingStore,
  type TrackPen,
  type TrackScope,
} from "@/lib/time-tracking-store"
import { resolveName, splitNameAndRest, type Named } from "./name-resolve"
import { MINUTES_PER_DAY, addLocalDays, minutesPastMidnight, parseTrackWindow } from "./times"
import type { ApplyResult } from "./types"

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

function ensureIphoneScreenTimeScope(): TrackScope {
  const tracking = useTimeTrackingStore.getState()
  const existing = findIphoneScreenTimeScope(tracking.scopes)
  if (existing) {
    const missing = IPHONE_SCREENTIME_CATEGORY_PENS.filter((pen) => !existing.pens.some((p) => p.id === pen.id))
    if (!missing.length) return existing
    const next: TrackScope = { ...existing, pens: [...existing.pens, ...missing] }
    useTimeTrackingStore.setState({
      scopes: tracking.scopes.map((scope) => (scope.id === existing.id ? next : scope)),
    })
    return next
  }
  const created = defaultIphoneScreenTimeScope()
  useTimeTrackingStore.setState({ scopes: [...tracking.scopes, created] })
  return created
}

/** Stable `iphone-st-app-{slug}` under a category root. Existing pens keep name/color/parent. */
export function ensureIphoneAppPen(name: string): string {
  const trimmed = name.trim() || "app"
  const id = `iphone-st-app-${slugApp(trimmed)}`
  const parentId = `iphone-${categoryForApp(trimmed).id}`
  const scope = ensureIphoneScreenTimeScope()
  if (scope.pens.some((pen) => pen.id === id)) return id

  const pen: TrackPen = {
    id,
    name: trimmed,
    color: hashPenColor(id),
    parentId,
    lastUsedAt: Date.now(),
  }
  useTimeTrackingStore.setState((state) => ({
    scopes: state.scopes.map((row) => (row.id === scope.id ? { ...row, pens: [...row.pens, pen] } : row)),
  }))
  return id
}

function namedPens(scopeId: string): Named[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  return (scope?.pens ?? []).map((p) => ({ id: p.id, name: p.name }))
}

function paintIphoneWindow(scopeId: string, date: string, startMin: number, endMin: number, penId: string): void {
  const start = Math.min(Math.max(0, Math.floor(startMin)), MINUTES_PER_DAY - 1)
  let end = Math.floor(endMin)
  if (end <= start) end = start + 1
  if (end > MINUTES_PER_DAY) end = MINUTES_PER_DAY
  useTimeTrackingStore.getState().paintMinutes(date, scopeId, start, end, penId, undefined, undefined, "estimated")
}

export function applyIphoneScreen(payload: string, now = new Date()): ApplyResult {
  const rest = payload.trim()
  if (!rest) {
    return { status: "error", kind: "iphone-screen", reply: "Which app? Example: screen: Instagram 30m" }
  }

  const scope = ensureIphoneScreenTimeScope()
  const { query, rest: remainder } = splitNameAndRest(rest, namedPens(scope.id))
  const name = query || rest
  const resolved = resolveName(name, namedPens(scope.id))
  const penId = resolved.status === "match" ? resolved.candidate.id : ensureIphoneAppPen(name)
  const pen = useTimeTrackingStore
    .getState()
    .scopes.find((s) => s.id === scope.id)
    ?.pens.find((p) => p.id === penId)
  const label = pen?.name ?? name

  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  const window = parseTrackWindow(remainder, now)
  if (window?.previousDay) {
    const prev = formatLocalDateKey(addLocalDays(now, -1))
    paintIphoneWindow(scope.id, prev, window.startMin, window.endMin, penId)
    if (nowMin > 0) paintIphoneWindow(scope.id, date, 0, nowMin || 1, penId)
  } else if (window) {
    paintIphoneWindow(scope.id, date, window.startMin, window.endMin, penId)
  } else {
    paintIphoneWindow(scope.id, date, nowMin, MINUTES_PER_DAY, penId)
  }

  const when = window
    ? `${formatClock(window.startMin)}–${formatClock(window.previousDay ? nowMin : window.endMin)}`
    : `from ${formatClock(nowMin)}`
  return {
    status: "ok",
    kind: "iphone-screen",
    reply: `iPhone: ${label} ${when}`,
    summary: `iPhone Screen Time → ${label}`,
  }
}
