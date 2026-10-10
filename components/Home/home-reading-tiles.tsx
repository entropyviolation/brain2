/**
 * components/Home/home-reading-tiles.tsx — Already flowing and Plan and lived
 *
 * Optional overview squares. Off until the Widgets key shows them.
 * Already flowing counts finished habits and older to-dos against to-dos
 * created and finished the same day. Plan and lived compares prospective
 * scheduled minutes with retrospective painted Tracking minutes (sleep left out).
 */
"use client"

import { useMemo, useState } from "react"
import { plannedMinutesForDay } from "@/components/Home/Plan/plan-capacity"
import { useHomeDayStats } from "@/components/Home/home-day-stats"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import {
  alreadyFlowingFace,
  flowingCounts,
  livedPaintMinutes,
  planAndLivedFace,
} from "@/lib/home-glances"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const FLOW_WHY = {
  Quiet: "Nothing finished yet — no daily habit met, and no to-do closed today.",
  Flowing: "What finished was already the day's shape: habits, or to-dos that were on the books.",
  Pushed: "What finished was made today. The older work and the habits did not carry the day.",
  Mixed: "Some of what finished was already in motion, and some of it was new today.",
} as const

const PAINT_WHY = {
  Open: "Nothing is scheduled and nothing is painted.",
  Planned: "The day has a plan. Tracking does not have waking minutes yet.",
  Tracked: "Minutes are painted. Nothing was scheduled as work, an event, or a planned action.",
  Short: "Painted minutes are under four fifths of the plan.",
  Close: "Painted minutes sit near the plan, within about a fifth either way.",
  Over: "Painted minutes run past the plan by more than a fifth.",
} as const

export function AlreadyFlowingTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const stats = useHomeDayStats(currentDate)
  const [open, setOpen] = useState(false)
  const counts = useMemo(
    () => flowingCounts(tasks, currentDate, stats.habit.completed),
    [tasks, currentDate, stats.habit.completed],
  )
  const face = alreadyFlowingFace(counts.flowing, counts.pushed)

  return (
    <>
      <div className="home-tile is-flow" data-widget="flow" data-testid="home-flow-tile">
        <TileHide id="flow" onHide={onHide} />
        <TileOpen label="Already flowing" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Flowing</span>
          </div>
          <div className="home-crt">
            <span className="home-daylamp-word">{face.crt}</span>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Already flowing">
        <p className="home-widget-lead">{face.crt}</p>
        <WidgetWells>
          <WidgetWell label="Already">{counts.flowing}</WidgetWell>
          <WidgetWell label="New today" tone="nixie">{counts.pushed}</WidgetWell>
          <WidgetWell label="Habits finished">{stats.habit.completed}</WidgetWell>
        </WidgetWells>
        <p className="home-widget-note">{FLOW_WHY[face.word]}</p>
        <p className="home-widget-note">
          Daily habits you completed count as already in motion. A to-do finished today counts
          the same way when it was created on an earlier day. A to-do you created and finished
          today counts as new.
        </p>
      </HomeWidgetDialog>
    </>
  )
}

export function PlanAndLivedTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const events = useEventStore((s) => s.events)
  const actions = usePlannedActionStore((s) => s.actions)
  const entries = useTimeTrackingStore((s) => s.entries)
  const [open, setOpen] = useState(false)
  const face = useMemo(() => {
    const planned = plannedMinutesForDay(currentDate, tasks, events, actions)
    const lived = livedPaintMinutes(entries, formatLocalDateKey(currentDate))
    return { ...planAndLivedFace(planned, lived), planned, lived }
  }, [currentDate, tasks, events, actions, entries])

  return (
    <>
      <div className="home-tile is-paint" data-widget="paint" data-testid="home-paint-tile">
        <TileHide id="paint" onHide={onHide} />
        <TileOpen label="Plan and lived" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Lived</span>
          </div>
          <div className="home-crt">
            <span className="home-daylamp-word">{face.crt}</span>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Plan and lived">
        <p className="home-widget-lead">{face.crt}</p>
        <WidgetWells>
          <WidgetWell label="Plan">{face.planned}m</WidgetWell>
          <WidgetWell label="Lived" tone="nixie">{face.lived}m</WidgetWell>
        </WidgetWells>
        <p className="home-widget-note">{PAINT_WHY[face.word]}</p>
        <p className="home-widget-note">
          Plan is prospective — scheduled work, events, and planned actions. Lived is
          retrospective minutes painted on Tracking for this day, each minute once. Sleep
          the log filled in is not counted.
        </p>
      </HomeWidgetDialog>
    </>
  )
}
