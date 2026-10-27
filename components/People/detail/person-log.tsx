/**
 * components/People/person-log.tsx — A dated log on a person (Interactions).
 *
 * Rows newest first, each with an optional flag (Saw them) and Remove. The
 * composer keeps its own date / text state, so typing never writes the draft.
 */
"use client"

import { useState } from "react"

export function Log({
  title,
  rows,
  addLabel,
  textLabel,
  flagLabel,
  onAdd,
  onRemove,
  onFlag,
  today,
}: {
  title: string
  rows: { id: string; date: string; text: string; flag?: boolean; flagLabel?: string }[]
  addLabel: string
  textLabel: string
  flagLabel?: string
  onAdd: (date: string, text: string, flag?: boolean) => void
  onRemove: (id: string) => void
  onFlag?: (id: string, flag: boolean) => void
  today: string
}) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState("")
  const [flag, setFlag] = useState(false)
  return (
    <section className="person-log" aria-label={title}>
      <h3>{title}</h3>
      {rows.length > 0 ? (
        <ul className="person-log-list">
          {rows.map((row) => (
            <li key={row.id} className="person-log-row">
              <span className="person-log-date">{row.date}</span>
              <span className="person-log-text">{row.text}</span>
              {row.flagLabel && onFlag ? (
                <label className="person-check">
                  <input
                    type="checkbox"
                    aria-label={`${row.flagLabel} ${row.text}`}
                    checked={row.flag === true}
                    onChange={(event) => onFlag(row.id, event.target.checked)}
                  />
                  {row.flagLabel}
                </label>
              ) : null}
              <button type="button" aria-label={`Remove ${textLabel.toLowerCase()} ${row.text}`} onClick={() => onRemove(row.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="person-log-add"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          onAdd(date || today, trimmed, flagLabel ? flag : undefined)
          setText("")
          setFlag(false)
        }}
      >
        <label>
          Date
          <input type="date" aria-label={`${title} date`} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          {textLabel}
          <input
            type="text"
            aria-label={textLabel}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {flagLabel ? (
          <label className="person-check">
            <input type="checkbox" aria-label={flagLabel} checked={flag} onChange={(event) => setFlag(event.target.checked)} />
            {flagLabel}
          </label>
        ) : null}
        <button type="submit">{addLabel}</button>
      </form>
    </section>
  )
}
