/**
 * components/People/person-nicknames.tsx — Nicknames as chips inside one field
 *
 * Type a name and press Enter, comma, or + to add it; × or Backspace on an
 * empty field removes the last one. Case-insensitive duplicates are refused.
 */
"use client"

import { useState } from "react"

export function PersonNicknames({
  nicknames,
  onChange,
}: {
  nicknames: string[]
  onChange: (nicknames: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const name = draft.trim().replace(/,$/, "").trim()
    if (!name || nicknames.some((other) => other.toLowerCase() === name.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...nicknames, name])
    setDraft("")
  }
  return (
    <div className="person-field">
      <span className="person-plate">Nicknames</span>
      <div className="person-chipfield">
        {nicknames.map((name) => (
          <span key={name} className="person-nickname">
            {name}
            <button
              type="button"
              aria-label={`Remove nickname ${name}`}
              onClick={() => onChange(nicknames.filter((other) => other !== name))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          aria-label="Nickname"
          placeholder={nicknames.length ? "" : "Add a nickname"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()
              add()
            } else if (event.key === "Backspace" && !draft && nicknames.length) {
              onChange(nicknames.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (draft.trim()) add()
          }}
        />
        <button type="button" className="person-chip-add" aria-label="Add nickname" disabled={!draft.trim()} onClick={add}>
          +
        </button>
      </div>
    </div>
  )
}
