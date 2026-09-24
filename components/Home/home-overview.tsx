/**
 * components/Home/home-overview.tsx — Shared Home header squares
 *
 * One strip for Habits / Plan / To Do / Goals / Tracking. Equal-height tiles
 * share the row (flex, max 200px) and wrap only when the window is narrow.
 * Points, Latest award, progress, weather, review, the screen pet, Next, Day lamp,
 * Days Until, Solar remainder, Tracking now, Night well, Harvest leftover,
 * and Inbox mill each use caption + CRT +
 * footer. Click a tile for a closer look. × asks Are you sure? before hide.
 * The Widgets catalog lives on the date bar
 * (`home-widgets-menu.tsx`), not in this row. Weather glance lives in
 * `weather-instrument.tsx`.
 */
"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import {
  HOME_WIDGET_LABEL,
  affirmationLinesForHome,
  homeInstrumentColorVars,
  pickDailyAffirmation,
  type HomeWidgetId,
} from "@/lib/home-widgets"
import { useTaskStore } from "@/lib/task-store"
import { DailyProgressQuickview } from "@/components/Home/daily-progress-quickview"
import { DaysUntilTile } from "@/components/Home/home-days-until"
import { DayLampTile } from "@/components/Home/home-day-lamp"
import { HomeReviewBanner } from "@/components/Home/home-review-banner"
import { NextTile } from "@/components/Home/home-next-tile"
import { ScreenPetTile } from "@/components/Home/home-screen-pet"
import { AwardTile } from "@/components/Home/home-award-tile"
import { HarvestTile, InboxMillTile, NightWellTile } from "@/components/Home/home-glance-tiles"
import { SolarRemainderTile } from "@/components/Home/home-solar-tile"
import { TrackingNowTile } from "@/components/Home/home-tracking-tile"
import { HomeWidgetDialog, TileHide, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { PointsBoard } from "@/components/Home/points-stats"
import { useHomeDayStats } from "@/components/Home/home-day-stats"
import { WeatherTile } from "@/components/Home/weather-instrument"
import type { ReviewPeriod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatLocalDateKey } from "@/lib/date-utils"

type HomeOverviewProps = {
  currentDate: Date
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
  onOpenHomeTab?: (tab: "plan" | "todo") => void
}

export function HomeOverview({ currentDate, onStartReview, onOpenHomeTab }: HomeOverviewProps) {
  const order = useHomeWidgetsStore((s) => s.order)
  const hidden = useHomeWidgetsStore((s) => s.hidden)
  const hideWidget = useHomeWidgetsStore((s) => s.hideWidget)

  const percentLedTint = useHabitsStore((s) => s.percentLedTint)
  const gradeTubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const outputGradeTubeColor = useHabitsStore((s) => s.outputGradeTubeColor)

  const visible = order.filter((id) => !hidden.includes(id))
  const colorVars = homeInstrumentColorVars(percentLedTint, gradeTubeColor, outputGradeTubeColor)

  return (
    <div
      className="home-overview"
      data-testid="home-overview"
      data-ui-name="Home overview"
      data-ui-docs="components/Home/README.md"
      data-ui-docs-anchor="layout"
      data-home-grad={`${colorVars["--home-grad-led"]}|${colorVars["--home-grad-grade"]}|${colorVars["--home-grad-output"]}`}
      style={colorVars as CSSProperties}
    >
      {visible.map((id) => {
        if (id === "review") {
          return (
            <HomeReviewBanner
              key={id}
              currentDate={currentDate}
              onStartReview={onStartReview}
              tile
              onHide={() => hideWidget("review")}
            />
          )
        }
        if (id === "points") {
          return <PointsBoard key={id} currentDate={currentDate} onHide={() => hideWidget("points")} />
        }
        if (id === "award") {
          return <AwardTile key={id} onHide={() => hideWidget("award")} />
        }
        if (id === "progress") {
          return (
            <OverviewTile
              key={id}
              id="progress"
              onHide={() => hideWidget("progress")}
              detail={<ProgressDetail currentDate={currentDate} />}
            >
              <DailyProgressQuickview currentDate={currentDate} instrument />
            </OverviewTile>
          )
        }
        if (id === "affirmation") {
          return (
            <AffirmationTile
              key={id}
              currentDate={currentDate}
              onHide={() => hideWidget("affirmation")}
            />
          )
        }
        if (id === "daysuntil") {
          return <DaysUntilTile key={id} currentDate={currentDate} onHide={() => hideWidget("daysuntil")} />
        }
        if (id === "solar") {
          return <SolarRemainderTile key={id} onHide={() => hideWidget("solar")} />
        }
        if (id === "tracking") {
          return <TrackingNowTile key={id} onHide={() => hideWidget("tracking")} />
        }
        if (id === "night") {
          return <NightWellTile key={id} currentDate={currentDate} onHide={() => hideWidget("night")} />
        }
        if (id === "harvest") {
          return <HarvestTile key={id} currentDate={currentDate} onHide={() => hideWidget("harvest")} />
        }
        if (id === "inbox") {
          return <InboxMillTile key={id} onHide={() => hideWidget("inbox")} />
        }
        if (id === "pet") {
          return <ScreenPetTile key={id} currentDate={currentDate} onHide={() => hideWidget("pet")} />
        }
        if (id === "next") {
          return (
            <NextTile
              key={id}
              currentDate={currentDate}
              onHide={() => hideWidget("next")}
              onOpenHomeTab={onOpenHomeTab}
            />
          )
        }
        if (id === "daylamp") {
          return <DayLampTile key={id} currentDate={currentDate} onHide={() => hideWidget("daylamp")} />
        }
        return (
          <WeatherTile
            key={id}
            currentDate={currentDate}
            onHide={() => hideWidget("weather")}
          />
        )
      })}
    </div>
  )
}

function OverviewTile({
  id,
  onHide,
  detail,
  children,
  className,
}: {
  id: HomeWidgetId
  onHide: () => void
  detail?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn("home-tile", `is-${id}`, className)} data-widget={id}>
      <TileHide id={id} onHide={onHide} />
      {detail ? (
        <button
          type="button"
          className="home-tile-open"
          aria-label={`Open ${HOME_WIDGET_LABEL[id]}`}
          onClick={() => setOpen(true)}
        >
          {children}
        </button>
      ) : (
        children
      )}
      {detail ? (
        <HomeWidgetDialog open={open} onOpenChange={setOpen} title={HOME_WIDGET_LABEL[id]}>
          {detail}
        </HomeWidgetDialog>
      ) : null}
    </div>
  )
}

function ProgressDetail({ currentDate }: { currentDate: Date }) {
  const { todo, habit } = useHomeDayStats(currentDate)
  return (
    <WidgetWells>
      <WidgetWell label="To do:">
        {todo.completed}/{todo.total}
        <span className="home-widget-meter" aria-hidden="true"><span style={{ width: `${todo.percent}%` }} /></span>
      </WidgetWell>
      <WidgetWell label="To do left" tone="nixie">{todo.remaining}</WidgetWell>
      <WidgetWell label="Habits">
        {habit.completed}/{habit.total}
        <span className="home-widget-meter" aria-hidden="true"><span style={{ width: `${habit.percent}%` }} /></span>
      </WidgetWell>
      <WidgetWell label="Habits left" tone="nixie">{habit.remaining}</WidgetWell>
    </WidgetWells>
  )
}

function AffirmationTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const line = useMemo(() => {
    const dateKey = formatLocalDateKey(currentDate)
    return pickDailyAffirmation(affirmationLinesForHome(lists, tasks), dateKey)
  }, [lists, tasks, currentDate])

  return (
    <OverviewTile id="affirmation" onHide={onHide} detail={<p className="home-widget-lead">{line}</p>}>
      <div className="hab-score-caption">
        <span>Affirmation</span>
      </div>
      <div className="home-crt home-affirmation-crt">
        <p className="home-affirmation-line">{line}</p>
      </div>
      <div className="home-tile-foot">
        <p className="hab-score-sub">today</p>
      </div>
    </OverviewTile>
  )
}

