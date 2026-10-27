/**
 * Events, Notes, and Thought process for the Now popup. Same rows and writers
 * as the Home Tracking log. This file does not change that desk.
 *
 * A Text log instant with a phrase `eventKind` is an Event. One with no
 * `eventKind` is a Note (`classifyLogBookRow` list `note`). Thought process
 * stays `eventKind` `thought-process`. The Tracking log shelves notes the same way.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import {
  classifyLogBookRow,
  compareLogRows,
  logClockLabel,
  submitTrackingLog,
  type LogBookEntry,
} from "@/components/Home/Tracking/tracking-log-model"
import { EstMark } from "@/components/header-tracking/est-mark"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

type NowList = "event" | "note" | "thought"

function visibleNoteBody(notes: string | undefined): string {
  if (!notes) return ""
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "from text pipeline" && !/^from text message at\b/i.test(line))
    .join("\n")
}

function rowsFor(dayKey: string, list: NowList): LogBookEntry[] {
  const { entries, scopes } = useTimeTrackingStore.getState()
  const penName = new Map<string, string>()
  for (const scope of scopes) {
    for (const pen of scope.pens) penName.set(pen.id, pen.name)
  }
  const rows: LogBookEntry[] = []
  for (const entry of entries) {
    if (entry.date !== dayKey) continue
    const row = classifyLogBookRow(entry, penName.get(entry.penId))
    if (!row) continue
    if (row.list === list) rows.push(row)
  }
  rows.sort(compareLogRows)
  return rows
}

function minuteFor(dayKey: string): number {
  const now = new Date()
  if (formatLocalDateKey(now) !== dayKey) return 8 * 60
  return now.getHours() * 60 + now.getMinutes()
}

function fitField(el: HTMLTextAreaElement) {
  el.style.height = "0px"
  el.style.height = `${el.scrollHeight}px`
}

function NowLogList({
  dayKey,
  list,
  title,
  note,
  placeholder,
}: {
  dayKey: string
  list: NowList
  title: string
  note: string
  placeholder: string
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")
  const rows = useMemo(() => rowsFor(dayKey, list), [dayKey, list, entries, scopes])

  function add() {
    const titleText = text.trim()
    if (!titleText) return
    const id = submitTrackingLog({
      date: dayKey,
      title: titleText,
      mode: list === "thought" ? "thought" : list === "note" ? "note" : "event",
      clock: "exact",
      minute: minuteFor(dayKey),
      logSource: "now-popup",
    })
    if (!id) return
    setText("")
    if (fieldRef.current) fieldRef.current.style.height = ""
  }

  return (
    <section className="trk-aside-well htk-log-well" aria-label={title}>
      <h3 className="trk-logbook-heading">{title}</h3>
      <p className="trk-logbook-note">{note}</p>
      {rows.length === 0 ? (
        <p className="trk-logbook-note htk-log-empty">None</p>
      ) : (
        <div className="trk-log">
          {rows.map((entry) => {
            const clock = logClockLabel(entry)
            const estimated = clock.badge === "Estimated"
            const body = visibleNoteBody(entry.notes)
            const titleText = entry.title?.trim() || "Untitled"
            return (
              <div key={entry.id} className="trk-log-row">
                {clock.time ? (
                  <span className="trk-log-when">
                    <EstMark estimated={estimated}>{clock.time}</EstMark>
                  </span>
                ) : null}
                <span className="trk-log-copy">
                  {titleText}
                  {body ? <span className="trk-log-body">{body}</span> : null}
                </span>
                {clock.badge ? <span className="trk-logbook-badge">{clock.badge}</span> : null}
              </div>
            )
          })}
        </div>
      )}
      <div className="htk-row htk-log-add">
        <textarea
          ref={fieldRef}
          aria-label={`Add to ${title}`}
          rows={1}
          value={text}
          placeholder={placeholder}
          title="Enter adds this line. Shift+Enter starts another line."
          onChange={(event) => {
            setText(event.target.value)
            fitField(event.currentTarget)
          }}
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

/** Events, Notes, and Thought process. The parent supplies the `.trk95 .trk-logbook` chassis. */
export function NowLogLists({ dayKey }: { dayKey: string }) {
  return (
    <div className="htk-log-pair">
      <NowLogList
        dayKey={dayKey}
        list="event"
        title="Events"
        note="Any repeated phrase can be counted later. Example: left room."
        placeholder="left room"
      />
      <NowLogList
        dayKey={dayKey}
        list="note"
        title="Notes"
        note="A general note for this minute. Example: landlord called back."
        placeholder="landlord called back"
      />
      <NowLogList
        dayKey={dayKey}
        list="thought"
        title="Thought process"
        note="A strand from what you are doing, to what it leads to, to how it feels."
        placeholder="A strand from what you are doing…"
      />
    </div>
  )
}
