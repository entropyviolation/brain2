/**
 * components/People/person-nicknames.tsx — Nickname chips inside one field.
 *
 * Enter or a comma adds the typed name; Backspace in an empty field removes
 * the last chip; leaving the field adds what was typed. Case-insensitive
 * duplicates are dropped. The typed text is local state, not the draft.
 * `label` / `itemLabel` / `suggestions` let the same field hold phone
 * numbers and emails (Person → Phones and emails).
 */
"use client"

import { useId, useRef, useState } from "react"

export function NicknameField({
  nicknames,
  onChange,
  label = "Nicknames",
  itemLabel = "nickname",
  suggestions,
  format,
}: {
  nicknames: string[]
  onChange: (nicknames: string[]) => void
  label?: string
  itemLabel?: string
  /** Offered as the user types (a datalist). */
  suggestions?: string[]
  /** How a chip reads (phone numbers: +1 (555) 123-4567). */
  format?: (value: string) => string
}) {
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const listId = useId()
  const Item = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)

  const add = (raw = draft) => {
    const name = raw.trim().replace(/,+$/, "").trim()
    setDraft("")
    if (!name || nicknames.some((other) => other.toLowerCase() === name.toLowerCase())) return
    onChange([...nicknames, name])
  }

  return (
    <div className="person-field person-nickfield">
      <span id={labelId}>{label}</span>
      <div
        className="person-chipfield"
        role="group"
        aria-labelledby={labelId}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            inputRef.current?.focus()
          }
        }}
      >
        {nicknames.map((name) => (
          <span key={name} className="person-nickname">
            {format ? format(name) : name}
            <button
              type="button"
              aria-label={`Remove ${itemLabel} ${name}`}
              onClick={() => onChange(nicknames.filter((other) => other !== name))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="person-chip-input"
          type="text"
          aria-label={Item}
          list={suggestions?.length ? listId : undefined}
          value={draft}
          onChange={(event) => {
            const next = event.target.value
            if (next.endsWith(",")) add(next)
            else setDraft(next)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault()
              add()
            } else if (event.key === "Backspace" && draft === "" && nicknames.length > 0) {
              event.preventDefault()
              onChange(nicknames.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (draft.trim()) add()
          }}
        />
        <button type="button" className="person-chip-add" aria-label={`Add ${itemLabel}`} title={`Add ${itemLabel}`} onClick={() => add()}>
          +
        </button>
        {suggestions?.length ? (
          <datalist id={listId}>
            {suggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  )
}
