/**
 * components/Home/home-overview.tsx — Shared Home header squares
 *
 * One strip for Habits / Plan / To Do / Goals / Tracking. `currentDate` is the
 * day the squares describe: the selected day, or the wall clock when Follow
 * the clock is on (chosen in `home-dashboard.tsx`). Equal-height tiles
 * share the row (flex, max 200px) and wrap only when the window is narrow.
 * Points, Latest award, progress, weather, review, the screen pet, Next, Day lamp,
 * Days Until, Moon, Solar remainder, Tracking now, Night well, Harvest leftover,
 * Inbox mill, Already flowing, and Plan and lived each use caption + CRT +
 * footer. Click a tile for a closer look. × asks Are you sure? before hide.
 * The Widgets catalog lives on the date bar
 * (`home-widgets-menu.tsx`), not in this row. Weather glance lives in
 * `weather-instrument.tsx`.
 */
"use client"

import { useState, type CSSProperties } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import {
  HOME_WIDGET_LABEL,
  homeInstrumentColorVars,
  type HomeWidgetId,
} from "@/lib/home-widgets"
import { DailyProgressQuickview } from "@/components/Home/daily-progress-quickview"
import { DaysUntilTiles } from "@/components/Home/home-days-until"
import { DayLampTile } from "@/components/Home/home-day-lamp"
import { HomeReviewBanner } from "@/components/Home/home-review-banner"
import { NextTile } from "@/components/Home/home-next-tile"
import { ScreenPetTile } from "@/components/Home/home-screen-pet"
import { AwardTile } from "@/components/Home/home-award-tile"
import { HarvestTile, InboxMillTile, NightWellTile } from "@/components/Home/home-glance-tiles"
import { AlreadyFlowingTile, PlanAndLivedTile } from "@/components/Home/home-reading-tiles"
import { MoonTile } from "@/components/Home/home-moon-tile"
import { SolarRemainderTile } from "@/components/Home/home-solar-tile"
import { TrackingNowTile } from "@/components/Home/home-tracking-tile"
import { VocabTile } from "@/components/Home/home-vocab-tile"
import { AffirmationTile } from "@/components/Home/home-affirmation-tile"
import { HomeWidgetDialog, TileHide, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { PointsBoard } from "@/components/Home/points-stats"
import { useHomeDayStats, type HomeDayCount, type HomeDayRemainingItem } from "@/components/Home/home-day-stats"
import { useHomePeriodStats } from "@/components/Home/home-period-stats"
import { useItemDetailPopup } from "@/components/Home/use-item-detail-popup"
import { WeatherTile } from "@/components/Home/weather-instrument"
import type { ReviewPeriod } from "@/lib/types"
import { cn } from "@/lib/utils"

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
            <ProgressTile key={id} currentDate={currentDate} onHide={() => hideWidget("progress")} />
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
          return (
            <DaysUntilTiles
              key={id}
              currentDate={currentDate}
              onHideFamily={() => hideWidget("daysuntil")}
            />
          )
        }
        if (id === "moon") {
          return <MoonTile key={id} currentDate={currentDate} onHide={() => hideWidget("moon")} />
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
        if (id === "flow") {
          return <AlreadyFlowingTile key={id} currentDate={currentDate} onHide={() => hideWidget("flow")} />
        }
        if (id === "paint") {
          return <PlanAndLivedTile key={id} currentDate={currentDate} onHide={() => hideWidget("paint")} />
        }
        if (id === "vocab") {
          return <VocabTile key={id} currentDate={currentDate} onHide={() => hideWidget("vocab")} />
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
  modal = true,
  after,
}: {
  id: HomeWidgetId
  onHide: () => void
  detail?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** False while an item detail popup is stacked over the dialog. */
  modal?: boolean
  /** Rendered beside the dialog, such as a stacked item popup. */
  after?: React.ReactNode
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
        <HomeWidgetDialog open={open} modal={modal} onOpenChange={setOpen} title={HOME_WIDGET_LABEL[id]}>
          {detail}
        </HomeWidgetDialog>
      ) : null}
      {after}
    </div>
  )
}

function RemainFold({
  label,
  items,
  empty,
  onOpenItem,
  open,
  onToggle,
}: {
  label: string
  items: HomeDayRemainingItem[]
  empty: string
  /** When set, each row is a button that opens that item. */
  onOpenItem?: (id: string) => void
  /** Controlled open state, kept outside the dialog so it survives a remount. */
  open?: boolean
  onToggle?: (open: boolean) => void
}) {
  return (
    <details open={open} onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}>
      <summary>
        <span className="home-widget-fold" aria-hidden="true">
          <span className="is-shut">&gt;</span>
          <span className="is-open">^</span>
        </span>
        {label} ({items.length})
      </summary>
      {items.length === 0 ? (
        <p className="home-widget-remain-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              {onOpenItem ? (
                <button
                  type="button"
                  className="home-widget-remain-open"
                  title="Open item detail"
                  onClick={() => onOpenItem(item.id)}
                >
                  {item.title}
                </button>
              ) : (
                item.title
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

type FoldState = { isOpen: (key: string) => boolean; toggle: (key: string, open: boolean) => void }

function ProgressPeriod({
  label,
  span,
  todo,
  habit,
  remainingTodos,
  remainingHabits,
  onOpenItem,
  folds,
}: {
  label: string
  span: string
  todo: HomeDayCount
  habit: HomeDayCount
  remainingTodos: HomeDayRemainingItem[]
  remainingHabits: HomeDayRemainingItem[]
  onOpenItem: (id: string) => void
  folds: FoldState
}) {
  const todoKey = `${label}:todo`
  const habitKey = `${label}:habit`
  return (
    <section className="home-widget-remain" aria-label={label}>
      <p className="home-widget-remain-head">
        <span>{label}</span>
        <span>
          To do {todo.completed}/{todo.total} · Habits {habit.completed}/{habit.total}
        </span>
      </p>
      <RemainFold
        label="Remaining to-dos"
        items={remainingTodos}
        empty={`None left ${span}.`}
        onOpenItem={onOpenItem}
        open={folds.isOpen(todoKey)}
        onToggle={(open) => folds.toggle(todoKey, open)}
      />
      <RemainFold
        label="Undone habits"
        items={remainingHabits}
        empty={`None left ${span}.`}
        open={folds.isOpen(habitKey)}
        onToggle={(open) => folds.toggle(habitKey, open)}
      />
    </section>
  )
}

/**
 * The open item and the open folds live here, outside the dialog. Radix swaps
 * the dialog content when `modal` flips for the stacked popup, which remounts
 * everything inside it.
 */
function ProgressTile({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [openFolds, setOpenFolds] = useState<string[]>([])
  const ItemPopup = useItemDetailPopup(openItemId)
  const folds: FoldState = {
    isOpen: (key) => openFolds.includes(key),
    toggle: (key, open) =>
      setOpenFolds((keys) => (open ? (keys.includes(key) ? keys : [...keys, key]) : keys.filter((k) => k !== key))),
  }
  return (
    <OverviewTile
      id="progress"
      className="is-hero"
      onHide={onHide}
      modal={!openItemId}
      detail={<ProgressDetail currentDate={currentDate} onOpenItem={setOpenItemId} folds={folds} />}
      after={
        ItemPopup ? (
          <ItemPopup taskId={openItemId} open={!!openItemId} onClose={() => setOpenItemId(null)} stackAbove />
        ) : null
      }
    >
      <DailyProgressQuickview currentDate={currentDate} instrument />
    </OverviewTile>
  )
}

function ProgressDetail({
  currentDate,
  onOpenItem,
  folds,
}: {
  currentDate: Date
  onOpenItem: (id: string) => void
  folds: FoldState
}) {
  const { todo, habit, remainingTodos, remainingHabits } = useHomeDayStats(currentDate)
  const week = useHomePeriodStats("week", currentDate)
  const month = useHomePeriodStats("month", currentDate)
  return (
    <>
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
      <ProgressPeriod
        label="Today"
        span="today"
        todo={todo}
        habit={habit}
        remainingTodos={remainingTodos}
        remainingHabits={remainingHabits}
        onOpenItem={onOpenItem}
        folds={folds}
      />
      <ProgressPeriod label="This week" span="this week" {...week} onOpenItem={onOpenItem} folds={folds} />
      <ProgressPeriod label="This month" span="this month" {...month} onOpenItem={onOpenItem} folds={folds} />
    </>
  )
}
