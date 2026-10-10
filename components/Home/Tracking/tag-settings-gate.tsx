/**
 * components/Home/Tracking/tag-settings-gate.tsx — Tag settings once a target exists
 *
 * Loaded by `tag-settings-host.tsx` only after the open bus delivers a tag.
 * This module reads the timegrid store and renders `TagSettingsDialog`.
 * Close and delete clear the target on the host, which drops this gate.
 * Create-from-name stays open until Cancel, or until Create Tracking tag
 * switches the bus onto the new id.
 */
"use client"

import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TagSettingsDialog } from "@/components/Home/Tracking/tag-settings-dialog"
import type { TagSettingsTarget } from "@/components/Home/Tracking/open-tag-settings"

export function TagSettingsGate({
  target,
  onClear,
}: {
  target: TagSettingsTarget
  onClear: () => void
}) {
  const tag = useTimeTrackingStore((s) =>
    target.kind === "id" ? s.tags.find((item) => item.id === target.tagId) : undefined,
  )

  if (target.kind === "create") {
    return (
      <TagSettingsDialog
        key={`create:${target.name}`}
        mode="create"
        name={target.name}
        onClose={onClear}
      />
    )
  }

  if (!tag) return null
  return (
    <TagSettingsDialog
      key={tag.id}
      mode="edit"
      tag={tag}
      onClose={onClear}
      onDeleted={onClear}
    />
  )
}

export default TagSettingsGate
