/**
 * components/Home/Tracking/tag-settings-host.tsx — One tag-settings dialog
 *
 * Mounted once on the app page. Until a tag (or create-from-name) is chosen it
 * only subscribes to `subscribeTagSettings` and renders null. It does not
 * import the timegrid. A target loads `tag-settings-gate.tsx`, which reads the
 * store and opens `TagSettingsDialog`. Double-click a tag chip (habit form,
 * tag library) and this opens. A refresh should not JSON.parse the timegrid
 * blob before the desk paints.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import { subscribeTagSettings, type TagSettingsTarget } from "@/components/Home/Tracking/open-tag-settings"

type TagSettingsGateProps = {
  target: TagSettingsTarget
  onClear: () => void
}

export function TagSettingsHost() {
  const [target, setTarget] = useState<TagSettingsTarget | null>(null)
  const [Gate, setGate] = useState<ComponentType<TagSettingsGateProps> | null>(null)

  useEffect(() => subscribeTagSettings(setTarget), [])

  useEffect(() => {
    if (!target || Gate) return
    let cancelled = false
    void import("./tag-settings-gate").then((mod) => {
      if (!cancelled) setGate(() => mod.TagSettingsGate)
    })
    return () => {
      cancelled = true
    }
  }, [target, Gate])

  if (!target || !Gate) return null
  return <Gate target={target} onClear={() => setTarget(null)} />
}
