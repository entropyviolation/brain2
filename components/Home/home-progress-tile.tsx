/**
 * components/Home/home-progress-tile.tsx — Today's Progress on the Visual dashboard
 *
 * Habits and to-dos for the dashboard day, with week and month columns. The
 * Columns setting picks which periods the face draws. Click lists what is
 * still open; each row opens that item, stacked over the detail.
 */
"use client"

import { useState } from "react"
import { HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
import { DailyProgressQuickview } from "@/components/Home/daily-progress-quickview"
import { HomeWidgetDialog, TileHide, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { useHomeDayStats, type HomeDayCount, type HomeDayRemainingItem } from "@/components/Home/home-day-stats"
import { useHomePeriodStats } from "@/components/Home/home-period-stats"
import { useItemDetailPopup } from "@/components/Home/use-item-detail-popup"
import { useCopySetting } from "@/components/Home/widgets/copy-context"
import { cn } from "@/lib/utils"

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
export function ProgressTile({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const periods = useCopySetting<string>("periods", "all")
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
      <DailyProgressQuickview
        currentDate={currentDate}
        instrument
        periods={periods === "today" || periods === "week" ? periods : "all"}
      />
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
