/**
 * components/Home/home-tracking-tile.tsx — Current / last-known Tracking state
 *
 * Activity, Location, Mood, Company. Current when a block covers now, a
 * live Working-on-now / pen-color session, or a Telegram currently span;
 * otherwise last known. Update paints from now through the end of the day.
 */
"use client"

import { useMemo, useState } from "react"
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

  return (
    <>
      <div className="home-tile is-tracking" data-widget="tracking" data-testid="home-tracking-tile">
        <TileHide id="tracking" onHide={onHide} />
        <TileOpen label="Tracking now" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>{snap.caption}</span>
          </div>
          <div className="home-crt home-presence-crt">
            {snap.lanes.map((lane) => (
              <div key={lane.scopeId} className="home-presence-line" data-kind={lane.kind}>
                <span>{PRESENCE_SCOPE_LABEL[lane.scopeId]}</span>
                <span>{lane.name}</span>
              </div>
            ))}
          </div>
        </TileOpen>
        <button
          type="button"
          className="home-review-key home-tile-key"
          onClick={() => setUpdating(true)}
        >
          Update
        </button>
        <div className="home-tile-foot">
          <p className="hab-score-sub" title={snap.footer}>
            {snap.footer}
          </p>
        </div>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Tracking now">
        <p className="home-widget-lead">{snap.caption}</p>
        <WidgetWells>
          {snap.lanes.map((lane) => (
            <WidgetWell key={lane.scopeId} label={`${PRESENCE_SCOPE_LABEL[lane.scopeId]}${lane.kind === "current" ? " (now)" : lane.kind === "last" ? " (last known)" : ""}`} tone={lane.kind === "current" ? "glow" : "nixie"}>
              {lane.name}
            </WidgetWell>
          ))}
        </WidgetWells>
        <button type="button" className="home-review-key" onClick={() => setUpdating(true)}>
          Update
        </button>
      </HomeWidgetDialog>
      <TrackingUpdateDialog open={updating} onOpenChange={setUpdating} />
    </>
  )
}

function TrackingUpdateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [draft, setDraft] = useState<Record<PresenceScopeId, string>>({
    activity: "",
    location: "",
    mood: "",
    company: "",
  })

  const pens = useMemo(
    () => Object.fromEntries(PRESENCE_SCOPE_IDS.map((id) => [id, pensForPresenceScope(scopes, id)])) as Record<
      PresenceScopeId,
      ReturnType<typeof pensForPresenceScope>
    >,
    [scopes],
  )

  return (
    <HomeWidgetDialog open={open} onOpenChange={onOpenChange} title="Update tracking">
      <p className="home-widget-lead">What is true right now?</p>
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
          applyTrackingPresenceUpdate(draft)
          onOpenChange(false)
        }}
      >
        Save
      </button>
    </HomeWidgetDialog>
  )
}
