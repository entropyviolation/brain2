/**
 * components/Home/Tracking/tracking-log/count-statuses-section.tsx — Counts under the composer
 *
 * One beveled well. A count is a name, a total, +, and a short time list.
 * Examples: joints, days happy.
 */
"use client"

import { useEffect, useState } from "react"
import { LogShelfDialog } from "@/components/Home/Tracking/tracking-log/log-shelf-dialog"
import { ensureCountForKeyword, useCountStatusesStore, type CountStatus, type CountTick } from "@/lib/count-statuses"
import { logKeywordPhrase, useLogKeywordsStore } from "@/lib/log-keywords-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesToLabel, type IntakeClass } from "@/lib/time-entries"
import { NativeSelect } from "@/components/ui/native-select"

const RECENT = 6

function shortDate(key: string): string {
  const [year, month, day] = key.split("-")
  if (!year || !month || !day) return key
  return `${Number(month)}/${Number(day)}`
}

function tickFace(tick: CountTick, today: string): { text: string; badge?: "Estimated" | "Unknown" } {
  const day = tick.date === today ? "" : shortDate(tick.date)
  if (tick.clockCertainty === "unknown") return { text: day, badge: "Unknown" }
  const time = minutesToLabel(tick.startMin)
  const text = day ? `${day} ${time}` : time
  if (tick.clockCertainty === "estimated") return { text, badge: "Estimated" }
  return { text }
}

const pad = (n: number) => String(n).padStart(2, "0")

function TickEditor({ count }: { count: CountStatus }) {
  const updateTick = useCountStatusesStore((state) => state.updateTick)
  const removeTick = useCountStatusesStore((state) => state.removeTick)
  const ticks = [...count.ticks].reverse()
  return (
    <ul className="trk-count-ticks" aria-label={`${count.name} times`}>
      {ticks.map((tick) => {
        const save = (patch: Partial<{ date: string; startMin: number; clockCertainty: CountTick["clockCertainty"] | "exact" }>) =>
          updateTick(count.id, tick.id, { date: tick.date, startMin: tick.startMin, clockCertainty: tick.clockCertainty, ...patch })
        return (
          <li key={tick.id}>
            <input
              type="date"
              aria-label="Date"
              value={tick.date}
              onChange={(event) => event.target.value && save({ date: event.target.value })}
            />
            <input
              type="time"
              aria-label="Time"
              value={`${pad(Math.floor(tick.startMin / 60))}:${pad(tick.startMin % 60)}`}
              onChange={(event) => {
                const [h, m] = event.target.value.split(":").map(Number)
                if (Number.isFinite(h) && Number.isFinite(m)) save({ startMin: h! * 60 + m! })
              }}
            />
            <NativeSelect
              aria-label="Clock certainty"
              value={tick.clockCertainty ?? "exact"}
              onChange={(event) => save({ clockCertainty: event.target.value as "exact" | "estimated" | "unknown" })}
            >
              <option value="exact">Exact</option>
              <option value="estimated">Estimated</option>
              <option value="unknown">Unknown</option>
            </NativeSelect>
            <button type="button" aria-label="Remove tick" onClick={() => removeTick(count.id, tick.id)}>
              ×
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function CountRow({ count, today, expanded = false }: { count: CountStatus; today: string; expanded?: boolean }) {
  const renameCount = useCountStatusesStore((state) => state.renameCount)
  const removeCount = useCountStatusesStore((state) => state.removeCount)
  const incrementCount = useCountStatusesStore((state) => state.incrementCount)
  const [name, setName] = useState(count.name)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setName(count.name)
  }, [count.name])

  function commit() {
    if (!renameCount(count.id, name)) setName(count.name)
  }

  const recent = count.ticks.slice(-RECENT)

  return (
    <li className="trk-count-row">
      <input
        className="trk-count-name"
        aria-label={`Rename ${count.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
      />
      <span className="trk-count-total" aria-label={`${count.name} total`}>
        {count.ticks.length}
      </span>
      <button type="button" aria-label={`Increment ${count.name}`} onClick={() => incrementCount(count.id)}>
        +
      </button>
      {recent.length > 0 ? (
        <span className="trk-count-times">
          {recent.map((tick) => {
            const face = tickFace(tick, today)
            return (
              <span key={tick.id} className="trk-count-time">
                {face.text ? <span>{face.text}</span> : null}
                {face.badge ? <span className="trk-logbook-badge">{face.badge}</span> : null}
              </span>
            )
          })}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={`Edit times for ${count.name}`}
        aria-expanded={editing}
        disabled={count.ticks.length === 0}
        onClick={() => setEditing((v) => !v)}
      >
        {editing ? "Done" : "Edit times"}
      </button>
      <button type="button" aria-label={`Delete ${count.name}`} onClick={() => removeCount(count.id)}>
        Delete
      </button>
      {expanded || editing ? <TickEditor count={count} /> : null}
    </li>
  )
}

export function CountStatusesSection() {
  const counts = useCountStatusesStore((state) => state.counts)
  const addCount = useCountStatusesStore((state) => state.addCount)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [intake, setIntake] = useState<"" | IntakeClass>("")
  const [keyword, setKeyword] = useState("")
  const today = formatLocalDateKey(new Date())
  const keywords = useLogKeywordsStore((state) => state.keywords)
  const untallied = keywords
    .map(logKeywordPhrase)
    .filter((phrase) => !counts.some((c) => c.keyword?.toLowerCase() === phrase.toLowerCase() || c.name.toLowerCase() === phrase.toLowerCase()))

  function add() {
    const id = addCount({
      name,
      intakeClass: intake,
      keyword: keyword.trim() ? keyword : undefined,
    })
    if (!id) return
    setName("")
    setIntake("")
    setKeyword("")
  }

  return (
    <section className="trk-aside-well trk-count-statuses" aria-label="Counts" data-testid="tracking-counts">
      <h3 className="trk-logbook-heading">
        <button type="button" className="trk-logbook-heading-open" data-no95="" onClick={() => setOpen(true)} title="Open counts">
          Counts
          <span aria-hidden="true"> ›</span>
        </button>
      </h3>
      <p className="trk-logbook-note">A named tally. Each + is one time. Examples: joints, days happy.</p>
      <div className="trk-logbook-add trk-count-create">
        <input
          aria-label="Count name"
          placeholder="joints"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <label className="trk-logbook-view">
          Intake
          <NativeSelect aria-label="Intake class" value={intake} onChange={(event) => setIntake(event.target.value as "" | IntakeClass)}>
            <option value="">None</option>
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="drink">Drink</option>
          </NativeSelect>
        </label>
        <input
          aria-label="Count keyword"
          placeholder="keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <button type="button" aria-label="Add count" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {untallied.length > 0 ? (
        <p className="trk-count-suggest" aria-label="Saved phrases to tally">
          <span>Start a tally:</span>
          {untallied.map((phrase) => (
            <button key={phrase} type="button" onClick={() => ensureCountForKeyword(phrase)}>
              {phrase} +
            </button>
          ))}
        </p>
      ) : null}
      {counts.length > 0 ? (
        <ul className="trk-count-list">
          {counts.map((count) => (
            <CountRow key={count.id} count={count} today={today} />
          ))}
        </ul>
      ) : null}
      <LogShelfDialog
        open={open}
        onOpenChange={setOpen}
        title="Counts"
        description="A named tally. Each + is one time. Times can be corrected here."
      >
        {counts.length === 0 ? (
          <p className="trk-shelf-empty">No counts yet.</p>
        ) : (
          <ul className="trk-count-list">
            {counts.map((count) => (
              <CountRow key={count.id} count={count} today={today} expanded />
            ))}
          </ul>
        )}
      </LogShelfDialog>
    </section>
  )
}
