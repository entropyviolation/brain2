/**
 * components/Mobile/MobileSyncBar.tsx — Push/pull controls for the shared sync server.
 *
 * Defaults the sync URL to the page hostname (LAN) so a phone never tries
 * 127.0.0.1. Auto-seeds when this device looks empty. Reload after pull so
 * Zustand stores remount with desktop data.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  fetchMobileSyncStatus,
  guessMobileSyncUrl,
  mobileClientLooksEmpty,
  pullAndRestoreMobileSync,
  pushCurrentMobileSync,
  readMobileSyncUrl,
  writeMobileSyncUrl,
} from "@/lib/mobile-sync"

type Props = {
  autoPullOnMount?: boolean
}

export function MobileSyncBar({ autoPullOnMount = false }: Props) {
  const [url, setUrl] = useState(() => readMobileSyncUrl())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>("Connecting to sync…")
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    writeMobileSyncUrl(url)
  }, [url])

  const pullAndReload = async (baseUrl: string, confirmFirst: boolean) => {
    if (confirmFirst) {
      const ok = window.confirm(
        "Pull will REPLACE data on THIS phone with the desktop sync snapshot. Desktop is not modified. Continue?",
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      writeMobileSyncUrl(baseUrl)
      const result = await pullAndRestoreMobileSync(baseUrl)
      if (!result.restored) {
        setMessage("No snapshot yet — on Mac run npm run mobile:sync, then Settings → Mobile Sync → Push to phone.")
        setBusy(false)
        return
      }
      setMessage(`Pulled ${result.stores} stores — reloading…`)
      window.location.reload()
    } catch (err) {
      setMessage(
        `Pull failed: ${err instanceof Error ? err.message : "unreachable"}. Is npm run mobile:sync running on your Mac?`,
      )
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!autoPullOnMount) return
    let cancelled = false
    ;(async () => {
      const resolved = readMobileSyncUrl() || guessMobileSyncUrl()
      if (!cancelled) setUrl(resolved)
      try {
        const status = await fetchMobileSyncStatus(resolved)
        if (cancelled) return
        if (!status.hasData) {
          setMessage("Sync online, but empty. On Mac: Settings → Mobile Sync → Push to phone.")
          setCollapsed(false)
          return
        }
        if (mobileClientLooksEmpty()) {
          setMessage("Found desktop snapshot — loading…")
          await pullAndReload(resolved, false)
          return
        }
        setMessage(`Desktop snapshot ready (${status.exportedAt ?? status.updatedAt}). Tap Pull to refresh.`)
        setCollapsed(true)
      } catch (err) {
        if (!cancelled) {
          setMessage(
            `Sync offline (${err instanceof Error ? err.message : "unreachable"}). On Mac run: npm run mobile:dev  (or npm run mobile:sync). URL should be ${guessMobileSyncUrl()}`,
          )
          setCollapsed(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPullOnMount])

  const handlePush = async () => {
    setBusy(true)
    try {
      writeMobileSyncUrl(url)
      const result = await pushCurrentMobileSync(url)
      setMessage(`Pushed at ${result.updatedAt}. Local data kept.`)
    } catch (err) {
      setMessage(`Push failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async () => {
    setBusy(true)
    try {
      writeMobileSyncUrl(url)
      const status = await fetchMobileSyncStatus(url)
      setMessage(
        status.hasData
          ? `Server OK — snapshot ${status.exportedAt ?? status.updatedAt}.`
          : "Server OK — empty (push from desktop first).",
      )
    } catch (err) {
      setMessage(`Status failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cogs-mobile-syncbar">
      <div className="cogs-mobile-syncbar-row">
        <strong>Desktop sync</strong>
        <button type="button" className="cogs-mobile-syncbar-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      <p className="cogs-mobile-syncbar-status">{busy ? "Working…" : message}</p>
      {!collapsed ? (
        <>
          <div className="cogs-mobile-syncbar-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={guessMobileSyncUrl()}
              aria-label="Sync server URL"
            />
          </div>
          <div className="cogs-mobile-syncbar-row cogs-mobile-syncbar-actions">
            <Button type="button" size="sm" className="flex-1" disabled={busy} onClick={() => pullAndReload(url, true)}>
              Pull desktop data
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleStatus}>
              Status
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handlePush}>
              Push
            </Button>
          </div>
        </>
      ) : (
        <div className="cogs-mobile-syncbar-row cogs-mobile-syncbar-actions">
          <Button type="button" size="sm" className="flex-1" disabled={busy} onClick={() => pullAndReload(url, true)}>
            Pull desktop data
          </Button>
        </div>
      )}
    </div>
  )
}
