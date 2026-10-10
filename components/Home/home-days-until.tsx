/**
 * components/Home/home-days-until.tsx — Days Until / Days Since live tiles
 *
 * One square per saved mark. Countdown-to or count-up-from, optional Plan
 * event attach, and an optional all-day scheduler day. The compact card
 * shows the chosen form and ticks while open.
 */
"use client"

import { useEffect, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { daysUntilCaption, daysUntilLiveFace, daysUntilRemainingMs } from "@/lib/home-widgets"
import {
  useHomeDaysUntilStore,
  type DaysUntilFormat,
  type DaysUntilMode,
  type HomeDaysUntilItem,
} from "@/lib/home-days-until-store"
import { daysUntilFieldsFromEvent, syncDaysUntilScheduledEvent } from "@/lib/home-days-until-event"
import { useEventStore } from "@/lib/event-store"
import { formatLocalDateKey, toLocalCalendarDate } from "@/lib/date-utils"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"

function useNowTick(open: boolean) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (open) setNow(new Date())
  }, [open])
  return now
}

function syncScheduled(item: HomeDaysUntilItem) {
  if (!item.scheduleAllDay || !item.date) return
  const eventId = syncDaysUntilScheduledEvent({
    item,
    events: useEventStore.getState().events,
    addEvent: useEventStore.getState().addEvent,
    updateEvent: useEventStore.getState().updateEvent,
  })
  if (eventId && eventId !== item.eventId) {
    useHomeDaysUntilStore.getState().updateCountdown(item.id, { eventId })
  }
}

export function DaysUntilTiles({
  currentDate: _currentDate,
  onHideFamily,
}: {
  currentDate: Date
  onHideFamily: () => void
}) {
  void _currentDate
  const items = useHomeDaysUntilStore((s) => s.items)

  return (
    <>
      {items.map((item) => (
        <DaysUntilTile key={item.id} itemId={item.id} onHide={onHideFamily} />
      ))}
    </>
  )
}

export function DaysUntilTile({
  itemId,
  onHide,
}: {
  itemId: string
  onHide: () => void
}) {
  const item = useHomeDaysUntilStore((s) => s.items.find((entry) => entry.id === itemId))
  const updateCountdown = useHomeDaysUntilStore((s) => s.updateCountdown)
  const addCountdown = useHomeDaysUntilStore((s) => s.addCountdown)
  const removeCountdown = useHomeDaysUntilStore((s) => s.removeCountdown)
  const items = useHomeDaysUntilStore((s) => s.items)
  const events = useEventStore((s) => s.events)
  const [open, setOpen] = useState(false)
  const now = useNowTick(open)

  if (!item) return null

  const remainingMs = daysUntilRemainingMs(item.date, item.time, now)
  const face = daysUntilLiveFace({
    remainingMs,
    label: item.label,
    format: item.format,
    hasTime: Boolean(item.time),
    mode: item.mode,
  })
  const caption = daysUntilCaption(item.mode, remainingMs)
  const linked = item.eventId ? events.find((event) => event.id === item.eventId) : undefined
  const attachable = [...events]
    .filter((event) => event.type === "event" || event.type === "hardcoded")
    .sort((a, b) => toLocalCalendarDate(a.date).getTime() - toLocalCalendarDate(b.date).getTime())

  const patch = (next: Partial<Omit<HomeDaysUntilItem, "id">>) => {
    const merged = { ...item, ...next }
    updateCountdown(item.id, next)
    if (merged.scheduleAllDay) {
      window.setTimeout(() => {
        const fresh = useHomeDaysUntilStore.getState().items.find((entry) => entry.id === item.id)
        if (fresh) syncScheduled(fresh)
      }, 0)
    }
  }

  return (
    <>
      <div
        className="home-tile is-daysuntil"
        data-widget="daysuntil"
        data-daysuntil-id={item.id}
        data-testid="home-daysuntil-tile"
      >
        <TileHide id={`daysuntil-${item.id}`} onHide={onHide} />
        <TileOpen label={caption} onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>{caption}</span>
          </div>
          <div className="hab-score-readout home-daysuntil-count" data-centered="true" suppressHydrationWarning>
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title={caption}>
        <WidgetWell label={caption === "Days Since" ? "Since" : "Until"}>
          <span suppressHydrationWarning>{face.crt}</span>
        </WidgetWell>
        <p className="home-widget-note">{face.footer}</p>

        <fieldset className="home-widget-fieldset">
          <legend>Mode</legend>
          <label className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-mode-${item.id}`}
              checked={item.mode === "countdown"}
              onChange={() => patch({ mode: "countdown" satisfies DaysUntilMode })}
            />
            Countdown to the event
          </label>
          <label className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-mode-${item.id}`}
              checked={item.mode === "countup"}
              onChange={() => patch({ mode: "countup" })}
            />
            Count up from the event
          </label>
          <label className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-mode-${item.id}`}
              checked={item.mode === "auto"}
              onChange={() => patch({ mode: "auto" })}
            />
            Auto — Until ahead, Since once past
          </label>
        </fieldset>

        <label className="home-widget-field">
          Label
          <input
            value={item.label}
            maxLength={40}
            onChange={(event) => patch({ label: event.target.value })}
          />
        </label>
        <label className="home-widget-field">
          Date
          <input
            type="date"
            value={item.date}
            onChange={(event) => patch({ date: event.target.value })}
          />
        </label>
        <label className="home-widget-field">
          Time <span className="home-widget-optional">(optional · empty is local midnight)</span>
          <ClockPicker value={item.time} onChange={(next) => patch({ time: next })} />
        </label>
        {item.time ? (
          <button type="button" className="home-review-key" onClick={() => patch({ time: "" })}>
            Clear time
          </button>
        ) : null}

        <fieldset className="home-widget-fieldset">
          <legend>Display</legend>
          <label className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-format-${item.id}`}
              checked={item.format === "unit"}
              onChange={() => patch({ format: "unit" satisfies DaysUntilFormat })}
            />
            Units — <code>01 day 3 hours</code> / <code>03 hours 30 min</code>
          </label>
          <label className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-format-${item.id}`}
              checked={item.format === "decimal"}
              onChange={() => patch({ format: "decimal" })}
            />
            Decimal — <code>1.25 days</code> / <code>3.5 hours</code>
          </label>
        </fieldset>

        <fieldset className="home-widget-fieldset">
          <legend>Plan event</legend>
          <label className="home-widget-choice">
            <input
              type="checkbox"
              checked={item.scheduleAllDay}
              onChange={(event) => patch({ scheduleAllDay: event.target.checked })}
            />
            Schedule as an all-day event
          </label>
          {linked ? (
            <p className="home-widget-note">
              Linked to {linked.title} · {formatLocalDateKey(toLocalCalendarDate(linked.date))}
              {linked.isAllDay ? " · all day" : ` · ${linked.startTime}`}
            </p>
          ) : null}
          <label className="home-widget-field">
            Attach existing event
            <select
              value={item.eventId}
              onChange={(event) => {
                const id = event.target.value
                if (!id) {
                  patch({ eventId: "", scheduleAllDay: false })
                  return
                }
                const found = events.find((entry) => entry.id === id)
                if (!found) return
                patch(daysUntilFieldsFromEvent(found))
              }}
            >
              <option value="">None</option>
              {attachable.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatLocalDateKey(toLocalCalendarDate(event.date))}
                  {event.isAllDay ? "" : ` ${event.startTime}`} — {event.title || "Untitled"}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <div className="home-widget-actions">
          <button
            type="button"
            className="home-review-key"
            onClick={() => {
              addCountdown({
                mode: item.mode,
                format: item.format,
              })
            }}
          >
            Add another
          </button>
          {items.length > 1 ? (
            <button
              type="button"
              className="home-review-key"
              onClick={() => {
                removeCountdown(item.id)
                setOpen(false)
              }}
            >
              Remove this
            </button>
          ) : null}
        </div>
      </HomeWidgetDialog>
    </>
  )
}
