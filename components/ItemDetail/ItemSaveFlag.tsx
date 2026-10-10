/**
 * components/ItemDetail/ItemSaveFlag.tsx — Saved / unsaved lamp
 *
 * Always on the item-detail fascia. Green when the live draft matches the
 * stored item, amber while it does not — including keystrokes that have not
 * re-rendered the rest of the view. Save Changes turns it back to Saved.
 */
"use client"

import { useSyncExternalStore } from "react"
import type { Task } from "@/lib/types"
import { snapshotsEqual } from "@/lib/unsaved-changes"

export function ItemSaveFlag({
  originalTask,
  getDraft,
  subscribeDraft,
}: {
  originalTask: Task | null
  getDraft: () => Task | null
  subscribeDraft: (listener: () => void) => () => void
}) {
  const draft = useSyncExternalStore(subscribeDraft, getDraft, getDraft)
  const dirty = Boolean(draft && originalTask && !snapshotsEqual(draft, originalTask))

  return (
    <span className={dirty ? "id-save-flag is-unsaved" : "id-save-flag is-saved"} role="status">
      <span className="id-save-flag-lamp" aria-hidden />
      {dirty ? "Unsaved changes" : "Saved"}
    </span>
  )
}
