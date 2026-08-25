/**
 * City input with Open-Meteo suggestions — capitalizes and attaches country
 * on select / blur.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import { resolveCityLabel, searchCities, type CitySuggestion } from "@/lib/city-search"

export function CitySuggestInput({
  value,
  onChange,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  /** Called after blur/select with the resolved canonical label */
  onCommit?: (resolved: string) => void
  placeholder?: string
  className?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<CitySuggestion[]>([])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBlurResolve = useRef(false)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(() => {
      void searchCities(q, 6).then((r) => {
        setHits(r)
        setHighlight(0)
      })
    }, 220)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const pick = (label: string) => {
    skipBlurResolve.current = true
    onChange(label)
    setOpen(false)
    setHits([])
    onCommit?.(label)
  }

  const commitTyped = async () => {
    if (skipBlurResolve.current) {
      skipBlurResolve.current = false
      return
    }
    const raw = value.trim()
    if (!raw) {
      onCommit?.("")
      return
    }
    const resolved = await resolveCityLabel(raw)
    if (resolved !== value) onChange(resolved)
    onCommit?.(resolved)
  }

  return (
    <div className="city-suggest" ref={wrapRef}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so click on suggestion registers
          setTimeout(() => void commitTyped(), 120)
        }}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) {
            if (e.key === "Enter") {
              e.preventDefault()
              void commitTyped()
            }
            return
          }
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, hits.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            pick(hits[highlight]!.label)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {open && hits.length > 0 && (
        <ul id={listId} className="city-suggest-list" role="listbox">
          {hits.map((h, i) => (
            <li key={h.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? "is-active" : undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(h.label)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
