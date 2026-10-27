/**
 * components/Settings/ScreenTimePanel.tsx — ActivityWatch connection for Screen Time
 *
 * Brain2 reads a running ActivityWatch server. It is not a window watcher.
 * Prefs auto-save; Sync now calls `syncScreenTime()` directly.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_SCREENTIME_PREFS, loadScreenTimePrefs, saveScreenTimePrefs } from "@/lib/screentime/prefs"
import { describeScreenTimeSync, fetchScreenTime, syncScreenTime } from "@/lib/screentime/sync"

type Lamp = "gray" | "green" | "red"

export function ScreenTimePanel() {
  const [url, setUrl] = useState(DEFAULT_SCREENTIME_PREFS.url)
  const [lookbackDays, setLookbackDays] = useState(DEFAULT_SCREENTIME_PREFS.lookbackDays)
  const [minDurationSec, setMinDurationSec] = useState(DEFAULT_SCREENTIME_PREFS.minDurationSec)
  const [storeWindowTitles, setStoreWindowTitles] = useState(DEFAULT_SCREENTIME_PREFS.storeWindowTitles)
  const [lastSuccessAt, setLastSuccessAt] = useState<string | undefined>()
  const [lastSyncNote, setLastSyncNote] = useState<string | undefined>()
  const [lamp, setLamp] = useState<Lamp>("gray")
  const [syncNote, setSyncNote] = useState<string | null>(null)

  useEffect(() => {
    const prefs = loadScreenTimePrefs()
    setUrl(prefs.url)
    setLookbackDays(prefs.lookbackDays)
    setMinDurationSec(prefs.minDurationSec)
    setStoreWindowTitles(prefs.storeWindowTitles)
    setLastSuccessAt(prefs.lastSuccessAt)
    setLastSyncNote(prefs.lastSyncNote)
  }, [])

  const persist = useCallback(
    (patch: Partial<ReturnType<typeof loadScreenTimePrefs>>) => {
      const next = {
        ...loadScreenTimePrefs(),
        url,
        lookbackDays,
        minDurationSec,
        storeWindowTitles,
        ...patch,
      }
      saveScreenTimePrefs(next)
      setUrl(next.url)
      setLookbackDays(next.lookbackDays)
      setMinDurationSec(next.minDurationSec)
      setStoreWindowTitles(next.storeWindowTitles)
      setLastSuccessAt(next.lastSuccessAt)
      setLastSyncNote(next.lastSyncNote)
    },
    [lookbackDays, minDurationSec, storeWindowTitles, url],
  )

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const result = await fetchScreenTime({ mode: "health", url })
        if (cancelled) return
        setLamp(result && (result as { ok?: boolean }).ok !== false ? "green" : "red")
      } catch {
        if (!cancelled) setLamp("red")
      }
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [url])

  const handleSync = async () => {
    setSyncNote("Syncing…")
    try {
      const result = await syncScreenTime()
      const prefs = loadScreenTimePrefs()
      setLastSuccessAt(prefs.lastSuccessAt)
      const note = result.note || describeScreenTimeSync(result)
      setLastSyncNote(prefs.lastSyncNote ?? note)
      setSyncNote(null)
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : "ActivityWatch is not reachable.")
    }
  }

  const lampColor = lamp === "green" ? "#22c55e" : lamp === "red" ? "#ef4444" : "#9ca3af"
  const lampLabel = lamp === "green" ? "ActivityWatch reachable" : lamp === "red" ? "ActivityWatch unreachable" : "Checking ActivityWatch"

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed p-4"
      data-ui-name="Screen Time settings"
      data-ui-docs="components/Settings/README.md"
    >
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4" />
        <h3 className="font-semibold">Screen Time</h3>
        <span
          className="ml-1 inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: lampColor }}
          title={lampLabel}
          aria-label={lampLabel}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Brain2 reads a running ActivityWatch server. It is not a window watcher, and it cannot
        import Apple Screen Time or anything from before the watchers started. Phone usage is a
        different Tracking view — iPhone Screen Time, Calls, and Texts — via Telegram / Shortcuts, not this sync.
      </p>

      <div className="space-y-2">
        <Label htmlFor="screentime-url">ActivityWatch URL</Label>
        <Input
          id="screentime-url"
          value={url}
          onChange={(e) => persist({ url: e.target.value || DEFAULT_SCREENTIME_PREFS.url })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="screentime-lookback">Lookback days</Label>
          <Input
            id="screentime-lookback"
            type="number"
            min={1}
            value={lookbackDays}
            onChange={(e) => persist({ lookbackDays: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="screentime-min">Min duration (seconds)</Label>
          <Input
            id="screentime-min"
            type="number"
            min={0}
            value={minDurationSec}
            onChange={(e) => persist({ minDurationSec: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border border-primary"
          checked={storeWindowTitles}
          onChange={(e) => persist({ storeWindowTitles: e.target.checked })}
        />
        <span>Store window titles (off by default)</span>
      </label>

      <Button type="button" variant="outline" onClick={() => void handleSync()}>
        Sync now
      </Button>
      <p className="text-xs text-muted-foreground">
        {lastSuccessAt
          ? `Last success ${new Date(lastSuccessAt).toLocaleString()}.`
          : "No successful sync yet."}
        {lastSyncNote ? ` ${lastSyncNote}` : ""}
        {syncNote ? ` ${syncNote}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Install{" "}
        <a className="underline" href="https://github.com/ActivityWatch/activitywatch/releases" target="_blank" rel="noreferrer">
          ActivityWatch
        </a>
        . On macOS, grant Accessibility:{" "}
        <a
          className="underline"
          href="x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
          target="_blank"
          rel="noreferrer"
        >
          System Settings → Privacy &amp; Security → Accessibility
        </a>
        .
      </p>
    </div>
  )
}
