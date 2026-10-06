/**
 * components/Home/home-tracking-tile.tsx — Current / last-known Tracking state
 *
 * Activity, Location, Mood, Company. Current when a block covers now, a
 * live Working-on-now / pen-color session, or a Telegram currently span;
 * otherwise last known. Update stamps the present only (up to now) and
 * clears later hours — never paints through midnight.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesPastMidnight } from "@/lib/ingest/times"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import {
  PRESENCE_SCOPE_IDS,
  PRESENCE_SCOPE_LABEL,
  applyTrackingPresenceUpdate,
  livePresenceHints,
  pensForPresenceScope,
  trackingPresenceSnapshot,
  type PresenceScopeId,
} from "@/lib/tracking-presence"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"

export function TrackingNowTile({ onHide }: { onHide: () => void }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const workSession = useWorkSessionStore((s) => s.session)
  const penSession = usePenColorSessionStore((s) => s.session)
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const now = new Date()
  const live = livePresenceHints({
    workSession: workSession ? { title: workSession.title, scopeId: workSession.scopeId } : null,
    penSession: penSession ? { title: penSession.title, scopeId: penSession.scopeId } : null,
  })
  const snap = trackingPresenceSnapshot({
    date: formatLocalDateKey(now),
    min: minutesPastMidnight(now),
    entries,
    scopes,
    live,
  })
  const activity = snap.lanes.find((lane) => lane.scopeId === "activity") ?? snap.activity
  const location = snap.lanes.find((lane) => lane.scopeId === "location")
  const mood = snap.lanes.find((lane) => lane.scopeId === "mood")
  const company = snap.lanes.find((lane) => lane.scopeId === "company")
  const seedKey = snap.lanes.map((lane) => `${lane.scopeId}:${lane.kind}:${lane.name}`).join("|")
  const seed = useMemo(
    () =>
      Object.fromEntries(
        snap.lanes.map((lane) => [lane.scopeId, lane.kind === "empty" ? "" : lane.name]),
      ) as Record<PresenceScopeId, string>,
    // lane identity is summarized in seedKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seedKey],
  )

  function openUpdate() {
    setOpen(false)
    setUpdating(true)
  }

  return (
    <>
      <div className="home-tile is-tracking" data-widget="tracking" data-testid="home-tracking-tile">
        <TileHide id="tracking" onHide={onHide} />
        <TileOpen label="Tracking now" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>{snap.caption}</span>
          </div>
          <div className="home-crt home-presence-crt">
            <p className="home-presence-activity" title={activity.name}>
              {activity.name}
            </p>
            <p className="home-presence-meta" title={[location?.name, quotedMood(mood)].filter(Boolean).join(" · ")}>
              <span>{location?.kind === "empty" ? "—" : location?.name}</span>
              <span aria-hidden="true">·</span>
              <span>{quotedMood(mood)}</span>
            </p>
            {company && company.kind !== "empty" ? (
              <p className="home-presence-company">{company.name}</p>
            ) : null}
          </div>
        </TileOpen>
        <div className="home-tile-foot home-presence-foot">
          <p className="hab-score-sub">{snap.caption === "Now" ? "live" : "last known"}</p>
          <button type="button" className="home-presence-update" onClick={openUpdate}>
            Update
          </button>
        </div>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Tracking now">
        <p className="home-widget-lead">{snap.caption}</p>
        <WidgetWells>
          {snap.lanes.map((lane) => (
            <WidgetWell
              key={lane.scopeId}
              label={`${PRESENCE_SCOPE_LABEL[lane.scopeId]}${lane.kind === "current" ? " (now)" : lane.kind === "last" ? " (last known)" : ""}`}
              tone={lane.kind === "current" ? "glow" : "nixie"}
            >
              {lane.scopeId === "mood" ? quotedMood(lane) : lane.name}
            </WidgetWell>
          ))}
        </WidgetWells>
        <button type="button" className="home-review-key" onClick={openUpdate}>
          Update Tracking
        </button>
      </HomeWidgetDialog>
      <TrackingUpdateDialog open={updating} onOpenChange={setUpdating} seed={seed} />
    </>
  )
}

/** The current mood name, in quotes. An empty lane stays a dash. */
function quotedMood(lane: { kind: string; name: string } | undefined): string {
  if (!lane || lane.kind === "empty" || !lane.name || lane.name === "—") return "—"
  return `"${lane.name}"`
}

function TrackingUpdateDialog({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed: Record<PresenceScopeId, string>
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [draft, setDraft] = useState<Record<PresenceScopeId, string>>(seed)
  const seedRef = useRef(seed)
  seedRef.current = seed

  useEffect(() => {
    if (!open) return
    setDraft(seedRef.current)
  }, [open])

  const pens = useMemo(
    () => Object.fromEntries(PRESENCE_SCOPE_IDS.map((id) => [id, pensForPresenceScope(scopes, id)])) as Record<
      PresenceScopeId,
      ReturnType<typeof pensForPresenceScope>
    >,
    [scopes],
  )

  return (
    <HomeWidgetDialog open={open} onOpenChange={onOpenChange} title="Update tracking">
      <p className="home-widget-lead">What is true right now? Saves up to this minute — later hours stay empty.</p>
      {PRESENCE_SCOPE_IDS.map((scopeId) => (
        <label key={scopeId} className="home-widget-field">
          {PRESENCE_SCOPE_LABEL[scopeId]}
          <input
            list={`home-presence-${scopeId}`}
            value={draft[scopeId]}
            placeholder="Leave blank to keep"
            onChange={(event) => setDraft((prev) => ({ ...prev, [scopeId]: event.target.value }))}
          />
          <datalist id={`home-presence-${scopeId}`}>
            {pens[scopeId].map((pen) => (
              <option key={pen.id} value={pen.name} />
            ))}
          </datalist>
        </label>
      ))}
      <button
        type="button"
        className="home-review-key"
        onClick={() => {
          const patches: Partial<Record<PresenceScopeId, string>> = {}
          for (const scopeId of PRESENCE_SCOPE_IDS) {
            const next = draft[scopeId]?.trim() ?? ""
            if (!next) continue
            patches[scopeId] = next
          }
          if (Object.keys(patches).length === 0) return
          applyTrackingPresenceUpdate(patches)
          onOpenChange(false)
        }}
      >
        Update Tracking
      </button>
    </HomeWidgetDialog>
  )
}
