/**
 * Google Maps–style place autocomplete (Photon / optional Google Places).
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import { searchPlaces, type PlaceSuggestion } from "@/lib/places-search"

export function PlaceSuggestInput({
  value,
  onChange,
  onPick,
  cityLabel,
  cityLat,
  cityLng,
  placeholder,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (place: PlaceSuggestion) => void
  cityLabel?: string
  cityLat?: number
  cityLng?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<PlaceSuggestion[]>([])
  const [highlight, setHighlight] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(() => {
      void searchPlaces(q, {
        cityLabel,
        cityLat,
        cityLng,
        limit: 7,
      }).then((r) => {
        setHits(r)
        setHighlight(0)
        setLoading(false)
        setOpen(true)
      })
    }, 280)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, cityLabel, cityLat, cityLng])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const pick = (place: PlaceSuggestion) => {
    onChange(place.name)
    setOpen(false)
    setHits([])
    onPick(place)
  }

  return (
    <div className="place-suggest" ref={wrapRef}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, hits.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            pick(hits[highlight]!)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {open && (hits.length > 0 || loading) && (
        <ul id={listId} className="place-suggest-list" role="listbox">
          {loading && hits.length === 0 && <li className="place-suggest-hint">Searching…</li>}
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? "is-active" : undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(h)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="place-suggest-name">{h.name}</span>
                <span className="place-suggest-addr">{h.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
