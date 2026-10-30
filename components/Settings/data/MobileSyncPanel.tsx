/**
 * components/Settings/data/MobileSyncPanel.tsx — Manual mobile hub controls.
 *
 * Continuous live sync is parked while the core app is finished. A dedicated
 * semi-mobile live sync component will land after that. This panel only
 * explains the pause and keeps rare manual hub push/pull.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone } from "lucide-react"
import {
  deviceNeedsPhoneHubPull,
  fetchMobileSyncStatus,
  pullAndRestoreMobileSync,
  pushCurrentMobileSync,
  readMobileSyncUrl,
  loadBundledHubUrl,
  writeMobileSyncUrl,
} from "@/lib/mobile-sync"

export function MobileSyncPanel() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [url, setUrl] = useState(() => (typeof window !== "undefined" ? readMobileSyncUrl() : ""))
  const hub = url.trim().replace(/\/+$/, "")

  useEffect(() => {
    let cancelled = false
    loadBundledHubUrl().then((next) => {
      if (!cancelled && next) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePush = async () => {
    setBusy(true)
    try {
      const result = await pushCurrentMobileSync(hub)
      writeMobileSyncUrl(hub)
      setStatus(`Forced push at ${result.updatedAt}.`)
    } catch (err) {
      setStatus(`Push failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async () => {
    setBusy(true)
    try {
      const result = await fetchMobileSyncStatus(hub)
      setStatus(
        result.hasData
          ? `Hub OK — last snapshot ${result.exportedAt ?? result.updatedAt}`
          : "Hub OK — empty (force-push from this Mac if the phone needs data).",
      )
    } catch (err) {
      setStatus(`Status failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePull = async () => {
    const phone = deviceNeedsPhoneHubPull()
    const confirmed = window.confirm(
      phone
        ? "Replace data on THIS phone with the hub's phone copy? Photos and long notes stay on the Mac. Desktop is not changed."
        : "Manual pull replaces THIS device's data with the shared hub snapshot. Continue?",
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const result = await pullAndRestoreMobileSync(hub, "admin", "admin", !phone)
      if (!result.restored) {
        setStatus("No snapshot on the hub yet.")
        return
      }
      if (phone) {
        setStatus(`Pulled ${result.stores} stores — reloading…`)
        window.location.reload()
        return
      }
      setStatus(`Pulled ${result.stores} stores + ${result.planText} plan entries.`)
    } catch (err) {
      setStatus(`Pull failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        <h3 className="font-semibold">Phone ↔ Desktop Live Sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Continuous live sync is paused for now. We are getting the rest of Brain2 solid
        first, then a dedicated <strong>semi-mobile live sync</strong> component will
        land. Until then, phones can still use a one-tap manual pull on{" "}
        <code className="text-xs">/mobile/</code>, and the buttons below are only for
        rare hub overrides.
      </p>
      <label className="block text-xs text-muted-foreground">
        Hub
        <input
          className="mt-1 w-full border bg-background px-2 py-1 text-sm text-foreground"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleStatus}>
          Check hub
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handlePush}>
          Force push now
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={handlePull}>
          Force pull now
        </Button>
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  )
}
