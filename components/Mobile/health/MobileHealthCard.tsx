/**
 * components/Mobile/health/MobileHealthCard.tsx — Apple Health on the phone: automatic sync and the full import.
 *
 * In the iPhone app the first row is the automatic sync (`lib/mobile/auto-track.ts`):
 * its last result, an on/off key, and Sync now. The second is the full import.
 *
 * On the iPhone app this reads the whole Health history, one month at a time.
 * In the browser and in Electron the same control is here, and it says the
 * import runs in the iPhone app.
 */
"use client"

import { useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { importAllHealth, isHealthPluginAvailable, openHealthSettings } from "@/lib/mobile/health-bridge"
import {
  autoTrackLine,
  autoTrackMergeOptions,
  getAutoTrack,
  getAutoTrackServerSnapshot,
  runAutoTrack,
  setAutoTrack,
  subscribeAutoTrack,
} from "@/lib/mobile/auto-track"

export function MobileHealthCard() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [denied, setDenied] = useState(false)
  const onPhone = isHealthPluginAvailable()
  const auto = useSyncExternalStore(subscribeAutoTrack, getAutoTrack, getAutoTrackServerSnapshot)

  const syncNow = async () => {
    setBusy(true)
    try {
      await runAutoTrack({ force: true })
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    setBusy(true)
    setDenied(false)
    setNote(onPhone ? "Starting…" : "")
    try {
      const result = await importAllHealth((line) => setNote(line), autoTrackMergeOptions(getAutoTrack()))
      setNote(result.message)
      setDenied(result.status === "denied")
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cogs-mobile-pullcard" data-ui-name="Health import">
      {onPhone ? (
        <>
          <div className="cogs-mobile-pullcard-row" data-ui-name="Auto tracking">
            <strong>Auto tracking</strong>
            <span>Walks, workouts, and sleep land on Tracking each time the app opens.</span>
            <span role="status">{autoTrackLine(auto)}</span>
          </div>
          <Button type="button" className="m-keycap" aria-pressed={auto.on} disabled={busy} onClick={() => setAutoTrack({ on: !auto.on })}>
            {auto.on ? "Automatic: on" : "Automatic: off"}
          </Button>
          <Button type="button" className="m-keycap" disabled={busy} onClick={() => void syncNow()}>
            Sync now
          </Button>
        </>
      ) : null}
      <div className="cogs-mobile-pullcard-row">
        <strong>Health</strong>
        <span>Steps, distance, flights, active energy, heart rate, sleep, and workouts. The whole history.</span>
        {note ? <span role="status">{note}</span> : null}
      </div>
      <Button type="button" className="m-keycap" disabled={busy} onClick={() => void run()}>
        {busy ? "Importing…" : "Import all history"}
      </Button>
      {denied && onPhone ? (
        <Button type="button" className="m-keycap" disabled={busy} onClick={() => void openHealthSettings()}>
          Open iPhone Settings
        </Button>
      ) : null}
    </div>
  )
}
