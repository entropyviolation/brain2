/**
 * components/Settings/HomeLocationField.tsx — Home city for Plan sun times
 *
 * City autocomplete (Open-Meteo) writing `useUserSettingsStore.homeCity`.
 * Empty/cleared values snap back to San Diego.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolveCityLabel, searchCities, type CitySuggestion } from "@/lib/city-search"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"

export function HomeLocationField() {
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const setHomeCity = useUserSettingsStore((s) => s.setHomeCity)
  const listId = useId()
  const [value, setValue] = useState(homeCity)
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<CitySuggestion[]>([])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBlurResolve = useRef(false)

  useEffect(() => {
    setValue(homeCity)
  }, [homeCity])

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

  const commit = (label: string) => {
    const next = label.trim() || DEFAULT_HOME_CITY
    setValue(next)
    setHomeCity(next)
    setOpen(false)
    setHits([])
  }

  const pick = (label: string) => {
    skipBlurResolve.current = true
    commit(label)
  }

  const commitTyped = async () => {
    if (skipBlurResolve.current) {
      skipBlurResolve.current = false
      return
    }
    const raw = value.trim()
    if (!raw) {
      commit(DEFAULT_HOME_CITY)
      return
    }
    const resolved = await resolveCityLabel(raw)
    commit(resolved || DEFAULT_HOME_CITY)
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        <h3 className="font-semibold">Home location</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Sunrise and sunset on the Plan day itinerary use this city. Defaults to San Diego.
      </p>
      <div className="relative space-y-1.5 overflow-visible" ref={wrapRef}>
        <Label htmlFor="home-location">City</Label>
        <Input
          id="home-location"
          value={value}
          placeholder={DEFAULT_HOME_CITY}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
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
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background py-1 shadow-md"
          >
            {hits.map((h, i) => (
              <li key={h.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`w-full px-3 py-1.5 text-left text-sm ${
                    i === highlight ? "bg-accent" : "hover:bg-muted"
                  }`}
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
    </div>
  )
}
