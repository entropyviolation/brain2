/**
 * components/Home/home-day-lamp.tsx — One word for how today is going
 *
 * Habits and to-dos share one CRT word from their completion percents.
 * Quiet = nothing scheduled; Dim / Warm / Bright average the bars; Full =
 * both bars at 100%. Off by default.
 */
"use client"

import { useState } from "react"
import { dayLampWord } from "@/lib/home-widgets"
import { useHomeDayStats } from "@/components/Home/home-day-stats"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"

const LAMP_WHY: Record<string, string> = {
  Quiet: "Nothing on today's habit sheet or to-do list — the lamp stays dark.",
  Dim: "Habits and to-dos are scheduled, but the average completion is under 20%.",
  Warm: "Average habit / to-do completion is between 20% and 60%.",
  Bright: "Average completion is 60% or more, but not everything is finished.",
  Full: "Every scheduled habit and every to-do for today is done.",
}

export function DayLampTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const stats = useHomeDayStats(currentDate)
  const word = dayLampWord({
    habitPercent: stats.habit.percent,
    habitTotal: stats.habit.total,
    todoPercent: stats.todo.percent,
    todoTotal: stats.todo.total,
  })
  const bits: string[] = []
  if (stats.habit.total > 0) bits.push(`habits ${stats.habit.completed}/${stats.habit.total}`)
  if (stats.todo.total > 0) bits.push(`to do ${stats.todo.completed}/${stats.todo.total}`)

  const [open, setOpen] = useState(false)
  const footer = bits.join(" · ") || "Nothing scheduled"

  return (
    <>
      <div className="home-tile is-daylamp" data-widget="daylamp" data-testid="home-daylamp-tile">
        <TileHide id="daylamp" onHide={onHide} />
        <TileOpen label="Day lamp" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Day lamp</span>
          </div>
          <div className="home-crt">
            <span className="home-daylamp-word" data-lamp={word.toLowerCase()}>
              {word}
            </span>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Day lamp">
        <p className="home-widget-lead" data-lamp={word.toLowerCase()}>{word}</p>
        <WidgetWells>
          <WidgetWell label="Habits">{stats.habit.completed}/{stats.habit.total} · {stats.habit.percent}%</WidgetWell>
          <WidgetWell label="To do">{stats.todo.completed}/{stats.todo.total} · {stats.todo.percent}%</WidgetWell>
        </WidgetWells>
        <p className="home-widget-note">{LAMP_WHY[word]}</p>
        <p className="home-widget-note">
          The lamp averages whichever of habits and to-dos are scheduled today. It does not read
          the clock, mood, or weather — only those two completion bars.
        </p>
      </HomeWidgetDialog>
    </>
  )
}
