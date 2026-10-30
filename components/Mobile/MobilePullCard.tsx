/**
 * Phone: refresh the memory window onto the Mac file.
 * A desk render of this card still pulls `/api/sync`. The phone does not.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { getPhoneWindowSnapshot, loadPhoneWindow, phoneWindowNote, subscribePhoneWindow } from "@/lib/phone-window"
import {
  fetchMobileSyncStatus,
  pullAndRestoreMobileSync,
  readMobileSyncUrl,
  loadBundledHubUrl,
  writeMobileSyncUrl,
} from "@/lib/mobile-sync"

function PhoneWindowCard() {
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState(readMobileSyncUrl)
  const [snap, setSnap] = useState(getPhoneWindowSnapshot)
  const status = snap.status

  useEffect(() => subscribePhoneWindow(() => setSnap(getPhoneWindowSnapshot())), [])

  useEffect(() => {
    let cancelled = false
    loadBundledHubUrl().then((next) => {
      if (!cancelled && next) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = async () => {
    setBusy(true)
    writeMobileSyncUrl(url.trim())
    try {
      await loadPhoneWindow()
    } finally {
      setBusy(false)
      setSnap(getPhoneWindowSnapshot())
    }
  }

  const note = phoneWindowNote(status) ?? (status === "live" ? "Mac answered." : "Opening the Mac…")

  return (
    <div className="cogs-mobile-pullcard">
      <div className="cogs-mobile-pullcard-row">
        <strong>Desktop data</strong>
        <span className={status === "live" ? "ok" : "warn"}>{busy && status !== "loading" ? "Working…" : note}</span>
      </div>
      <label className="cogs-mobile-pullcard-row">
        Hub
        <input
          className="w-full border px-1"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <Button type="button" className="m-keycap w-full" disabled={busy} onClick={refresh}>
        Refresh from Mac
      </Button>
    </div>
  )
}

function DeskPullCard() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Checking desktop hub…")
  const [hasData, setHasData] = useState(false)
  const [url, setUrl] = useState(readMobileSyncUrl)

  useEffect(() => {
    let cancelled = false
    loadBundledHubUrl().then((next) => {
      if (!cancelled && next) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await fetchMobileSyncStatus(url)
        if (cancelled) return
        setHasData(status.hasData)
        setMessage(
          status.hasData
            ? `Desktop hub ready (${status.exportedAt ?? status.updatedAt}). Pull to load it here.`
            : "Hub empty — on Mac Electron at localhost:3000 open Settings → Force push now.",
        )
      } catch {
        if (!cancelled) {
          setHasData(false)
          setMessage(`Can't reach ${url}/api/sync. On a phone, set the hub to the Mac's address, such as http://192.168.0.150:3000.`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  const pull = async () => {
    const ok = window.confirm(
      "Replace data on THIS phone with the desktop hub snapshot? Desktop is not changed.",
    )
    if (!ok) return
    setBusy(true)
    setMessage("Pulling…")
    const hub = url.trim().replace(/\/+$/, "")
    writeMobileSyncUrl(hub)
    try {
      const result = await pullAndRestoreMobileSync(hub)
      if (!result.restored) {
        setMessage("Hub has no snapshot yet. Force push from desktop Settings first.")
        setBusy(false)
        return
      }
      setMessage(`Loaded ${result.stores} stores — reloading…`)
      window.location.reload()
    } catch (err) {
      setMessage(`Pull failed: ${err instanceof Error ? err.message : "error"}`)
      setBusy(false)
    }
  }

  return (
    <div className="cogs-mobile-pullcard">
      <div className="cogs-mobile-pullcard-row">
        <strong>Desktop data</strong>
        <span className={hasData ? "ok" : "warn"}>{busy ? "Working…" : message}</span>
      </div>
      <label className="cogs-mobile-pullcard-row">
        Hub
        <input
          className="w-full border px-1"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <Button type="button" className="m-keycap w-full" disabled={busy || !hasData} onClick={pull}>
        Pull desktop data onto phone
      </Button>
    </div>
  )
}

export function MobilePullCard() {
  if (isPhoneWebStorage()) return <PhoneWindowCard />
  return <DeskPullCard />
}
