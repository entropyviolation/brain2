/**
 * components/Home/Tracking/settings/auto-track-settings.tsx — The iPhone's automatic tracking switches
 *
 * A group in Tracking settings → General. In the iPhone app it holds the
 * switches for `lib/mobile/auto-track.ts`: the sync itself, walks found in
 * the steps, the shortest walk kept, and place names on titles. The switches
 * live on the phone, so on the Mac this group only says where to find them.
 */
"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import {
  autoTrackAvailable,
  autoTrackLine,
  getAutoTrack,
  getAutoTrackServerSnapshot,
  runAutoTrack,
  setAutoTrack,
  subscribeAutoTrack,
} from "@/lib/mobile/auto-track"
import { WALK_MIN_STEPS } from "@/lib/phone-sync/walks"

function Lamp({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="trk-set-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="trk-set-toggle-lamp" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="trk-set-row">
      <div className="trk-set-row-copy">
        <span className="trk-set-row-title">{title}</span>
        <p className="trk-set-row-help">{help}</p>
      </div>
      <div className="trk-set-row-control">{children}</div>
    </div>
  )
}

export function AutoTrackSettings() {
  const state = useSyncExternalStore(subscribeAutoTrack, getAutoTrack, getAutoTrackServerSnapshot)
  const [onPhone, setOnPhone] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => setOnPhone(autoTrackAvailable()), [])

  if (!onPhone) {
    return (
      <p className="trk-set-row-help" data-testid="auto-track-off-phone">
        Walks, workouts, sleep, and places are read by the iPhone app from Apple Health and the phone&rsquo;s location.
        Open Tracking settings in the iPhone app to change them.
      </p>
    )
  }

  const syncNow = async () => {
    setBusy(true)
    try {
      await runAutoTrack({ force: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="auto-track-settings">
      <Row
        title="Automatic sync"
        help="Each time the app opens, read Apple Health since the last time. Nothing runs in the background; Health keeps the record until then."
      >
        <Lamp id="trk-set-auto-on" label="Sync when the app opens" checked={state.on} onChange={(on) => setAutoTrack({ on })} />
      </Row>
      <Row
        title="Walks"
        help="Find walks in your steps and paint them on Activity as Walking. A walk never covers time you already tracked. A run goes on Exercise."
      >
        <Lamp id="trk-set-auto-walks" label="Find walks" checked={state.walks} onChange={(walks) => setAutoTrack({ walks })} />
      </Row>
      <Row title="Shortest walk" help="Shorter stretches of steps are left off the grid.">
        <div className="trk-set-keys" role="group" aria-label="Shortest walk">
          {WALK_MIN_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              data-no95=""
              aria-pressed={state.walkMinMinutes === step}
              onClick={() => setAutoTrack({ walkMinMinutes: step })}
            >
              {step}m
            </button>
          ))}
        </div>
      </Row>
      <Row
        title="Place names"
        help="Title a walk or a workout with the Location block beside it, such as Walk · Home → Park. A block you renamed is left alone."
      >
        <Lamp id="trk-set-auto-places" label="Add place names" checked={state.places} onChange={(places) => setAutoTrack({ places })} />
      </Row>
      <Row title="Last sync" help={autoTrackLine(state)}>
        <button type="button" data-no95="" className="trk-set-primary" disabled={busy} onClick={() => void syncNow()}>
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </Row>
    </div>
  )
}
