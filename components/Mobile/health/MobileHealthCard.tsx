/**
 * components/Mobile/health/MobileHealthCard.tsx — Import Apple Health from the phone.
 *
 * On the iPhone app this reads the whole Health history, one month at a time.
 * In the browser and in Electron the same control is here, and it says the
 * import runs in the iPhone app.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { importAllHealth, isHealthPluginAvailable, openHealthSettings } from "@/lib/mobile/health-bridge"

export function MobileHealthCard() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [denied, setDenied] = useState(false)
  const onPhone = isHealthPluginAvailable()

  const run = async () => {
    setBusy(true)
    setDenied(false)
    setNote(onPhone ? "Starting…" : "")
    try {
      const result = await importAllHealth((line) => setNote(line))
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
