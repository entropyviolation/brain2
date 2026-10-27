/**
 * components/ItemDetail/chrome/WorkingNowBanner.tsx — Live clock strip
 *
 * A small recording lamp at the top of item detail while this item is the
 * pen clock's task, or a parent of that item. Electric blue is the one
 * accent for this live state. _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo } from "react"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useTaskStore } from "@/lib/task-store"
import { workingNowBannerFor } from "@/lib/working-now-banner"

export function WorkingNowBanner({ itemId }: { itemId: string }) {
  const session = usePenColorSessionStore((s) => s.session)
  const tasks = useTaskStore((s) => s.tasks)
  const info = useMemo(
    () => workingNowBannerFor(itemId, tasks, session),
    [itemId, tasks, session],
  )
  if (!info) return null
  const label = info.live ? "Working on this now" : `Working on ${info.liveTitle} now`
  return (
    <div className="id-now-banner" role="status" data-testid="working-now-banner">
      <span className="id-now-lamp" aria-hidden />
      <span className="id-now-banner-text">{label}</span>
    </div>
  )
}
