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

type PenSettingsGateProps = {
  target: PenSettingsTarget
  onClear: () => void
}

export function PenSettingsHost() {
  const [target, setTarget] = useState<PenSettingsTarget | null>(null)
  const [Gate, setGate] = useState<ComponentType<PenSettingsGateProps> | null>(null)

  useEffect(() => subscribePenSettings(setTarget), [])

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
  return <Gate target={target} onClear={() => setTarget(null)} />
}
