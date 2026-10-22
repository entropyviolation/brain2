/**
 * components/Mobile/MobileLocationCard.tsx — Turn on iPhone location from the app.
 *
 * Shows only in the iOS build, where the `BrainLocation` plugin exists
 * (`lib/mobile/location-bridge.ts`). Setup takes the capture box's upload URL,
 * the upload-only token and the capture public key. The plugin keeps them on
 * the phone, so this card stores nothing itself. Turn on asks for "While
 * Using", then "Always", then starts recording.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  configureLocationUpload,
  flushLocationQueue,
  getLocationStatus,
  isLocationPluginAvailable,
  locationChip,
  requestAlwaysLocation,
  startLocationRecording,
  stopLocationRecording,
  type LocationStatus,
} from "@/lib/mobile/location-bridge"

const POLL_MS = 15000

export function MobileLocationCard() {
  const [status, setStatus] = useState<LocationStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [setupOpen, setSetupOpen] = useState(false)
  const [uploadUrl, setUploadUrl] = useState("")
  const [token, setToken] = useState("")
  const [publicKey, setPublicKey] = useState("")

  const refresh = useCallback(async () => {
    const next = await getLocationStatus()
    setStatus(next)
    return next
  }, [])

  useEffect(() => {
    if (!isLocationPluginAvailable()) return
    void refresh().then((s) => {
      if (!s.configured) setSetupOpen(true)
    })
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  if (!status?.available) return null

  const run = async (label: string, work: () => Promise<string | void>) => {
    setBusy(true)
    setNote(label)
    try {
      setNote((await work()) ?? "")
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  const save = () =>
    run("Saving…", async () => {
      await configureLocationUpload({ uploadUrl: uploadUrl.trim(), token: token.trim(), publicKey: publicKey.trim() })
      setToken("")
      setSetupOpen(false)
      return "Upload saved on this phone."
    })

  const turnOn = () =>
    run("Asking for location…", async () => {
      const permission = await requestAlwaysLocation()
      if (permission === "denied" || permission === "restricted") {
        return "Location is off for Brain2. Turn it on in iPhone Settings → Brain2 → Location → Always."
      }
      await startLocationRecording()
      return permission === "always" ? "Recording." : "Recording. Choose Always in iPhone Settings so the day has no gaps."
    })

  const turnOff = () => run("Stopping…", async () => (await stopLocationRecording(), "Location is off."))

  const sendNow = () =>
    run("Sending…", async () => ((await flushLocationQueue()) ? "Sent." : "Not sent. Check the upload setup and your connection."))

  const chip = locationChip(status)
  const canSave = uploadUrl.trim() !== "" && token.trim() !== "" && publicKey.trim() !== ""

  return (
    <div className="cogs-mobile-pullcard" data-ui-name="Location">
      <div className="cogs-mobile-pullcard-row">
        <strong>Location</strong>
        <span className={chip.tone === "warn" ? "warn" : chip.tone === "ok" ? "ok" : undefined}>{chip.label}</span>
        {status.lastError ? <span className="warn">Last error: {status.lastError}</span> : null}
        {note ? <span>{note}</span> : null}
      </div>

      {setupOpen ? (
        <div className="cogs-mobile-pullcard-row">
          <label>
            Upload URL
            <input
              className="w-full border px-1"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="http://100.x.y.z:8788/upload"
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
            />
          </label>
          <label>
            Upload token
            <input
              className="w-full border px-1"
              type="password"
              autoCapitalize="off"
              autoCorrect="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label>
            Capture public key
            <textarea
              className="w-full border px-1"
              rows={3}
              autoCapitalize="off"
              autoCorrect="off"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </label>
          <Button type="button" className="w-full" disabled={busy || !canSave} onClick={save}>
            Save upload
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status.recording ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={turnOff}>
            Turn off
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy || !status.configured} onClick={turnOn}>
            Turn on
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy || status.queued === 0} onClick={sendNow}>
          Send now
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSetupOpen((open) => !open)}>
          {setupOpen ? "Hide setup" : "Upload setup"}
        </Button>
      </div>
    </div>
  )
}
