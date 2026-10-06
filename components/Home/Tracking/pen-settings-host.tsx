/**
 * components/Home/Tracking/pen-settings-host.tsx — One pen-settings dialog
 *
 * Mounted once on the app page. Double-click a pen color (block editor, palette,
 * activity log, analytics) and this opens. The dialog itself can still walk to
 * another pen via the counts-as chain.
 */
"use client"

import { useEffect, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { PenSettingsDialog } from "@/components/Home/Tracking/pen-settings-dialog"
import { subscribePenSettings, type PenSettingsTarget } from "@/components/Home/Tracking/open-pen-settings"

export function PenSettingsHost() {
  const [target, setTarget] = useState<PenSettingsTarget | null>(null)
  const pen = useTimeTrackingStore((s) =>
    target ? s.scopes.find((scope) => scope.id === target.scopeId)?.pens.find((item) => item.id === target.penId) : undefined,
  )

  useEffect(() => subscribePenSettings(setTarget), [])

  if (!target || !pen) return null
  return (
    <PenSettingsDialog
      key={`${target.scopeId}:${target.penId}`}
      scopeId={target.scopeId}
      pen={pen}
      onClose={() => setTarget(null)}
      onDeleted={() => setTarget(null)}
    />
  )
}
