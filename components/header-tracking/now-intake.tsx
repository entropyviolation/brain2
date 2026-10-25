/**
 * Intake for the Now popup: food, drink, or drug / medicine at this minute.
 * Same writer as the Home Tracking log (`submitTrackingLog`, mode `intake`),
 * so a line lands on that log's Food / Drink / Drugs shelves. A chip only
 * fills the name, the same rule as the log's Recent row. Add or Enter logs.
 * Today's bare intake (no food, drink, or drug class) is listed under the
 * field. Food, Drink, and Drug / med call `setIntakeClass`.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import {
  asLogEntry,
  classifyLogInstant,
  compareLogRows,
  logClockLabel,
  loggedFlag,
  recentIntakeByClass,
  setIntakeClass,
  submitTrackingLog,
  type IntakeClass,
} from "@/components/Home/Tracking/tracking-log-model"
import { useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { raiseQuickAddWrote } from "@/components/quick-add-wrote"
import { minutesToTimeString } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const CLASSES: { id: IntakeClass; label: string; placeholder: string; starters: string[] }[] = [
  { id: "drink", label: "Drink", placeholder: "water", starters: ["Water", "Coffee", "Tea"] },
  { id: "food", label: "Food", placeholder: "toast", starters: ["Meal", "Snack"] },
  { id: "drug", label: "Drug / med", placeholder: "medicine name", starters: [] },
]

/** Recent names first, then starters not already there. */
function chipsFor(recent: { title: string; count: number }[], starters: string[]): { title: string; count: number | null }[] {
  const seen = new Set(recent.map((row) => row.title.toLowerCase()))
  const extra = starters.filter((name) => !seen.has(name.toLowerCase())).map((title) => ({ title, count: null }))
  return [...recent, ...extra].slice(0, 8)
}

export function NowIntake({ dayKey }: { dayKey: string }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const prefs = useTrackingViewPrefs()
  const [cls, setCls] = useState<IntakeClass>("drink")
  const [name, setName] = useState("")
  const [saved, setSaved] = useState("")
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const preset = CLASSES.find((row) => row.id === cls) ?? CLASSES[0]

  const recents = useMemo(() => {
    const penName = new Map<string, string>()
    for (const scope of scopes) for (const pen of scope.pens) penName.set(pen.id, pen.name)
    return recentIntakeByClass(entries, penName)
  }, [entries, scopes])
  const chips = chipsFor(recents[cls], preset.starters)
  const loose = useMemo(() => {
    const penName = new Map<string, string>()
    for (const scope of scopes) for (const pen of scope.pens) penName.set(pen.id, pen.name)
    return entries
      .filter((entry) => entry.date === dayKey)
      .map((entry) => classifyLogInstant(asLogEntry(entry), penName.get(entry.penId)))
      .filter((row): row is NonNullable<typeof row> => row?.list === "intake")
      .sort(compareLogRows)
  }, [entries, scopes, dayKey])

  function fill(title: string) {
    setName(title)
    window.requestAnimationFrame(() => {
      const field = fieldRef.current
      if (!field) return
      field.focus()
      field.setSelectionRange(title.length, title.length)
    })
  }

  function add() {
    const title = name.trim()
    if (!title) return
    const now = new Date()
    const minute = now.getHours() * 60 + now.getMinutes()
    const id = submitTrackingLog({ date: dayKey, title, mode: "intake", intakeClass: cls, clock: "exact", minute })
    if (!id) return
    if (prefs.logFlagOnAdd) raiseQuickAddWrote(loggedFlag("intake", cls, title, "exact", minutesToTimeString(minute)))
    setSaved(`${title} · ${preset.label.toLowerCase()}`)
    setName("")
  }

  return (
    <section className="trk-aside-well htk-log-well htk-intake" aria-label="Intake">
      <div className="htk-intake-head">
        <h3 className="trk-logbook-heading">Intake</h3>
        <div className="htk-intake-classes" role="toolbar" aria-label="Intake class">
          {CLASSES.map((row) => (
            <button key={row.id} type="button" data-no95="" aria-pressed={cls === row.id} onClick={() => setCls(row.id)}>
              {row.label}
            </button>
          ))}
        </div>
      </div>
      <p className="trk-logbook-note">Food, water, drinks, medicine. Logged at this minute on today’s Tracking log.</p>
      {chips.length > 0 ? (
        <div className="htk-intake-chips" role="group" aria-label={`Quick ${preset.label}`}>
          {chips.map((chip) => (
            <button key={chip.title} type="button" data-no95="" className="htk-chip" title={`Fill “${chip.title}”`} onClick={() => fill(chip.title)}>
              <span className="htk-chip-name">{chip.title}</span>
              {chip.count ? <span className="htk-chip-count" aria-hidden>×{chip.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="htk-row htk-log-add">
        <input
          ref={fieldRef}
          aria-label="Add to Intake"
          value={name}
          placeholder={preset.placeholder}
          onChange={(event) => {
            setName(event.target.value)
            if (saved) setSaved("")
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            event.preventDefault()
            add()
          }}
        />
        <button type="button" aria-label="Add to Intake" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {saved ? (
        <p className="trk-logbook-note htk-intake-saved" role="status">
          Logged {saved}.
        </p>
      ) : null}
      {loose.length > 0 ? (
        <div className="htk-intake-loose">
          <p className="trk-logbook-note">No class yet. Sort each one.</p>
          <ul aria-label="Uncategorized intake">
            {loose.map((row) => {
              const clock = logClockLabel(row)
              return (
                <li key={row.id}>
                  {clock.time ? <span className="trk-log-when">{clock.time}</span> : null}
                  <span className="htk-intake-loose-name">{row.title?.trim() || "Untitled"}</span>
                  <span className="htk-intake-sort" role="group" aria-label={`Sort ${row.title?.trim() || "Untitled"}`}>
                    {CLASSES.map((kind) => (
                      <button key={kind.id} type="button" onClick={() => setIntakeClass(row.id, kind.id)}>
                        {kind.label}
                      </button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
