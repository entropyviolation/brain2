/**
 * components/Home/Plan/phone/plan-phone.tsx — Phone Plan
 *
 * iOS-style calendar for a narrow viewport. The desktop fascia is not mounted.
 * Season, Month, Week, and Day stay. Swipe sideways for the period you are on.
 * The agenda scrolls vertically. Create, edit, paste, settings, the explorer,
 * and the written plan open as sheets. Drag-to-plan is a Plan key plus a time
 * sheet, the same store writes as a drop.
 */
"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { addDays, addMonths, addWeeks, format } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import type { PlannedAction } from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { formatLocalDateKey, formatLocalMonthKey, getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterLabel, quarterStartDate, seasonOfDate, shiftQuarter } from "@/lib/seasons"
import { PlanGemModeToggle } from "../gem/plan-gem-mode-toggle"
import { PlanTextLog } from "../plan-text-log"
import { PlannedTasksSidebar } from "../rail/planned-tasks-sidebar"
import { PhoneAgenda, type AgendaMenu } from "./plan-phone-agenda"
import { PhoneMonth, PhoneSeason, PhoneWeekStrip, monthDays, weekDays } from "./plan-phone-cal"
import {
  createFreeBlock,
  moveEventTime,
  moveItemToDay,
  movePlanTime,
  moveTaskTime,
  placeRailItem,
  unscheduleEvent,
  unschedulePlan,
  unscheduleTask,
  type PlaceMode,
} from "./plan-phone-place"
import { usePeriodSwipe } from "./use-plan-swipe"
import "./plan-phone.css"

export type PlanPhoneTab = "quarter" | "month" | "week" | "day"

type Sheet = "add" | "more" | "explorer" | "log" | "hours" | "days" | "actions" | null

type HourJob =
  | { purpose: "place"; kind: "task" | "habit"; id: string }
  | { purpose: "event" }
  | { purpose: "free" }
  | { purpose: "move" }

const TAB_LABEL: Record<PlanPhoneTab, string> = {
  quarter: "Season",
  month: "Month",
  week: "Week",
  day: "Day",
}

function periodNoun(tab: PlanPhoneTab): string {
  if (tab === "quarter") return "season"
  return tab
}

function shiftDate(tab: PlanPhoneTab, date: Date, direction: 1 | -1): Date {
  if (tab === "day") return addDays(date, direction)
  if (tab === "week") return addWeeks(date, direction)
  if (tab === "month") return addMonths(date, direction)
  return shiftQuarter(quarterStartDate(date), direction)
}

function compactTitle(tab: PlanPhoneTab, date: Date): string {
  if (tab === "quarter") return quarterLabel(quarterKey(quarterStartDate(date)))
  if (tab === "week") {
    const days = getWeekDates(getWeekStartDate(date))
    return `${format(days[0], "MMM d")} – ${format(days[6], "MMM d")}`
  }
  if (tab === "day") return format(date, "EEE, MMM d")
  return format(date, "MMMM yyyy")
}

function largeTitle(tab: PlanPhoneTab, date: Date): string {
  if (tab === "quarter") return seasonOfDate(quarterStartDate(date))
  if (tab === "week") return "Week"
  if (tab === "day") return format(date, "EEEE")
  return format(date, "MMMM")
}

function logPeriod(tab: PlanPhoneTab): "day" | "week" | "month" | "quarter" {
  if (tab === "quarter") return "quarter"
  return tab
}

function logKey(tab: PlanPhoneTab, date: Date): string {
  if (tab === "day") return formatLocalDateKey(date)
  if (tab === "week") return getWeekString(date)
  if (tab === "month") return formatLocalMonthKey(date)
  return quarterKey(quarterStartDate(date))
}

function logPlaceholder(tab: PlanPhoneTab): string {
  if (tab === "day") return "Write your day plan, goals, and objectives..."
  if (tab === "week") return "Write your week plan, goals, and objectives..."
  if (tab === "month") return "Write your month plan, goals, and objectives..."
  return "Write this season's plan — what the quarter is for..."
}

function logTitle(tab: PlanPhoneTab): string {
  if (tab === "quarter") return "Season plan"
  if (tab === "week") return "Week Plan"
  if (tab === "month") return "Month Plan"
  return "Day Plan"
}

function hourLabel(hour: number): string {
  return format(new Date(2026, 0, 1, hour, 0), "h:mm a")
}

export function PlanPhone({
  currentDate,
  setCurrentDate,
  planTab,
  setPlanTab,
  events,
  planDark,
  setPlanDark,
  gemMode,
  setGemMode,
  onOpenDay,
  onOpenMonth,
  onTaskClick,
  onEventClick,
  onCreateEvent,
  onAddEvent,
  onAddPlan,
  onPlannedAction,
  onPaste,
  onSettings,
}: {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  planTab: PlanPhoneTab
  setPlanTab: (tab: PlanPhoneTab) => void
  events: CalendarEvent[]
  planDark: boolean
  setPlanDark: (on: boolean) => void
  gemMode: boolean
  setGemMode: (on: boolean) => void
  onOpenDay: (date: Date) => void
  onOpenMonth: (date: Date) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date, hour?: number) => void
  onAddEvent: () => void
  onAddPlan: () => void
  onPlannedAction: (action: PlannedAction) => void
  onPaste: () => void
  onSettings: () => void
}) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const [motionDir, setMotionDir] = useState<0 | 1 | -1>(0)
  const [hourJob, setHourJob] = useState<HourJob | null>(null)
  const [menu, setMenu] = useState<AgendaMenu | null>(null)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.planPhone = "true"
    if (planDark) root.dataset.planPhoneDark = "true"
    else delete root.dataset.planPhoneDark
    return () => {
      delete root.dataset.planPhone
      delete root.dataset.planPhoneDark
    }
  }, [planDark])

  const go = (direction: 1 | -1) => {
    setMotionDir(direction)
    setCurrentDate(shiftDate(planTab, currentDate, direction))
  }

  const swipeRef = usePeriodSwipe(go)
  const placeMode: PlaceMode = planTab === "week" ? "week" : planTab === "month" ? "month" : "day"
  const eventLabel = events.length === 1 ? "1 event" : `${events.length} events`
  const stageKey = `${planTab}:${compactTitle(planTab, currentDate)}`

  const dayChoices = useMemo(() => {
    if (planTab === "week") return weekDays(currentDate)
    return monthDays(currentDate)
  }, [planTab, currentDate])

  const openHours = (job: HourJob) => {
    setHourJob(job)
    setSheet("hours")
  }

  const finishPlacement = (action: PlannedAction | null) => {
    setSheet(null)
    if (action) onPlannedAction(action)
  }

  const pickHour = (hour: number | null) => {
    if (!hourJob) return
    if (hourJob.purpose === "event") {
      setSheet(null)
      if (hour == null) onAddEvent()
      else onCreateEvent(currentDate, hour)
      return
    }
    if (hourJob.purpose === "free") {
      if (hour == null) return
      finishPlacement(createFreeBlock(currentDate, hour))
      return
    }
    if (hourJob.purpose === "place") {
      finishPlacement(
        placeRailItem({
          kind: hourJob.kind,
          id: hourJob.id,
          date: currentDate,
          hour,
          mode: placeMode,
        }),
      )
      return
    }
    if (!menu || hour == null) return
    if (menu.kind === "event") moveEventTime(menu.id, currentDate, hour)
    else if (menu.kind === "plan") {
      const next = movePlanTime(menu.id, currentDate, hour)
      if (next) onPlannedAction(next)
    } else moveTaskTime(menu.id, currentDate, hour)
    setSheet(null)
  }

  const pickDay = (date: Date) => {
    if (!menu) return
    moveItemToDay(menu.kind, menu.id, date)
    setCurrentDate(date)
    setSheet(null)
  }

  const clearMenu = () => {
    if (!menu) return
    if (menu.kind === "event") unscheduleEvent(menu.id)
    else if (menu.kind === "plan") unschedulePlan(menu.id, currentDate)
    else unscheduleTask(menu.id, currentDate, placeMode)
    setSheet(null)
  }

  return (
    <div className="plan-phone" data-testid="plan-phone" data-plan-dark={planDark ? "true" : "false"}>
      <h1 className="plan-phone-sr">Plan</h1>
      <header className="plan-phone-nav">
        <button type="button" aria-label={`Previous ${periodNoun(planTab)}`} onClick={() => go(-1)}>
          <span aria-hidden>‹</span>
        </button>
        <div className="plan-phone-nav-copy">
          <p className="plan-phone-nav-title">{compactTitle(planTab, currentDate)}</p>
          <p className="plan-phone-nav-sub">
            {TAB_LABEL[planTab]} · {eventLabel}
          </p>
        </div>
        <button type="button" aria-label={`Next ${periodNoun(planTab)}`} onClick={() => go(1)}>
          <span aria-hidden>›</span>
        </button>
        <button type="button" className="plan-phone-add" aria-label="Add" onClick={() => setSheet("add")}>
          +
        </button>
      </header>

      <div className="plan-phone-seg" role="tablist" aria-label="Plan period">
        {(Object.keys(TAB_LABEL) as PlanPhoneTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={planTab === tab}
            onClick={() => setPlanTab(tab)}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {planTab === "week" ? <PhoneWeekStrip currentDate={currentDate} onSelect={setCurrentDate} /> : null}

      <div className="plan-phone-body" ref={swipeRef} data-testid="plan-phone-scroll">
        <div className="plan-phone-scroll">
          <div key={stageKey} className="plan-phone-stage" data-dir={motionDir === 0 ? undefined : String(motionDir)}>
            <h2 className="plan-phone-large">{largeTitle(planTab, currentDate)}</h2>
            {planTab === "month" ? (
              <PhoneMonth
                currentDate={currentDate}
                events={events}
                gemMode={gemMode}
                onSelect={setCurrentDate}
                onOpenDay={onOpenDay}
              />
            ) : null}
            {planTab === "quarter" ? (
              <PhoneSeason
                currentDate={currentDate}
                events={events}
                onOpenDay={onOpenDay}
                onOpenMonth={onOpenMonth}
              />
            ) : null}
            {planTab !== "quarter" ? (
              <PhoneAgenda
                currentDate={currentDate}
                events={events}
                gemMode={gemMode && planTab === "month"}
                showOpenDay={planTab !== "day"}
                onOpenDay={() => onOpenDay(currentDate)}
                onEvent={onEventClick}
                onTask={onTaskClick}
                onPlan={onPlannedAction}
                onMenu={(next) => {
                  setMenu(next)
                  setSheet("actions")
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <nav className="plan-phone-dock" aria-label="Plan tools">
        <button
          type="button"
          onClick={() => {
            setMotionDir(0)
            setCurrentDate(new Date())
          }}
        >
          Today
        </button>
        {planTab !== "quarter" ? (
          <button type="button" onClick={() => setSheet("explorer")}>
            Explorer
          </button>
        ) : null}
        <button type="button" onClick={() => setSheet("log")}>
          Plan log
        </button>
        <button type="button" onClick={() => setSheet("more")}>
          More
        </button>
      </nav>

      <PhoneSheet open={sheet === "add"} title="Add" onClose={() => setSheet(null)}>
        <button type="button" className="plan-phone-choice" onClick={() => { setSheet(null); onAddEvent() }}>
          Add Event
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => { setSheet(null); onAddPlan() }}>
          Add Plan
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => { setSheet(null); onPaste() }}>
          Paste Events
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => openHours({ purpose: "event" })}>
          Add event at a time
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => openHours({ purpose: "free" })}>
          Free block at a time
        </button>
      </PhoneSheet>

      <PhoneSheet open={sheet === "more"} title="More" onClose={() => setSheet(null)}>
        <button type="button" className="plan-phone-choice" onClick={() => { setSheet(null); onSettings() }}>
          Settings
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => { setSheet(null); onPaste() }}>
          Paste Events
        </button>
        <div className="plan-phone-latches" id="plan-chrome-toggles">
          <button
            type="button"
            id="plan-dark-mode"
            className="plan-phone-choice"
            aria-pressed={planDark}
            aria-label={planDark ? "light mode" : "Dark"}
            onClick={() => setPlanDark(!planDark)}
          >
            {planDark ? "light mode" : "Dark"}
          </button>
          <PlanGemModeToggle on={gemMode} onChange={setGemMode} />
        </div>
      </PhoneSheet>

      <PhoneSheet open={sheet === "explorer"} title="Explorer" onClose={() => setSheet(null)}>
        {planTab !== "quarter" ? (
          <PlannedTasksSidebar
            mode={placeMode}
            currentDate={currentDate}
            onTaskClick={(id) => {
              setSheet(null)
              onTaskClick(id)
            }}
            onPlaceItem={(item) => openHours({ purpose: "place", kind: item.kind, id: item.id })}
            onUnscheduleTask={(id) => unscheduleTask(id, currentDate, placeMode)}
            onUnscheduleEvent={unscheduleEvent}
            onUnschedulePlannedAction={(id) => unschedulePlan(id, currentDate)}
          />
        ) : null}
      </PhoneSheet>

      <PhoneSheet open={sheet === "log"} title={logTitle(planTab)} onClose={() => setSheet(null)}>
        <PlanTextLog
          period={logPeriod(planTab)}
          periodKey={logKey(planTab, currentDate)}
          placeholder={logPlaceholder(planTab)}
          size={planTab === "day" ? "day" : "period"}
        />
      </PhoneSheet>

      <PhoneSheet
        open={sheet === "hours"}
        title={hourJob?.purpose === "move" ? "Move" : hourJob?.purpose === "free" ? "Free block" : "Time"}
        onClose={() => setSheet(null)}
      >
        {hourJob?.purpose === "place" && hourJob.kind === "task" ? (
          <button type="button" className="plan-phone-choice" onClick={() => pickHour(null)}>
            Anytime this day
          </button>
        ) : null}
        {Array.from({ length: 24 }, (_, hour) => (
          <button key={hour} type="button" className="plan-phone-choice" onClick={() => pickHour(hour)}>
            {hourLabel(hour)}
          </button>
        ))}
      </PhoneSheet>

      <PhoneSheet open={sheet === "days"} title="Move to" onClose={() => setSheet(null)}>
        {dayChoices.map((date) => (
          <button key={formatLocalDateKey(date)} type="button" className="plan-phone-choice" onClick={() => pickDay(date)}>
            {format(date, "EEEE, MMM d")}
          </button>
        ))}
      </PhoneSheet>

      <PhoneSheet open={sheet === "actions"} title={menu?.title ?? "Actions"} onClose={() => setSheet(null)}>
        <button
          type="button"
          className="plan-phone-choice"
          onClick={() => {
            if (!menu) return
            setSheet(null)
            if (menu.kind === "event") {
              const event = events.find((row) => row.id === menu.id)
              if (event) onEventClick(event)
            } else if (menu.kind === "task") onTaskClick(menu.id)
            else {
              const action = usePlannedActionStore.getState().actions.find((row) => row.id === menu.id)
              if (action) onPlannedAction(action)
            }
          }}
        >
          Open
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => openHours({ purpose: "move" })}>
          Move to a time
        </button>
        <button type="button" className="plan-phone-choice" onClick={() => setSheet("days")}>
          Another day
        </button>
        <button type="button" className="plan-phone-choice" onClick={clearMenu}>
          {menu?.kind === "event" ? "Make all-day" : "Unschedule"}
        </button>
      </PhoneSheet>
    </div>
  )
}

function PhoneSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="plan-phone-sheet-root">
      <button type="button" className="plan-phone-scrim" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="plan-phone-sheet">
        <div className="plan-phone-grabber" aria-hidden />
        <div className="plan-phone-sheet-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="plan-phone-sheet-body">{children}</div>
      </div>
    </div>
  )
}
