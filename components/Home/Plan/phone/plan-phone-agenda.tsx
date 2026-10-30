/**
 * components/Home/Plan/phone/plan-phone-agenda.tsx — Thumbable day agenda
 *
 * The same day the desktop hour grid shows: all-day events, timed events,
 * tasks, planned actions, past Day Log outlines, sunrise and sunset, and a
 * now mark on today. The list lands on now, or on the first waking hour.
 * Gem mode lists completed-work tokens on past days as their own rows.
 */
"use client"

import { useLayoutEffect, useMemo, useRef, useState, useEffect, type Ref } from "react"
import { format } from "date-fns"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"
import { DEFAULT_WAKE_MIN, firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import {
  formatLocalDateKey,
  isPastLocalCalendarDay,
  isToday,
  sameCalendarDay,
  startOfLocalToday,
} from "@/lib/date-utils"
import { eventCoversDay, getMustBeDoneBefore, isMultiDayEvent } from "@/lib/event-links"
import { useHabitsStore } from "@/lib/habits-store"
import { itemTitle } from "@/lib/item-utils"
import { taskOnPlanCalendarDay, tasksForGemDay } from "@/lib/item-slices"
import {
  hhmmToMinutes,
  todoIdsCoveredByPlacements,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { useSleepStore } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"
import { MINUTES_PER_DAY } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { CalendarEvent, Task } from "@/lib/types"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import { fetchDayClimate, minutesFromHhmm } from "@/lib/weather-client"
import { PLAN_TASK_COLOR, planEventTimeLabel, resolvePlanColor } from "../plan-chip"
import { planGemChipTaskIds, planGemTokensForDay, type PlanGemToken } from "../gem/plan-gem-day"
import { planDayTrackedGhosts } from "../plan-tracked-ghosts"
import { usePrefersReducedMotion } from "./use-plan-phone"

export type AgendaMenu =
  | { kind: "event"; id: string; title: string }
  | { kind: "task"; id: string; title: string }
  | { kind: "plan"; id: string; title: string }

type TimelineRow =
  | { kind: "event"; id: string; title: string; minutes: number; detail?: string; color: string; event: CalendarEvent }
  | { kind: "task"; id: string; title: string; minutes: number; detail?: string; color: string }
  | { kind: "plan"; id: string; title: string; minutes: number; detail?: string; color: string; action: PlannedAction }
  | { kind: "ghost"; id: string; title: string; minutes: number; detail?: string }
  | { kind: "sun"; id: string; title: string; minutes: number }
  | { kind: "now"; id: string; title: string; minutes: number }

function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = ((minutes % 60) + 60) % 60
  return format(new Date(2026, 0, 1, h, m), "h:mm a")
}

function eventOnDay(event: CalendarEvent, date: Date): boolean {
  return event.isAllDay || isMultiDayEvent(event) ? eventCoversDay(event, date) : sameCalendarDay(event.date, date)
}

export function PhoneAgenda({
  currentDate,
  events,
  gemMode,
  showOpenDay,
  onOpenDay,
  onEvent,
  onTask,
  onPlan,
  onMenu,
}: {
  currentDate: Date
  events: CalendarEvent[]
  gemMode: boolean
  showOpenDay: boolean
  onOpenDay: () => void
  onEvent: (event: CalendarEvent) => void
  onTask: (taskId: string) => void
  onPlan: (action: PlannedAction) => void
  onMenu: (menu: AgendaMenu) => void
}) {
  const reduce = usePrefersReducedMotion()
  const anchorRef = useRef<HTMLLIElement>(null)
  const tasks = useTaskStore((s) => s.tasks)
  const actions = usePlannedActionStore((s) => s.actions)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const nights = useSleepStore((s) => s.nights)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const dayKey = formatLocalDateKey(currentDate)
  const past = isPastLocalCalendarDay(currentDate, startOfLocalToday())
  const today = isToday(currentDate)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  const [sun, setSun] = useState<{ rise: number; set: number; riseLabel: string; setLabel: string } | null>(null)
  const [ghostNow, setGhostNow] = useState(() => new Date())

  useEffect(() => {
    if (!today) return
    const id = window.setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
      setGhostNow(n)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [today])

  useEffect(() => {
    let cancelled = false
    const city = homeCity.trim() || DEFAULT_HOME_CITY
    fetchDayClimate(city, dayKey)
      .then((clim) => {
        if (cancelled || !clim?.sunrise || !clim?.sunset) return
        setSun({
          rise: minutesFromHhmm(clim.sunriseHhmm),
          set: minutesFromHhmm(clim.sunsetHhmm),
          riseLabel: clim.sunrise,
          setLabel: clim.sunset,
        })
      })
      .catch(() => {
        if (!cancelled) setSun(null)
      })
    return () => {
      cancelled = true
    }
  }, [dayKey, homeCity])

  const gemTasks = useMemo(() => (gemMode && past ? tasksForGemDay(tasks, currentDate) : []), [gemMode, past, tasks, currentDate])
  const tokens = useMemo(
    () => (gemMode && past ? planGemTokensForDay({ date: currentDate, habits, weeklyData, tasks: gemTasks }) : []),
    [gemMode, past, currentDate, habits, weeklyData, gemTasks],
  )
  const hideTaskIds = useMemo(
    () => (gemMode && past ? planGemChipTaskIds(tokens, gemTasks, currentDate) : new Set<string>()),
    [gemMode, past, tokens, gemTasks, currentDate],
  )

  const scrollToMinutes = useMemo(() => {
    if (today) return nowMinutes
    const awake = awakeWindowFor(dayKey, currentDate)
    const hour = firstUnpaintedWakingHour({
      map: Array.from({ length: MINUTES_PER_DAY }, () => null),
      wakeMin: awake?.wake ?? DEFAULT_WAKE_MIN,
      bedMin: awake?.bed,
    })
    return hour * 60
  }, [today, nowMinutes, dayKey, currentDate, nights])

  const ghosts = useMemo(() => {
    const scope = trackingScopes.find((row) => row.id === activeScopeId) ?? trackingScopes[0]
    return planDayTrackedGhosts({
      entries: trackingEntries,
      scope,
      scopes: trackingScopes,
      dayKey,
      viewedDay: currentDate,
      now: ghostNow,
    })
  }, [trackingEntries, trackingScopes, activeScopeId, dayKey, currentDate, ghostNow])

  const covered = useMemo(() => todoIdsCoveredByPlacements(actions, dayKey), [actions, dayKey])

  const allDay = events.filter((event) => event.isAllDay && eventCoversDay(event, currentDate))
  const anytime = tasks.filter(
    (task) => taskOnPlanCalendarDay(task, currentDate) && !task.scheduledTime && !hideTaskIds.has(task.id) && !covered.has(task.id),
  )

  const timeline = useMemo(() => {
    const rows: TimelineRow[] = []
    for (const event of events) {
      if (event.isAllDay || !eventOnDay(event, currentDate)) continue
      const [h, m] = event.startTime.split(":").map(Number)
      rows.push({
        kind: "event",
        id: event.id,
        title: event.title,
        minutes: (h || 0) * 60 + (m || 0),
        detail: [planEventTimeLabel(event), event.location].filter(Boolean).join(" · "),
        color: resolvePlanColor(event.color),
        event,
      })
    }
    for (const task of tasks) {
      if (!taskOnPlanCalendarDay(task, currentDate) || !task.scheduledTime) continue
      if (hideTaskIds.has(task.id) || covered.has(task.id)) continue
      const before = getMustBeDoneBefore(task)
      rows.push({
        kind: "task",
        id: task.id,
        title: itemTitle(task),
        minutes: hhmmToMinutes(task.scheduledTime),
        detail: before ? `Before ${format(before, "MMM d")}` : undefined,
        color: PLAN_TASK_COLOR,
      })
    }
    for (const action of actions) {
      if (action.date !== dayKey) continue
      rows.push({
        kind: "plan",
        id: action.id,
        title: action.title,
        minutes: hhmmToMinutes(action.startTime),
        detail: action.notes || `${action.startTime}–${action.endTime}`,
        color: "#c4b49a",
        action,
      })
    }
    for (const block of ghosts) {
      rows.push({
        kind: "ghost",
        id: block.id,
        title: block.label,
        minutes: block.startMinutes,
        detail: block.sublabel || "Day log",
      })
    }
    if (sun) {
      rows.push({ kind: "sun", id: "sunrise", title: `Sunrise ${sun.riseLabel}`, minutes: sun.rise })
      rows.push({ kind: "sun", id: "sunset", title: `Sunset ${sun.setLabel}`, minutes: sun.set })
    }
    if (today) rows.push({ kind: "now", id: "now", title: "Now", minutes: nowMinutes })
    rows.sort((a, b) => a.minutes - b.minutes || a.title.localeCompare(b.title))
    return rows
  }, [events, currentDate, tasks, actions, dayKey, hideTaskIds, covered, ghosts, sun, today, nowMinutes])

  const anchorMinutes = today ? nowMinutes : scrollToMinutes

  useLayoutEffect(() => {
    const node = anchorRef.current
    if (!node) return
    const scroller = node.closest(".plan-phone-scroll")
    if (!(scroller instanceof HTMLElement)) return
    const delta = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    const top = scroller.scrollTop + delta - scroller.clientHeight * 0.35
    scroller.scrollTo?.({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" })
  }, [dayKey, reduce])

  let anchored = false
  const markAnchor = (minutes: number) => {
    if (anchored || minutes < anchorMinutes) return undefined
    anchored = true
    return anchorRef
  }

  return (
    <section
      className="plan-phone-agenda"
      data-ui-name="Day schedule"
      data-ui-help="Day agenda. Rows open the event, the item, or the planned action. Actions moves or clears a time."
      data-ui-docs="components/Home/Plan/README.md"
      data-ui-docs-anchor="day"
    >
      <header className="plan-phone-agenda-head">
        <h3>{format(currentDate, "EEEE, MMMM d")}</h3>
        {showOpenDay ? (
          <button type="button" className="plan-phone-key" data-no95="" onClick={onOpenDay}>
            Open day
          </button>
        ) : null}
      </header>
      {allDay.length > 0 && (
        <ul className="plan-phone-list">
          {allDay.map((event) => (
            <AgendaMain
              key={event.id}
              time="All day"
              title={event.title}
              detail={event.location}
              color={resolvePlanColor(event.color)}
              onOpen={() => onEvent(event)}
              onMenu={() => onMenu({ kind: "event", id: event.id, title: event.title })}
            />
          ))}
        </ul>
      )}
      {tokens.length > 0 && (
        <ul className="plan-phone-list">
          {tokens.map((token) => (
            <GemRow key={token.id} token={token} onOpen={() => onTask(token.openTaskId)} />
          ))}
        </ul>
      )}
      {anytime.length > 0 && (
        <ul className="plan-phone-list">
          {anytime.map((task) => (
            <TaskRow key={task.id} task={task} time="Anytime" onTask={onTask} onMenu={onMenu} />
          ))}
        </ul>
      )}
      <ul className="plan-phone-list">
        {timeline.map((row) => {
          if (row.kind === "now") {
            return (
              <li key="now" className="plan-phone-now" ref={markAnchor(row.minutes) ?? undefined}>
                <span>Now</span>
                <i />
                <time>{clockLabel(row.minutes)}</time>
              </li>
            )
          }
          if (row.kind === "sun") {
            return (
              <li key={row.id} className="plan-phone-sun" ref={markAnchor(row.minutes)}>
                {row.title}
              </li>
            )
          }
          if (row.kind === "ghost") {
            return (
              <li key={row.id} className="plan-phone-ghost" ref={markAnchor(row.minutes)}>
                <span className="plan-phone-time">{clockLabel(row.minutes)}</span>
                <span>
                  <span className="plan-phone-row-title">{row.title}</span>
                  <span className="plan-phone-row-detail">{row.detail}</span>
                </span>
              </li>
            )
          }
          const ref = markAnchor(row.minutes)
          if (row.kind === "event") {
            return (
              <AgendaMain
                key={`event-${row.id}`}
                rowRef={ref}
                time={clockLabel(row.minutes)}
                title={row.title}
                detail={row.detail}
                color={row.color}
                onOpen={() => onEvent(row.event)}
                onMenu={() => onMenu({ kind: "event", id: row.id, title: row.title })}
              />
            )
          }
          if (row.kind === "plan") {
            return (
              <AgendaMain
                key={`plan-${row.id}`}
                rowRef={ref}
                time={clockLabel(row.minutes)}
                title={row.title}
                detail={row.detail}
                color={row.color}
                planned
                onOpen={() => onPlan(row.action)}
                onMenu={() => onMenu({ kind: "plan", id: row.id, title: row.title })}
              />
            )
          }
          return (
            <AgendaMain
              key={`task-${row.id}`}
              rowRef={ref}
              time={clockLabel(row.minutes)}
              title={row.title}
              detail={row.detail}
              color={row.color}
              onOpen={() => onTask(row.id)}
              onMenu={() => onMenu({ kind: "task", id: row.id, title: row.title })}
            />
          )
        })}
        {timeline.length === 0 && allDay.length === 0 && anytime.length === 0 && tokens.length === 0 ? (
          <li className="plan-phone-empty">Nothing on this day</li>
        ) : null}
        {anchored ? null : <li ref={anchorRef} className="plan-phone-anchor" />}
      </ul>
    </section>
  )
}

function TaskRow({
  task,
  time,
  onTask,
  onMenu,
}: {
  task: Task
  time: string
  onTask: (id: string) => void
  onMenu: (menu: AgendaMenu) => void
}) {
  const before = getMustBeDoneBefore(task)
  return (
    <AgendaMain
      time={time}
      title={itemTitle(task)}
      detail={before ? `Before ${format(before, "MMM d")}` : undefined}
      color={PLAN_TASK_COLOR}
      onOpen={() => onTask(task.id)}
      onMenu={() => onMenu({ kind: "task", id: task.id, title: itemTitle(task) })}
    />
  )
}

function GemRow({ token, onOpen }: { token: PlanGemToken; onOpen: () => void }) {
  return (
    <li className="plan-phone-row" data-kind="gem">
      <button type="button" className="plan-phone-row-main plan-phone-key" data-no95="" onClick={onOpen}>
        <HabitGemImg src={token.src} title={token.title} width={28} height={28} />
        <span className="plan-phone-row-copy">
          <span className="plan-phone-row-title">{token.title}</span>
          <span className="plan-phone-row-detail">{token.kind === "habit" ? "Habit" : "Done"}</span>
        </span>
      </button>
    </li>
  )
}

function AgendaMain({
  time,
  title,
  detail,
  color,
  planned,
  onOpen,
  onMenu,
  rowRef,
}: {
  time: string
  title: string
  detail?: string
  color: string
  planned?: boolean
  onOpen: () => void
  onMenu: () => void
  rowRef?: Ref<HTMLLIElement>
}) {
  return (
    <li
      ref={rowRef}
      className="plan-phone-row"
      data-kind={planned ? "plan" : "item"}
      style={{ ["--bar" as string]: color }}
    >
      <button type="button" className="plan-phone-row-main plan-phone-key" data-no95="" onClick={onOpen}>
        <span className="plan-phone-time">{time}</span>
        <span className="plan-phone-row-copy">
          <span className="plan-phone-row-title">{title}</span>
          {detail ? <span className="plan-phone-row-detail">{detail}</span> : null}
        </span>
      </button>
      <button type="button" className="plan-phone-row-more plan-phone-key" data-no95="" aria-label={`Actions for ${title}`} onClick={onMenu}>
        Actions
      </button>
    </li>
  )
}
