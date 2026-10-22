"use client"

/**
 * Day tubes — the optional liquid / sand / hourglass view of a tracked week.
 * A popup over the Time Grid. The tubes are the standalone page at
 * `public/day-tubes/index.html` (built from `docs/mockups/slants/time-grid-lab/`,
 * `build-app.sh`), shown in an iframe. This file sends it the real week from the
 * tracking store, and moves the grid's date when the tubes page steps past the week.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatLocalDateKey } from "@/lib/date-utils"
import { displayedPen, useTimeTrackingStore } from "@/lib/time-tracking-store"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Monday on or before `d`, the first day of the tubes' week. */
function mondayOf(d: Date): Date {
  const back = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function DayTubesDialog({
  open,
  onOpenChange,
  date,
  setDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date
  setDate: (date: Date) => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const frame = useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = useState(false)
  const dateKey = formatLocalDateKey(date)

  const payload = useMemo(() => {
    if (!open) return null
    const mon = mondayOf(date)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i)
      return { date: formatLocalDateKey(d), wd: WEEKDAYS[d.getDay()], md: `${MONTHS[d.getMonth()]} ${d.getDate()}` }
    })
    /* the three weeks before this one, so the month tube holds four real weeks */
    const prior = [-3, -2, -1].map((off) => ({
      off,
      dates: Array.from({ length: 7 }, (_, i) => formatLocalDateKey(addDays(mon, off * 7 + i))),
    }))
    const byDate = new Set([...days.map((d) => d.date), ...prior.flatMap((w) => w.dates)])
    const todayKey = formatLocalDateKey(new Date())
    const now = new Date()
    const views = scopes
      .filter((sc) => sc.pens.length > 0)
      .map((sc) => {
        const pens = new Map<string, { id: string; name: string; color: string }>()
        const runs: Record<string, [number, number, string][]> = {}
        for (const e of entries) {
          if (e.scopeId !== sc.id || e.kind === "instant" || !byDate.has(e.date) || e.endMin <= e.startMin) continue
          const pen = displayedPen(sc, e.penId)
          if (!pen) continue
          pens.set(pen.id, { id: pen.id, name: pen.name, color: pen.color })
          ;(runs[e.date] ??= []).push([e.startMin, e.endMin, pen.id])
        }
        Object.values(runs).forEach((r) => r.sort((a, b) => a[0] - b[0]))
        sc.pens.forEach((p) => {
          if (!pens.has(p.id) && pens.size < 40) pens.set(p.id, { id: p.id, name: p.name, color: p.color })
        })
        return { id: sc.id, name: sc.name, pens: [...pens.values()], runs }
      })
    return {
      date: dateKey,
      today: todayKey,
      todayIdx: days.findIndex((d) => d.date === todayKey),
      nowMin: now.getHours() * 60 + now.getMinutes(),
      selected: Math.max(0, days.findIndex((d) => d.date === dateKey)),
      days,
      prior,
      views,
    }
  }, [open, date, dateKey, scopes, entries])

  useEffect(() => {
    if (!open) setReady(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = e.data as { type?: string; date?: string } | null
      if (m?.type === "day-tubes:ready") setReady(true)
      else if (m?.type === "day-tubes:goto" && typeof m.date === "string") setDate(parseKey(m.date))
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [open, setDate])

  const send = useCallback(() => {
    if (payload) frame.current?.contentWindow?.postMessage({ type: "day-tubes:data", payload }, "*")
  }, [payload])
  useEffect(() => {
    if (ready) send()
  }, [ready, send])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1120px] w-[96vw] p-0 gap-0 overflow-hidden" data-ui-name="Day tubes">
        <DialogTitle className="sr-only">Day tubes</DialogTitle>
        <DialogDescription className="sr-only">
          Your tracked week as tubes of liquid or sand, or as hourglasses. Optional; the Time Grid stays as it is.
        </DialogDescription>
        <iframe
          ref={frame}
          src="/day-tubes/index.html"
          title="Day tubes"
          onLoad={() => send()}
          className="block w-full border-0 bg-[#0f1419]"
          style={{ height: "min(88vh, 860px)" }}
        />
      </DialogContent>
    </Dialog>
  )
}
