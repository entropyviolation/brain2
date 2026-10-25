/**
 * components/Home/Tracking/pen-settings-host.tsx — One pen-settings dialog
 *
 * Mounted once on the app page. Until a pen is chosen it only subscribes to
 * `subscribePenSettings` and renders null. It does not import the timegrid.
 * A target loads `pen-settings-gate.tsx`, which reads the store and opens
 * `PenSettingsDialog`. Double-click a pen color (block editor, palette,
 * activity log, analytics) and this opens. The dialog itself can still walk
 * to another pen via the counts-as chain. A refresh should not JSON.parse
 * the timegrid blob before the desk paints.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import { subscribePenSettings, type PenSettingsTarget } from "@/components/Home/Tracking/open-pen-settings"
import { subscribeTimegridReveal } from "@/components/Home/Tracking/timegrid-reveal"

type PenSettingsGateProps = {
  target: PenSettingsTarget
  onClear: () => void
  nav?: PenSettingsNav
}

export interface PenSettingsNav {
  canBack: boolean
  canForward: boolean
  back: () => void
  forward: () => void
}

export function PenSettingsHost() {
  const [trail, setTrail] = useState<{ stops: PenSettingsTarget[]; at: number }>({ stops: [], at: -1 })
  const target = trail.stops[trail.at] ?? null
  const [Gate, setGate] = useState<ComponentType<PenSettingsGateProps> | null>(null)

  useEffect(() => subscribeTimegridReveal(() => setTrail({ stops: [], at: -1 })), [])

  useEffect(
    () =>
      subscribePenSettings((next) =>
        setTrail((cur) => {
          const here = cur.stops[cur.at]
          if (here && here.scopeId === next.scopeId && here.penId === next.penId) return cur
          const stops = [...cur.stops.slice(0, cur.at + 1), next]
          return { stops, at: stops.length - 1 }
        }),
      ),
    [],
  )

  useEffect(() => {
    if (!target || Gate) return
    let cancelled = false
    void import("./pen-settings-gate").then((mod) => {
      if (!cancelled) setGate(() => mod.PenSettingsGate)
    })
    return () => {
      cancelled = true
    }
  }, [target, Gate])

  if (!target || !Gate) return null
  const nav: PenSettingsNav = {
    canBack: trail.at > 0,
    canForward: trail.at < trail.stops.length - 1,
    back: () => setTrail((cur) => (cur.at > 0 ? { ...cur, at: cur.at - 1 } : cur)),
    forward: () => setTrail((cur) => (cur.at < cur.stops.length - 1 ? { ...cur, at: cur.at + 1 } : cur)),
  }
  return <Gate target={target} nav={nav} onClear={() => setTrail({ stops: [], at: -1 })} />
}
