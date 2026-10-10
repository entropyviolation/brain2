/**
 * components/header-now-box.tsx — Header "now" well for live work timers
 *
 * Always mounted from AppHeader. While both sessions are idle this module
 * reads only the session flags (`useWorkSessionStore`, `usePenColorSessionStore`)
 * and returns null. It does not import the timegrid. A live Operations or
 * pen-color session loads `header-now-rows.tsx` for the clocks, pause, stop,
 * and pen color. A refresh should not JSON.parse the timegrid blob before
 * the desk paints.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useWorkSessionStore } from "@/lib/work-session-store"

export function HeaderNowBox() {
  const workLive = useWorkSessionStore((s) => s.session != null)
  const penLive = usePenColorSessionStore((s) => s.session != null)
  const live = workLive || penLive
  const [Rows, setRows] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!live || Rows) return
    let cancelled = false
    void import("./header-now-rows").then((mod) => {
      if (!cancelled) setRows(() => mod.HeaderNowRows)
    })
    return () => {
      cancelled = true
    }
  }, [live, Rows])

  if (!live || !Rows) return null
  return <Rows />
}

export default HeaderNowBox
