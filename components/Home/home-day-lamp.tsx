/**
 * components/Home/home-day-lamp.tsx — One word for how today is going
 *
 * Habits and to-dos share one CRT word, tinted with the three progress hues.
 * Off by default.
 */
"use client"

import { useState } from "react"
import { dayLampWord } from "@/lib/home-widgets"
import { useHomeDayStats } from "@/components/Home/home-day-stats"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"

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
        <WidgetWell label={footer}>{footer}</WidgetWell>
        <p className="home-widget-note">Quiet is an empty day. Full means habits and to-dos are both done.</p>
      </HomeWidgetDialog>
    </>
  )
}
