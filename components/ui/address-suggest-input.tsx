/**
 * components/ui/address-suggest-input.tsx — A text field with live map search.
 *
 * Same contract as `IsolatedInput`: text lives here, every key goes to
 * `onLive` (keep it cheap), and blur / Enter commits through `onCommit` when
 * the text differs from `value`. On top of that: 3+ characters wait 300ms
 * and call `searchAddresses`; stale answers are dropped; ↑ ↓ Enter Esc walk
 * the listbox. A pick fills its parts (`withParts`) and goes to `onPick`.
 * Offline or empty results: the plain text still commits.
 *
 * Not built on `IsolatedInput` itself: that field will not take a new value
 * while focused, and a pick has to replace the typed text in place.
 */
"use client"

import { useEffect, useId, useRef, useState, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { searchAddresses, withParts, type AddressSuggestion } from "@/lib/geo-address"
import "./address-suggest-input.css"

export interface AddressSuggestInputProps
  extends Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "onKeyDown"> {
  value: string
  onLive?: (text: string) => void
  onCommit?: (text: string) => void
  /** A picked suggestion with parts filled. Return the text to show. */
  onPick: (full: AddressSuggestion) => string | void
  near?: { lat: number; lng: number } | null
}

export function AddressSuggestInput({ value, onLive, onCommit, onPick, near, ...props }: AddressSuggestInputProps) {
  const [text, setText] = useState(value ?? "")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressSuggestion[]>([])
  const [active, setActive] = useState(-1)
  const focused = useRef(false)
  const textRef = useRef(text)
  const pickedRef = useRef<string | null>(null)
  const listId = useId()
  textRef.current = text

  useEffect(() => {
    if (!focused.current) setText(value ?? "")
  }, [value])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchAddresses(q, near ?? null)
        .then((rows) => {
          if (cancelled) return
          setResults(rows)
          setActive(-1)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // `near` is read at search time; a moving bias should not re-run the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const commit = () => {
    const next = textRef.current
    if (next === pickedRef.current) return
    if (next !== (value ?? "")) onCommit?.(next)
  }

  const pick = async (suggestion: AddressSuggestion) => {
    setResults([])
    setQuery("")
    const full = await withParts(suggestion).catch(() => suggestion)
    const shown = onPick(full)
    const nextText = typeof shown === "string" ? shown : full.label
    pickedRef.current = nextText
    textRef.current = nextText
    setText(nextText)
  }

  const open = results.length > 0

  return (
    <div className="address-suggest" style={{ position: "relative", minWidth: 0 }}>
      <Input
        {...props}
        value={text}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onFocus={(e) => {
          focused.current = true
          props.onFocus?.(e)
        }}
        onChange={(e) => {
          const next = e.target.value
          textRef.current = next
          pickedRef.current = null
          setText(next)
          setQuery(next)
          onLive?.(next)
        }}
        onBlur={() => {
          focused.current = false
          setResults([])
          commit()
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === "ArrowDown" && open) {
            e.preventDefault()
            setActive((i) => (i + 1) % results.length)
          } else if (e.key === "ArrowUp" && open) {
            e.preventDefault()
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
          } else if (e.key === "Escape" && open) {
            e.preventDefault()
            e.stopPropagation()
            setResults([])
          } else if (e.key === "Enter") {
            if (open && active >= 0) {
              e.preventDefault()
              void pick(results[active]!)
            } else {
              setResults([])
              commit()
            }
          }
        }}
      />
      {open ? (
        <ul id={listId} role="listbox" className="address-suggest-list">
          {results.map((row, i) => (
            <li
              key={row.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="address-suggest-option"
              data-active={i === active ? "true" : undefined}
              onMouseDown={(e) => {
                // Keep focus in the field so blur does not commit the typed text.
                e.preventDefault()
                void pick(row)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="address-suggest-name">{row.name}</span>
              {row.label !== row.name ? <span className="address-suggest-label">{row.label}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
