"use client"

/**
 * todo-pace.tsx — Your own pace, in Show / Sort / Pace (Phase 6)
 *
 * Each pace with a field to override it, and the ghost switch. Reads
 * `lib/estimate-pace.ts`; writes only To Do prefs, never an estimate.
 */
import { useState } from "react"
import { findPen } from "@/lib/tracked-time"
import { PACE_MIN_SAMPLES, paceFor, paceKey, paceSampleCount, type PaceSample, type PaceScope } from "@/lib/estimate-pace"
import type { TrackScope } from "@/lib/time-tracking-store"
import { setTodoPrefs } from "./todo-prefs"

function PaceRow({
  label,
  scope,
  samples,
  overrides,
}: {
  label: string
  scope: PaceScope
  samples: readonly PaceSample[]
  overrides: Record<string, number>
}) {
  const key = paceKey(scope)
  const set = overrides[key]
  const count = paceSampleCount(samples, scope)
  const mine = paceFor(samples, scope)
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (raw: string) => {
    const next = { ...overrides }
    const n = Number(raw)
    if (raw.trim() && Number.isFinite(n) && n > 0) next[key] = n
    else delete next[key]
    setTodoPrefs({ paceOverrides: next })
    setDraft(null)
  }
  const note =
    count < PACE_MIN_SAMPLES ? `${count} of ${PACE_MIN_SAMPLES} samples, reads ×1` : `×${mine.toFixed(1)} from ${count} samples`
  return (
    <label className="todo-filter-field todo-pace-row" title={note}>
      <span className="todo-label">{label}</span>
      <input
        type="number"
        min={0.5}
        max={4}
        step={0.1}
        aria-label={`Pace override: ${label}`}
        placeholder={`×${mine.toFixed(1)}`}
        value={draft ?? (set ? String(set) : "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
      />
      <span className="todo-pace-note" aria-hidden>
        {count < PACE_MIN_SAMPLES ? `${count}/${PACE_MIN_SAMPLES}` : `n ${count}`}
      </span>
    </label>
  )
}

export function PaceSettings({
  samples,
  overrides,
  ghosts,
  scopes,
}: {
  samples: readonly PaceSample[]
  overrides: Record<string, number>
  ghosts: boolean
  scopes: TrackScope[]
}) {
  const penIds = [...new Set(samples.flatMap((s) => s.penIds))]
    .filter((id) => overrides[`pen:${id}`] || paceSampleCount(samples, { kind: "pen", penId: id }) >= PACE_MIN_SAMPLES)
    .slice(0, 6)
  return (
    <div className="todo-pace-settings" data-ui-name="Your pace" data-ui-docs="components/Home/ToDo/README.md">
      <PaceRow label="Your pace" scope={{ kind: "overall" }} samples={samples} overrides={overrides} />
      {penIds.map((penId) => (
        <PaceRow
          key={penId}
          label={findPen(scopes, penId)?.name ?? "Pen"}
          scope={{ kind: "pen", penId }}
          samples={samples}
          overrides={overrides}
        />
      ))}
      <label className="todo-key-check" title='The dim "usually ×2.4 for you" beside an estimate. It never changes your number.'>
        <input type="checkbox" checked={ghosts} onChange={(e) => setTodoPrefs({ paceGhosts: e.target.checked })} />
        Pace ghosts
      </label>
    </div>
  )
}
