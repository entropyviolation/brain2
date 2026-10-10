/**
 * Events and Thought process for the Now popup. Same rows and writers as
 * the Home Tracking log. This file does not change that desk.
 */
"use client"

import { useMemo, useState } from "react"
import {
  classifyLogBookRow,
  compareLogRows,
  logClockLabel,
  submitTrackingLog,
  type LogBookEntry,
  type LogBookList,
} from "@/components/Home/Tracking/tracking-log-model"
import { EstMark } from "@/components/header-tracking/est-mark"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

function rowsFor(dayKey: string, list: LogBookList): LogBookEntry[] {
  const { entries, scopes } = useTimeTrackingStore.getState()
  const penName = new Map<string, string>()
  for (const scope of scopes) {
    for (const pen of scope.pens) penName.set(pen.id, pen.name)
  }
  const rows: LogBookEntry[] = []
  for (const entry of entries) {
    if (entry.date !== dayKey) continue
    const row = classifyLogBookRow(entry, penName.get(entry.penId))
    if (row?.list === list) rows.push(row)
  }
  rows.sort(compareLogRows)
  return rows
}

function minuteFor(dayKey: string): number {
  const now = new Date()
  if (formatLocalDateKey(now) !== dayKey) return 8 * 60
  return now.getHours() * 60 + now.getMinutes()
}

function NowLogList({
  dayKey,
  list,
  title,
  note,
  placeholder,
}: {
  dayKey: string
  list: "event" | "thought"
  title: string
  note: string
  placeholder: string
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [text, setText] = useState("")
  const rows = useMemo(() => rowsFor(dayKey, list), [dayKey, list, entries, scopes])

  function add() {
    const titleText = text.trim()
    if (!titleText) return
    const id = submitTrackingLog({
      date: dayKey,
      title: titleText,
      mode: list === "thought" ? "thought" : "event",
      clock: "exact",
      minute: minuteFor(dayKey),
    })
    if (id) setText("")
  }

  return (
    <section className="trk-aside-well htk-log-well" aria-label={title}>
      <h3 className="trk-logbook-heading">{title}</h3>
      <p className="trk-logbook-note">{note}</p>
      {rows.length === 0 ? (
        <p className="trk-logbook-note">None</p>
      ) : (
        <div className="trk-log">
          {rows.map((entry) => {
            const clock = logClockLabel(entry)
            const estimated = clock.badge === "Estimated"
            return (
              <div key={entry.id} className="trk-log-row">
                {clock.time ? (
                  <span className="trk-log-when">
                    <EstMark estimated={estimated}>{clock.time}</EstMark>
                  </span>
                ) : null}
                <span className="trk-log-copy">{entry.title?.trim() || "Untitled"}</span>
                {clock.badge ? <span className="trk-logbook-badge">{clock.badge}</span> : null}
              </div>
            )
          })}
        </div>
      )}
      <div className="htk-row htk-log-add">
        <input
          aria-label={`Add to ${title}`}
          value={text}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            event.preventDefault()
            add()
          }}
        />
        <button type="button" aria-label={`Add to ${title}`} onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </section>
  )
}

export function NowLogLists({ dayKey }: { dayKey: string }) {
  return (
    <div className="trk95 trk-logbook htk-logs">
      <NowLogList
        dayKey={dayKey}
        list="event"
        title="Events"
        note="Any repeated phrase can be counted later. Example: left room."
        placeholder="left room"
      />
      <NowLogList
        dayKey={dayKey}
        list="thought"
        title="Thought process"
        note="A strand from what you are doing, to what it leads to, to how it feels."
        placeholder="A strand from what you are doing, to what it leads to, to how it feels."
      />
    </div>
  )
}
