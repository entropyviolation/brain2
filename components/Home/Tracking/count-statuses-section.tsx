/**
 * components/Home/Tracking/count-statuses-section.tsx — Counts under the composer
 *
 * One beveled well. A count is a name, a total, +, and a short time list.
 * Examples: joints, days happy.
 */
"use client"

import { useEffect, useState } from "react"
import { useCountStatusesStore, type CountStatus, type CountTick } from "@/lib/count-statuses"
import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesToLabel, type IntakeClass } from "@/lib/time-entries"

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

function CountRow({ count, today }: { count: CountStatus; today: string }) {
  const renameCount = useCountStatusesStore((state) => state.renameCount)
  const removeCount = useCountStatusesStore((state) => state.removeCount)
  const incrementCount = useCountStatusesStore((state) => state.incrementCount)
  const [name, setName] = useState(count.name)

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
      <button type="button" aria-label={`Delete ${count.name}`} onClick={() => removeCount(count.id)}>
        Delete
      </button>
    </li>
  )
}

export function CountStatusesSection() {
  const counts = useCountStatusesStore((state) => state.counts)
  const addCount = useCountStatusesStore((state) => state.addCount)
  const [name, setName] = useState("")
  const [intake, setIntake] = useState<"" | IntakeClass>("")
  const [keyword, setKeyword] = useState("")
  const today = formatLocalDateKey(new Date())

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
      <h3 className="trk-logbook-heading">Counts</h3>
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
          <select aria-label="Intake class" value={intake} onChange={(event) => setIntake(event.target.value as "" | IntakeClass)}>
            <option value="">None</option>
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="drink">Drink</option>
          </select>
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
      {counts.length > 0 ? (
        <ul className="trk-count-list">
          {counts.map((count) => (
            <CountRow key={count.id} count={count} today={today} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
