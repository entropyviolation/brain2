/**
 * components/Home/home-next-tile.tsx — Next event, else next open to-do
 *
 * Click opens the hit. The dialog jumps to Plan or To Do. Off by default.
 */
"use client"

import { useMemo, useState } from "react"
import { pickHomeNext } from "@/lib/home-widgets"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"

export function NextTile({
  currentDate,
  onHide,
  onOpenHomeTab,
}: {
  currentDate: Date
  onHide: () => void
  onOpenHomeTab?: (tab: "plan" | "todo") => void
}) {
  const events = useEventStore((s) => s.events)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)

  const hit = useMemo(() => {
    const todos = tasks
      .filter((task) => !task.hiddenFromTodo && !task.completed && taskScheduledOnDay(task, currentDate))
      .map((task) => {
        const list = lists.find((item) => item.id === task.lists?.[0])
        return { title: itemTitleOrUntitled(task), footer: list?.name || "To Do" }
      })
    return pickHomeNext({
      now: currentDate,
      clock: new Date(),
      events,
      todos,
    })
  }, [events, tasks, lists, currentDate])

  const [open, setOpen] = useState(false)
  const jump = () => {
    if (!hit) return
    onOpenHomeTab?.(hit.tab)
    setOpen(false)
  }

  return (
    <>
      <div className="home-tile is-next" data-widget="next" data-testid="home-next-tile">
        <TileHide id="next" onHide={onHide} />
        <TileOpen label="Next" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Next</span>
          </div>
          <div className="home-crt home-next-crt">
            <p className="home-next-title">{hit?.title ?? "—"}</p>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{hit?.footer ?? "Nothing next"}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Next">
        <p className="home-widget-lead">{hit?.title ?? "Nothing next"}</p>
        <WidgetWell label="When" tone="nixie">{hit?.footer ?? "No event or open to-do on this day."}</WidgetWell>
        {hit ? (
          <button type="button" className="home-review-key" onClick={jump}>
            {hit.tab === "plan" ? "Open Plan" : "Open To Do"}
          </button>
        ) : null}
      </HomeWidgetDialog>
    </>
  )
}
