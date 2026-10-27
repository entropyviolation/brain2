/**
 * components/Home/Tracking/entry-dialog/entry-variants.tsx — Details that count as this pen
 *
 * The parent omits the section when no pen is selected. No hooks.
 */
"use client"

import { Label } from "@/components/ui/label"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import type { TrackPen } from "@/lib/time-tracking-store"

export function EntryVariants({
  pen,
  liveVariantIds,
  scopeId,
  onToggle,
  onCreate,
  onAddCrossView,
}: {
  pen: TrackPen
  liveVariantIds: string[]
  scopeId: string
  onToggle: (id: string) => void
  onCreate: (name: string) => void
  onAddCrossView: (viewId: string, otherPenId: string) => void
}) {
  return (
    <div className="trk-section space-y-1.5">
      <Label className="trk-section-title">{pen.variantLabel || "Detail"}</Label>
      <p className="trk-help">
        Tick every one that applies. Each option is a pen that counts as {pen.name} — add one here or nest a
        pen under it, and it shows in both places. Double-click an option to open that pen. Analytics shows{" "}
        {pen.name} as a whole first, then splits it by these. Typing under Add also lists pens from other
        views — a Company person can be a detail of an Activity pen.
      </p>
      <VariantChips
        pen={pen}
        selected={liveVariantIds}
        onToggle={onToggle}
        onCreate={onCreate}
        onOpenPen={(id, viewId) => openPenSettings(viewId ?? scopeId, id)}
        ownerScopeId={scopeId}
        onAddCrossView={onAddCrossView}
      />
    </div>
  )
}
