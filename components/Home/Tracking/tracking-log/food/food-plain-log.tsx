"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-plain-log.tsx — One day's lines and note
 *
 * The lines are the same food instants as the lists. A new line is a title
 * until Accept. A changed time follows onto ticks linked to that entry.
 * The note is the day note and stays out of the nutrient totals.
 */

import { useEffect, useState } from "react"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { compareLogRows, submitTrackingLog, type LogBookEntry } from "@/components/Home/Tracking/tracking-log-model"
import { syncCountTicksForEntry } from "@/lib/count-statuses"
import { formatLocalDateKey } from "@/lib/date-utils"
import { parseClockToken } from "@/lib/ingest/times"
import { readDayNote, useKitchenDayNotes, writeDayNote } from "@/lib/kitchen-day-note"
import type { KitchenPlate } from "@/lib/kitchen-types"
import { entryClockCertainty, minutesToLabel } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

function MealThumb({ uri }: { uri?: string }) {
  const src = useAttachmentSrc(uri)
  if (!src) return null
  return <img className="trk-food-thumb" src={src} alt="Meal photo" width={36} height={36} />
}

function splitLogLine(raw: string): { title: string; minute: number | null } {
  const text = raw.trim()
  if (!text) return { title: "", minute: null }
  const parts = text.split(/\s+/)
  const first = parts[0] ?? ""
  const second = parts[1] ?? ""
  const withMeridiem = parseClockToken(`${first} ${second}`)
  if (withMeridiem != null && /^(am|pm)$/i.test(second)) {
    return { minute: withMeridiem, title: parts.slice(2).join(" ").trim() }
  }
  const one = parseClockToken(first)
  const clockWord = /[:ap]/i.test(first) || /^(noon|midnight)$/i.test(first)
  if (one != null && clockWord) return { minute: one, title: parts.slice(1).join(" ").trim() }
  return { title: text, minute: null }
}

function LogLine({ entry, photoId }: { entry: LogBookEntry; photoId?: string }) {
  const unknown = entryClockCertainty(entry) === "unknown"
  const [title, setTitle] = useState(entry.title ?? "")
  const [time, setTime] = useState(unknown ? "" : minutesToLabel(entry.startMin))

  useEffect(() => {
    setTitle(entry.title ?? "")
  }, [entry.id, entry.title])

  useEffect(() => {
    setTime(entryClockCertainty(entry) === "unknown" ? "" : minutesToLabel(entry.startMin))
  }, [entry.id, entry.startMin, entry.clockCertainty])

  const commitTitle = () => {
    const next = title.trim()
    if (!next || next === (entry.title ?? "").trim()) {
      setTitle(entry.title ?? "")
      return
    }
    useTimeTrackingStore.getState().updateEntry(entry.id, { title: next })
  }

  const commitTime = () => {
    if (entryClockCertainty(entry) === "unknown") return
    const minute = parseClockToken(time)
    if (minute == null) {
      setTime(minutesToLabel(entry.startMin))
      return
    }
    if (minute === entry.startMin) return
    const span = entry.endMin - entry.startMin
    useTimeTrackingStore.getState().updateEntry(entry.id, { startMin: minute, endMin: minute + span })
    syncCountTicksForEntry(entry.id)
  }

  return (
    <li>
      <MealThumb uri={photoId} />
      {unknown ? (
        <span>Unknown</span>
      ) : (
        <label>
          Time
          <input
            className="trk-food-log-time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            onBlur={commitTime}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitTime()
              }
            }}
          />
        </label>
      )}
      <label className="trk-food-log-title-label">
        Title
          <input
            className="trk-food-log-title"
            value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitTitle()
            }
          }}
        />
      </label>
    </li>
  )
}

export function FoodPlainLog({ day, rows, plates = [] }: { day: string; rows: readonly LogBookEntry[]; plates?: readonly KitchenPlate[] }) {
  const stored = useKitchenDayNotes((s) => s.notes[day] ?? "")
  const [line, setLine] = useState("")
  const [note, setNote] = useState(() => readDayNote(day))
  const ordered = [...rows].sort(compareLogRows)

  useEffect(() => {
    setNote(stored)
  }, [day, stored])

  const addLine = () => {
    const split = splitLogLine(line)
    const title = split.title || (split.minute != null ? "Meal" : "")
    if (!title) return
    const now = new Date()
    const minute = split.minute ?? (day === formatLocalDateKey(now) ? now.getHours() * 60 + now.getMinutes() : 12 * 60)
    const id = submitTrackingLog({
      date: day,
      title,
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute,
    })
    if (!id) return
    setLine("")
  }

  return (
    <div className="trk-food-log">
      <ul>
        {ordered.map((entry) => (
          <LogLine key={entry.id} entry={entry} photoId={plates.find((plate) => plate.entryId === entry.id)?.photoId} />
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          addLine()
        }}
      >
        <label>
          Line
          <input value={line} onChange={(event) => setLine(event.target.value)} />
        </label>
        <button type="submit" data-no95="" className="trk-keycap">Add</button>
      </form>
      <label>
        Note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            if (note !== stored) writeDayNote(day, note)
          }}
        />
      </label>
    </div>
  )
}
