/**
 * components/Home/Tracking/pen-settings-gate.tsx — Pen settings once a target exists
 *
 * Loaded by `pen-settings-host.tsx` only after the open bus delivers a pen.
 * This module reads the timegrid store and renders `PenSettingsDialog`.
 * Close and delete clear the target on the host, which drops this gate.
 */
"use client"

import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { PenSettingsDialog } from "@/components/Home/Tracking/pen-settings-dialog"
import type { PenSettingsTarget } from "@/components/Home/Tracking/open-pen-settings"

export function PenSettingsGate({
  target,
  onClear,
}: {
  target: PenSettingsTarget
  onClear: () => void
}) {
  const pen = useTimeTrackingStore((s) =>
    s.scopes.find((scope) => scope.id === target.scopeId)?.pens.find((item) => item.id === target.penId),
  )

  if (!pen) return null
  return (
    <PenSettingsDialog
      key={`${target.scopeId}:${target.penId}`}
      scopeId={target.scopeId}
      pen={pen}
      onClose={onClear}
      onDeleted={onClear}
    />
  )
}

export default PenSettingsGate
