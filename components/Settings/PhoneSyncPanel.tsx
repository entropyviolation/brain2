/**
 * components/Settings/PhoneSyncPanel.tsx — Settings → Phone sync
 *
 * One row per source: on/off for the readers that exist, the permission each
 * one needs, and the last run from `data/phone-sync/runs.json`. The log stays
 * on this Mac (`/api/phone-sync`, loopback). Turning a source off is read on
 * the hub's next tick. Planned sources (Health, phone Screen Time, email, DMs)
 * are listed and have no switch.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Smartphone } from "lucide-react"
import { PHONE_SYNC_ROWS, latestRun, type PhoneSyncRow } from "@/lib/phone-sync/status"
import type { PhoneSyncRun, PhoneSyncSource } from "@/lib/phone-sync/types"

type StatusPayload = {
  ok?: boolean
  runs?: PhoneSyncRun[]
  enabled?: Partial<Record<PhoneSyncSource, boolean>>
  error?: string
}

function runLine(run: PhoneSyncRun | null): string {
  if (!run) return "No run yet."
  const when = new Date(run.finishedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  const counts = `read ${run.read}, wrote ${run.written}, skipped ${run.skipped}`
  return run.error ? `${when}. ${counts}. ${run.error}` : `${when}. ${counts}.`
}

export function PhoneSyncPanel() {
  const [runs, setRuns] = useState<PhoneSyncRun[]>([])
  const [enabled, setEnabled] = useState<Partial<Record<PhoneSyncSource, boolean>>>({})
  const [note, setNote] = useState<string | null>(null)
  const [reachable, setReachable] = useState(false)
  const [busy, setBusy] = useState<PhoneSyncSource | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/phone-sync/status")
      const body = (await res.json()) as StatusPayload
      if (!res.ok || body.ok === false) {
        setReachable(false)
        setNote(body.error || "The phone sync log did not answer.")
        return
      }
      setRuns(Array.isArray(body.runs) ? body.runs : [])
      setEnabled(body.enabled ?? {})
      setReachable(true)
      setNote(null)
    } catch {
      setReachable(false)
      setNote("The phone sync log did not answer. It is served on this Mac, at localhost.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (row: PhoneSyncRow) => {
    if (!row.switchable || !reachable) return
    const on = enabled[row.id] === false
    setBusy(row.id)
    try {
      const res = await fetch("/api/phone-sync/enabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: row.id, on }),
      })
      const body = (await res.json()) as StatusPayload
      if (!res.ok || body.ok === false) {
        setNote(body.error || "Could not save that switch.")
        return
      }
      setEnabled(body.enabled ?? {})
      setNote(null)
    } catch {
      setNote("Could not save that switch.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        <h3 className="font-semibold">Phone sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Texts and calls are read on this Mac. Location comes from the iPhone app. A switch takes effect on the hub’s
        next pass. This is not the manual pull on <code className="text-xs">/mobile/</code>.
      </p>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <ul className="space-y-3">
        {PHONE_SYNC_ROWS.map((row) => {
          const on = enabled[row.id] !== false
          const last = latestRun(runs, row.id)
          return (
            <li key={row.id} className="space-y-1 border-t border-dashed pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{row.title}</strong>
                {row.switchable ? (
                  <button
                    type="button"
                    className="min-h-8 border px-2 text-xs"
                    aria-pressed={on}
                    disabled={!reachable || busy === row.id}
                    onClick={() => void toggle(row)}
                  >
                    {on ? "On" : "Off"}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Not built yet</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{row.needs}</p>
              {row.switchable ? <p className="text-xs">{runLine(last)}</p> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
