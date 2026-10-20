/**
 * components/Home/home-days-until.tsx — Countdown (was Days Until / Days Since)
 *
 * One Countdown copy draws one saved mark (`settings.markId` → the mark in
 * `home-days-until-store.ts`). The face is the live count; the face math is
 * `lib/countdown.ts`. The detail is the instrument: the count, the date it
 * counts to after any repeat, progress from a start date, the milestone, and
 * the Plan event. The gear edits the mark: mode, label, date, time, units,
 * repeat, start, milestones, what happens once it passes, and the Plan
 * event. Removing the copy removes its mark.
 */
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { countdownFace } from "@/lib/countdown"
import {
  useHomeDaysUntilStore,
  type DaysUntilFormat,
  type DaysUntilMode,
  type DaysUntilRepeat,
  type DaysUntilWhenPassed,
  type HomeDaysUntilItem,
} from "@/lib/home-days-until-store"
import { CopyCaption } from "@/components/Home/widgets/copy-context"
import { daysUntilFieldsFromEvent, syncDaysUntilScheduledEvent } from "@/lib/home-days-until-event"
import { useEventStore } from "@/lib/event-store"
import { formatLocalDateKey, toLocalCalendarDate } from "@/lib/date-utils"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"
import { NativeSelect } from "@/components/ui/native-select"

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

export function DaysUntilTile({
  itemId,
  onHide,
}: {
  itemId: string
  onHide: () => void
}) {
  const item = useHomeDaysUntilStore((s) => s.items.find((entry) => entry.id === itemId))
  const addCountdown = useHomeDaysUntilStore((s) => s.addCountdown)
  const removeCountdown = useHomeDaysUntilStore((s) => s.removeCountdown)
  const events = useEventStore((s) => s.events)
  const [open, setOpen] = useState(false)
  const now = useNowTick(open)

  if (!item) return null

  const face = countdownFace(item, now)
  if (face.hidden && !open) return null
  const linked = item.eventId ? events.find((event) => event.id === item.eventId) : undefined
  const pct = face.progress == null ? null : Math.round(face.progress * 100)

  return (
    <>
      <div
        className="home-tile is-daysuntil"
        data-widget="daysuntil"
        data-daysuntil-id={item.id}
        data-testid="home-daysuntil-tile"
        data-milestone={face.milestone ? "on" : undefined}
        data-passed={face.passed ? "true" : undefined}
      >
        <TileHide id="daysuntil" onHide={onHide} />
        <TileOpen label={face.caption} onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>{face.caption}</CopyCaption>
            </span>
          </div>
          <div className="hab-score-readout home-daysuntil-count" data-centered="true" suppressHydrationWarning>
            {face.crt}
          </div>
          {pct != null ? (
            <span className="home-widget-meter home-countdown-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the mark">
              <span style={{ width: `${pct}%` }} />
            </span>
          ) : null}
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog
        open={open}
        onOpenChange={setOpen}
        title={item.label.trim() || face.caption}
        settings={<CountdownSettings item={item} />}
        onRemoveCopy={() => removeCountdown(item.id)}
        removeNote="Its mark is deleted too; a Plan event it made stays on the calendar."
      >
        <WidgetWell label={face.caption === "Count up" ? "Since" : "Until"}>
          <span suppressHydrationWarning>{face.crt}</span>
        </WidgetWell>
        <p className="home-widget-note">{face.footer}</p>
        {face.date ? (
          <p className="home-widget-note">
            {face.caption === "Count up" ? "From" : "To"} {formatMarkDate(face.date)}
            {item.time ? ` at ${item.time}` : ""}
            {item.repeat !== "none" ? ` · repeats ${item.repeat}` : ""}
          </p>
        ) : null}
        {pct != null ? (
          <WidgetWell label="Along the way" tone="nixie">
            {pct}%
            <span className="home-widget-meter" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          </WidgetWell>
        ) : null}
        {face.milestone ? <p className="home-widget-lead">Milestone: {face.milestone}</p> : null}
        {linked ? (
          <p className="home-widget-note">
            Plan event: {linked.title} · {formatLocalDateKey(toLocalCalendarDate(linked.date))}
            {linked.isAllDay ? " · all day" : ` · ${linked.startTime}`}
          </p>
        ) : null}
        {!item.date ? <p className="home-widget-note">Open the gear to set the date.</p> : null}
        <div className="home-widget-actions">
          <button
            type="button"
            className="home-review-key"
            onClick={() => {
              addCountdown({ mode: item.mode, format: item.format })
            }}
          >
            Add another Countdown
          </button>
        </div>
      </HomeWidgetDialog>
    </>
  )
}

function formatMarkDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

const FORMAT_CHOICES: { value: DaysUntilFormat; label: ReactNode }[] = [
  { value: "unit", label: <>Days and hours — <code>01 day 3 hours</code></> },
  { value: "decimal", label: <>Decimal — <code>1.25 days</code></> },
  { value: "days", label: "Whole days" },
  { value: "weeks", label: "Weeks" },
  { value: "sleeps", label: "Sleeps (nights to go)" },
  { value: "workdays", label: "Working days (Mon–Fri)" },
]

/** The gear's Countdown panel: it edits the copy's mark. */
export function CountdownSettings({ item }: { item: HomeDaysUntilItem }) {
  const updateCountdown = useHomeDaysUntilStore((s) => s.updateCountdown)
  const events = useEventStore((s) => s.events)
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
    <section className="vd-settings-group" aria-label="Countdown settings">
      <h4>Countdown</h4>
      <label className="home-widget-field">
        Label
        <input value={item.label} maxLength={40} onChange={(event) => patch({ label: event.target.value })} />
      </label>
      <label className="home-widget-field">
        Date
        <input type="date" value={item.date} onChange={(event) => patch({ date: event.target.value })} />
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
        <legend>Counts</legend>
        {(
          [
            ["countdown", "Down to the date"],
            ["countup", "Up from the date"],
            ["auto", "Down, then up once it passes"],
          ] as [DaysUntilMode, string][]
        ).map(([value, label]) => (
          <label key={value} className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-mode-${item.id}`}
              checked={item.mode === value}
              onChange={() => patch({ mode: value })}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {item.mode === "countdown" ? (
        <fieldset className="home-widget-fieldset">
          <legend>Once it passes</legend>
          {(
            [
              ["stay", "Stay at 0 and say it passed"],
              ["countup", "Start counting up"],
              ["hide", "Hide the face"],
            ] as [DaysUntilWhenPassed, string][]
          ).map(([value, label]) => (
            <label key={value} className="home-widget-choice">
              <input
                type="radio"
                name={`daysuntil-passed-${item.id}`}
                checked={item.whenPassed === value}
                onChange={() => patch({ whenPassed: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="home-widget-fieldset">
        <legend>Units</legend>
        {FORMAT_CHOICES.map((choice) => (
          <label key={choice.value} className="home-widget-choice">
            <input
              type="radio"
              name={`daysuntil-format-${item.id}`}
              checked={item.format === choice.value}
              onChange={() => patch({ format: choice.value })}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>

      {item.mode !== "countup" ? (
        <fieldset className="home-widget-fieldset">
          <legend>Repeats</legend>
          {(
            [
              ["none", "Once"],
              ["yearly", "Every year (birthdays, anniversaries)"],
              ["monthly", "Every month"],
            ] as [DaysUntilRepeat, string][]
          ).map(([value, label]) => (
            <label key={value} className="home-widget-choice">
              <input
                type="radio"
                name={`daysuntil-repeat-${item.id}`}
                checked={item.repeat === value}
                onChange={() => patch({ repeat: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ) : null}

      {item.mode !== "countup" ? (
        <label className="home-widget-field">
          Start <span className="home-widget-optional">(optional · draws how far along the span is)</span>
          <input type="date" value={item.start} onChange={(event) => patch({ start: event.target.value })} />
        </label>
      ) : null}

      {item.mode !== "countdown" ? (
        <label className="home-widget-choice">
          <input type="checkbox" checked={item.milestones} onChange={(event) => patch({ milestones: event.target.checked })} />
          Milestones: light the face every 100 days and each year
        </label>
      ) : null}

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
          <NativeSelect
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
          </NativeSelect>
        </label>
      </fieldset>
    </section>
  )
}
