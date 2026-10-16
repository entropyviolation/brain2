/**
 * components/ui/address-suggest-input.tsx — Address field with map search
 *
 * Types like a plain field (local state, `onLive` per key, `onCommit` on
 * blur or Enter) and, from three letters, offers places from
 * `searchAddresses` (Photon, or Google first when a key is set). Picking
 * one fills in its parts (`withParts`) and hands the full suggestion to
 * `onPick`. Offline or no hits: the typed text still saves.
 */
"use client"

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react"
import { MapPin } from "lucide-react"
import { searchAddresses, withParts, type AddressSuggestion } from "@/lib/geo-address"

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur">

interface AddressSuggestInputProps extends NativeProps {
  value: string
  onLive?: (text: string) => void
  onCommit: (text: string) => void
  onPick: (suggestion: AddressSuggestion) => void
  near?: { lat: number; lng: number } | null
  /** Turn search off (e.g. Country precision still searches; a caller may opt out). */
  searchOff?: boolean
}

export function AddressSuggestInput({
  value,
  onLive,
  onCommit,
  onPick,
  near,
  searchOff,
  className,
  ...props
}: AddressSuggestInputProps) {
  const listId = useId()
  const [text, setText] = useState(value)
  const [hits, setHits] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [busy, setBusy] = useState(false)
  const focused = useRef(false)
  const typed = useRef(false)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])

  useEffect(() => {
    const q = text.trim()
    if (searchOff || !typed.current || q.length < 3) {
      setHits([])
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(() => {
      void searchAddresses(q, near ?? null)
        .then((rows) => {
          if (cancelled) return
          setHits(rows)
          setHighlight(0)
          setOpen(rows.length > 0 && focused.current)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, searchOff])

  const pick = async (suggestion: AddressSuggestion) => {
    setOpen(false)
    setHits([])
    typed.current = false
    const full = await withParts(suggestion).catch(() => suggestion)
    onPick(full)
  }

  const commit = () => {
    if (textRef.current !== value) onCommit(textRef.current)
  }

  return (
    <div className="address-suggest" style={{ position: "relative" }}>
      <input
        {...props}
        className={className}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-busy={busy || undefined}
        value={text}
        onFocus={(event) => {
          focused.current = true
          props.onFocus?.(event)
        }}
        onChange={(event) => {
          typed.current = true
          setText(event.target.value)
          onLive?.(event.target.value)
        }}
        onBlur={() => {
          focused.current = false
          setTimeout(() => setOpen(false), 120)
          commit()
        }}
        onKeyDown={(event) => {
          if (open && event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((h) => Math.min(hits.length - 1, h + 1))
          } else if (open && event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((h) => Math.max(0, h - 1))
          } else if (event.key === "Enter") {
            event.preventDefault()
            if (open && hits[highlight]) void pick(hits[highlight])
            else commit()
          } else if (event.key === "Escape" && open) {
            event.stopPropagation()
            setOpen(false)
          }
          props.onKeyDown?.(event)
        }}
      />
      {open && hits.length > 0 ? (
        <ul id={listId} role="listbox" aria-label="Places" className="address-suggest-menu">
          {hits.map((hit, index) => (
            <li
              key={hit.id}
              role="option"
              aria-selected={index === highlight}
              data-highlight={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault()
                void pick(hit)
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="address-suggest-name">{hit.name}</span>
              <span className="address-suggest-label">{hit.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
