/**
 * Self-contained printable itinerary — start/end dates, cities, weather API,
 * day plans/notes/flights (not list-backed).
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useModulesStore, type ModuleInstance, type ModuleView } from "@/lib/modules-store"
import {
  applyGlobalCity,
  cityLabel,
  DEFAULT_ITINERARY_ACCENT,
  emptyTripItinerary,
  expandFlightScheduleChunks,
  formatFlightEntry,
  formatFlightLegLine,
  formatItineraryDateLabel,
  formatLayoverLine,
  formatScheduleTime,
  genTripId,
  itineraryAccentColor,
  itineraryShowsSleep,
  rebuildDaysForRange,
  refreshFlightDisplay,
  syncDayToHomePlan,
  weatherCityQuery,
  type TripItineraryData,
  type TripItineraryDay,
  type TripScheduleEntry,
} from "@/lib/trip-itinerary"
import { fetchClimateForItineraryDay } from "@/lib/weather-client"
import { flightDurationLabel } from "@/lib/itinerary-assemble"
import { parseFlightText, type ParsedFlightDetails } from "@/lib/parse-flight-text"
import { airportFromCity, enrichParsedFlightWithApi } from "@/lib/flight-lookup"
import { CitySuggestInput } from "@/components/Modules/workspace/itinerary/CitySuggestInput"
import type { TripFlightInfo } from "@/lib/trip-itinerary"
import "./itinerary-document.css"

function defaultRange(): { start: string; end: string } {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const iso = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  return { start: iso(start), end: iso(end) }
}

/** Textarea that grows with content (multiline plans). */
function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`
  }
  useLayoutEffect(() => {
    resize()
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
    />
  )
}

function patchFlightFields(
  prev: NonNullable<TripScheduleEntry["flight"]>,
  patch: Partial<NonNullable<TripScheduleEntry["flight"]>>,
): { flight: NonNullable<TripScheduleEntry["flight"]>; text: string; detail: string; time?: string } {
  const flight = refreshFlightDisplay({ ...prev, ...patch })
  const formatted = formatFlightEntry(flight)
  return { flight, text: formatted.text, detail: formatted.detail, time: formatted.time }
}

export function ItineraryDocumentView({
  module,
}: {
  view: ModuleView
  module?: ModuleInstance
  onOpenItem?: (id: string) => void
}) {
  const updateModule = useModulesStore((s) => s.updateModule)
  const moduleId = module?.id
  const [storeReady, setStoreReady] = useState(() =>
    typeof window === "undefined" ? true : useModulesStore.persist.hasHydrated(),
  )

  useEffect(() => {
    if (useModulesStore.persist.hasHydrated()) {
      setStoreReady(true)
      return
    }
    return useModulesStore.persist.onFinishHydration(() => setStoreReady(true))
  }, [])

  const initial = useMemo(() => {
    if (module?.config?.tripItinerary?.days?.length) return module.config.tripItinerary
    const { start, end } = defaultRange()
    return emptyTripItinerary(start, end)
  }, [module?.config?.tripItinerary, module?.id])

  const [data, setData] = useState<TripItineraryData>(initial)
  const [startDraft, setStartDraft] = useState(initial.startDate)
  const [endDraft, setEndDraft] = useState(initial.endDate)
  const [weatherLoading, setWeatherLoading] = useState<Record<string, boolean>>({})
  const [flightPasteOpen, setFlightPasteOpen] = useState<string | null>(null)
  const [flightPasteDraft, setFlightPasteDraft] = useState<Record<string, string>>({})
  const [flightBusy, setFlightBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [globalCityDraft, setGlobalCityDraft] = useState(initial.globalCity || "")
  const dataRef = useRef(data)
  dataRef.current = data
  const moduleRef = useRef(module)
  moduleRef.current = module
  const storeReadyRef = useRef(storeReady)
  storeReadyRef.current = storeReady

  useEffect(() => {
    if (module?.config?.tripItinerary?.days?.length) {
      setData(module.config.tripItinerary)
      setStartDraft(module.config.tripItinerary.startDate)
      setEndDraft(module.config.tripItinerary.endDate)
      setGlobalCityDraft(module.config.tripItinerary.globalCity || "")
    }
  }, [module?.config?.tripItinerary])

  const persist = useCallback(
    (next: TripItineraryData) => {
      setData(next)
      dataRef.current = next
      const m = moduleRef.current
      if (!moduleId || !m) return
      // Avoid writing over persisted trip data before zustand rehydrates.
      if (!storeReadyRef.current) return
      updateModule(moduleId, {
        config: { tripItinerary: next, itineraryUiVersion: 3 },
      })
    },
    [moduleId, updateModule],
  )

  const patchDay = useCallback(
    (date: string, patch: Partial<TripItineraryDay> | ((d: TripItineraryDay) => TripItineraryDay)) => {
      const prev = dataRef.current
      const nextDays = prev.days.map((d) => {
        if (d.date !== date) return d
        return typeof patch === "function" ? patch(d) : { ...d, ...patch }
      })
      persist({ ...prev, days: nextDays })
    },
    [persist],
  )

  const applyDateRange = () => {
    if (!startDraft || !endDraft || startDraft > endDraft) {
      setMsg("End date must be on or after start date.")
      return
    }
    const prev = dataRef.current
    const days = rebuildDaysForRange(startDraft, endDraft, prev.days, {
      globalCity: prev.globalCity || globalCityDraft,
    })
    persist({
      ...prev,
      startDate: startDraft,
      endDate: endDraft,
      days,
    })
    setMsg(`Itinerary set for ${days.length} day${days.length === 1 ? "" : "s"}.`)
    setTimeout(() => setMsg(null), 3000)
  }

  const applyCityToAllDays = (city?: string) => {
    const c = (city ?? globalCityDraft).trim()
    if (!c) {
      setMsg("Enter a city to apply to all days.")
      setTimeout(() => setMsg(null), 3000)
      return
    }
    const next = applyGlobalCity(dataRef.current, c)
    persist(next)
    setGlobalCityDraft(c)
    setMsg(`Set ${next.days.length} day${next.days.length === 1 ? "" : "s"} to ${c}.`)
    setTimeout(() => setMsg(null), 3000)
  }

  const toggleSleep = () => {
    const prev = dataRef.current
    const showSleepNext = !itineraryShowsSleep(prev)
    persist({ ...prev, showSleep: showSleepNext })
  }

  const setAccentColor = (color: string) => {
    const prev = dataRef.current
    const next = color.trim() || DEFAULT_ITINERARY_ACCENT
    persist({
      ...prev,
      accentColor: next.toLowerCase() === DEFAULT_ITINERARY_ACCENT ? undefined : next,
    })
  }

  const showSleep = itineraryShowsSleep(data)
  const accentColor = itineraryAccentColor(data)

  const refreshWeather = useCallback(
    async (day: TripItineraryDay) => {
      const hasCity =
        day.cityMode === "travel"
          ? !!(day.fromCity || day.toCity)
          : !!day.city.trim()
      if (!hasCity) return
      setWeatherLoading((s) => ({ ...s, [day.date]: true }))
      try {
        const climate = await fetchClimateForItineraryDay(day)
        if (climate) {
          patchDay(day.date, {
            weather: climate.weather,
            sunrise: climate.sunrise,
            sunset: climate.sunset,
            climateCity: climate.climateCity,
            weatherFetchedAt: new Date().toISOString(),
          })
        } else {
          setMsg(`Could not load weather for this day. Check the city name.`)
        }
      } finally {
        setWeatherLoading((s) => ({ ...s, [day.date]: false }))
      }
    },
    [patchDay],
  )

  // Auto-fetch weather + sun when city / schedule (travel transition) changes
  useEffect(() => {
    if (!storeReady) return
    let cancelled = false
    ;(async () => {
      for (const day of data.days) {
        if (cancelled) break
        const hasCity =
          day.cityMode === "travel" ? !!(day.fromCity || day.toCity) : !!day.city.trim()
        if (!hasCity) continue
        // Single-city: skip if we already have weather + sun. Travel days re-resolve
        // when cities/schedule change so majority-daylight city stays correct.
        if (
          day.cityMode !== "travel" &&
          day.weather?.includes("°F") &&
          day.sunrise &&
          day.sunset
        ) {
          continue
        }
        setWeatherLoading((s) => ({ ...s, [day.date]: true }))
        const climate = await fetchClimateForItineraryDay(day)
        if (cancelled) break
        setWeatherLoading((s) => ({ ...s, [day.date]: false }))
        if (climate) {
          patchDay(day.date, {
            weather: climate.weather,
            sunrise: climate.sunrise,
            sunset: climate.sunset,
            climateCity: climate.climateCity,
            weatherFetchedAt: new Date().toISOString(),
          })
        }
        await new Promise((r) => setTimeout(r, 150))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storeReady,
    data.days
      .map(
        (d) =>
          `${d.date}:${d.cityMode}:${d.city}:${d.fromCity}:${d.toCity}:${d.schedule
            .map((e) => `${e.kind}:${e.time}`)
            .join(",")}`,
      )
      .join("|"),
  ])

  const addPlan = (date: string, kind: "plan" | "note") => {
    // Plans are timed; notes are untimed — drag to place them in the day.
    const entry: TripScheduleEntry = {
      id: genTripId("sched"),
      kind,
      ...(kind === "plan" ? { time: "09:00" } : {}),
      text: "",
    }
    patchDay(date, (d) => ({ ...d, schedule: [...d.schedule, entry] }))
  }

  const reorderSchedule = (date: string, fromId: string, toId: string) => {
    if (fromId === toId) return
    patchDay(date, (d) => {
      const list = [...d.schedule]
      const fromIdx = list.findIndex((e) => e.id === fromId)
      const toIdx = list.findIndex((e) => e.id === toId)
      if (fromIdx < 0 || toIdx < 0) return d
      const [item] = list.splice(fromIdx, 1)
      if (!item) return d
      list.splice(toIdx, 0, item)
      return { ...d, schedule: list }
    })
  }

  const updateEntry = (date: string, id: string, patch: Partial<TripScheduleEntry>) => {
    patchDay(date, (d) => ({
      ...d,
      schedule: d.schedule.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }

  const removeEntry = (date: string, id: string) => {
    patchDay(date, (d) => ({ ...d, schedule: d.schedule.filter((e) => e.id !== id) }))
  }

  const flightFromPaste = (raw: string, date: string): TripFlightInfo => {
    const parsed = parseFlightText(raw)
    return parsedToFlightInfo(parsed, date)
  }

  const parsedToFlightInfo = (parsed: ParsedFlightDetails, date: string, segIndex = -1): TripFlightInfo => {
    const segs = parsed.segments
    const first = segIndex >= 0 ? segs[segIndex] : segs[0]
    const last = segIndex >= 0 ? segs[segIndex] : segs[segs.length - 1]
    const dep = first?.departTime
    const arr = last?.arriveTime
    const depDate = first?.departDate || parsed.departureDate || date
    let arrivalDate = last?.arriveDate || depDate
    if (!last?.arriveDate && dep && arr && arr < dep) {
      const d = new Date(`${depDate}T12:00:00`)
      d.setDate(d.getDate() + 1)
      arrivalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    }
    const isSingle = segIndex >= 0
    // Never fall back to overall trip cities for a middle/last leg — that repeats leg 1's route
    const routeFrom = isSingle
      ? first?.from || (segIndex === 0 ? parsed.fromCity : undefined)
      : parsed.fromCity
    const routeTo = isSingle
      ? last?.to || (segIndex === segs.length - 1 ? parsed.toCity : undefined)
      : parsed.toCity
    const fn = isSingle
      ? first?.flightNumber || ""
      : parsed.flightNumbers.join(" / ") || parsed.flightNumber || ""
    const airline = (isSingle ? first?.airline : parsed.airline) || parsed.airline
    const fromAirport =
      (routeFrom && /^[A-Z]{3}$/i.test(routeFrom) ? routeFrom.toUpperCase() : undefined) ||
      airportFromCity(routeFrom) ||
      (isSingle && segIndex === 0 ? parsed.fromAirport : undefined) ||
      (!isSingle ? parsed.fromAirport : undefined)
    const toAirport =
      (routeTo && /^[A-Z]{3}$/i.test(routeTo) ? routeTo.toUpperCase() : undefined) ||
      airportFromCity(routeTo) ||
      (isSingle && segIndex === segs.length - 1 ? parsed.toAirport : undefined) ||
      (!isSingle ? parsed.toAirport : undefined)
    const title = isSingle
      ? formatFlightLegLine({
          airline,
          flightNumber: fn,
          from: routeFrom,
          to: routeTo,
          fromAirport,
          toAirport,
        })
      : parsed.title
    const detail = isSingle
      ? [
          first?.departDisplay && last?.arriveDisplay
            ? `${first.departDisplay} → ${last.arriveDisplay}`
            : "",
          parsed.confirmation && segIndex === 0 ? `Conf ${parsed.confirmation}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : parsed.detail

    return {
      flightNumber: fn,
      airline,
      fromCity: routeFrom,
      toCity: routeTo,
      fromAirport,
      toAirport,
      departureTime: dep ? `${depDate}T${dep}:00` : undefined,
      arrivalTime: arr ? `${arrivalDate}T${arr}:00` : undefined,
      durationLabel: isSingle ? undefined : parsed.durationLabel,
      stopsLabel: isSingle ? undefined : parsed.stopsLabel,
      layoverLabel: isSingle ? undefined : parsed.layoverLabel,
      segments: isSingle && first ? [first] : segs,
      rawText: parsed.rawText,
      title: title || "Flight",
      detail,
      confirmation: parsed.confirmation || "",
    }
  }

  const addDaysIso = (isoDate: string, days: number): string => {
    const d = new Date(`${isoDate}T12:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const addFlightFromPaste = async (date: string, rawOverride?: string) => {
    const raw = (rawOverride ?? flightPasteDraft[date] ?? "").trim()
    if (!raw) {
      setMsg("Paste flight details from your booking site, then click Add flight.")
      return
    }
    let parsed = parseFlightText(raw)
    if (!parsed.segments.length && !parsed.flightNumber && !parsed.confirmation) {
      setMsg("Couldn't read flight times or numbers — check the paste and try again.")
      return
    }

    setFlightBusy(date)
    setMsg("Reading flights…")
    try {
      try {
        const enriched = await enrichParsedFlightWithApi(parsed)
        parsed = enriched.parsed
        if (enriched.enrichedLegs > 0) {
          setMsg(`Matched ${enriched.enrichedLegs} leg(s) via flight API — adding to itinerary…`)
        }
      } catch {
        /* paste-only is fine */
      }

      const anchorDate = parsed.departureDate || date
      const prev = dataRef.current
      const dayDates = new Set(prev.days.map((d) => d.date))
      const additions = new Map<string, TripScheduleEntry[]>()

      const push = (day: string, entry: TripScheduleEntry) => {
        const list = additions.get(day) || []
        list.push(entry)
        additions.set(day, list)
      }

      const segs = parsed.segments.length
        ? parsed.segments
        : [
            {
              flightNumber: parsed.flightNumber,
              airline: parsed.airline,
              from: parsed.fromCity,
              to: parsed.toCity,
              departTime: parsed.time,
              arriveTime: undefined,
              departDisplay: undefined,
              arriveDisplay: undefined,
            },
          ]

      // Confirmation note only for single-leg (multi-leg shows Conf on layover row)
      if (parsed.confirmation && segs.length < 2) {
        push(anchorDate, {
          id: genTripId("conf"),
          kind: "note",
          text: `Confirmation / PNR: ${parsed.confirmation}${parsed.airline ? ` (${parsed.airline})` : ""}`,
        })
      }

      segs.forEach((seg, idx) => {
        const segDate = seg.departDate || anchorDate
        const next = segs[idx + 1]
        const isLast = idx === segs.length - 1

        const durLabel =
          seg.departTime && seg.arriveTime
            ? flightDurationLabel(
                `2000-01-01T${seg.departTime}:00`,
                seg.arriveTime < seg.departTime
                  ? `2000-01-02T${seg.arriveTime}:00`
                  : `2000-01-01T${seg.arriveTime}:00`,
              )?.replace(/\s*flight$/i, "")
            : undefined

        const fromCode =
          (seg.from && /^[A-Z]{3}$/i.test(seg.from) ? seg.from.toUpperCase() : undefined) ||
          airportFromCity(seg.from) ||
          (idx === 0 ? parsed.fromAirport : undefined) ||
          (idx > 0 ? airportFromCity(segs[idx - 1]?.to) : undefined)
        const toCode =
          (seg.to && /^[A-Z]{3}$/i.test(seg.to) ? seg.to.toUpperCase() : undefined) ||
          airportFromCity(seg.to) ||
          (isLast ? parsed.toAirport : undefined) ||
          (!isLast ? airportFromCity(next?.from) : undefined)

        const legFrom = seg.from || (idx === 0 ? parsed.fromCity : segs[idx - 1]?.to) || fromCode
        const legTo = seg.to || (isLast ? parsed.toCity : next?.from) || toCode

        const legText = formatFlightLegLine({
          airline: seg.airline || parsed.airline,
          flightNumber: seg.flightNumber,
          from: legFrom,
          to: legTo,
          fromAirport: fromCode,
          toAirport: toCode,
          departTime: seg.departTime,
          arriveTime: seg.arriveTime,
          // Per-leg duration only — don't apply overall/total (or misread layover) to every leg
          durationLabel: durLabel || (segs.length === 1 ? parsed.durationLabel : undefined),
        })

        const flightInfo = parsedToFlightInfo(parsed, segDate, parsed.segments.length ? idx : -1)
        const takeoffLand =
          seg.departDisplay && seg.arriveDisplay
            ? [
                fromCode || legFrom ? `Takeoff ${fromCode || legFrom} ${seg.departDisplay}` : seg.departDisplay,
                toCode || legTo ? `Land ${toCode || legTo} ${seg.arriveDisplay}` : seg.arriveDisplay,
              ].join(" → ")
            : ""
        push(segDate, {
          id: genTripId("flight"),
          kind: "flight",
          time: seg.departTime,
          text: legText,
          flight: {
            ...flightInfo,
            fromCity: legFrom,
            toCity: legTo,
            fromAirport: fromCode || flightInfo.fromAirport,
            toAirport: toCode || flightInfo.toAirport,
            title: legText,
            detail:
              [
                takeoffLand,
                durLabel || (segs.length === 1 ? parsed.durationLabel?.replace(/\s*flight$/i, "") : "") || "",
                parsed.confirmation && idx === 0 && segs.length === 1
                  ? `Conf ${parsed.confirmation}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
            confirmation: parsed.confirmation || "",
            rawText: idx === 0 ? parsed.rawText : undefined,
            segments: [{ ...seg, from: legFrom, to: legTo }],
          },
        })

        // Between legs: Arrive + layover + shared booking code (same as before)
        if (!isLast && seg.arriveTime) {
          const place = legTo || next?.from || toCode || "connection"
          let layDur =
            parsed.layovers[idx]?.durationLabel ||
            parsed.layoverLabel?.replace(/\s*layover.*/i, "").trim()
          if (!layDur && next?.departTime) {
            layDur = flightDurationLabel(
              `2000-01-01T${seg.arriveTime}:00`,
              next.departTime < seg.arriveTime
                ? `2000-01-02T${next.departTime}:00`
                : `2000-01-01T${next.departTime}:00`,
            )
              ?.replace(/\s*flight$/i, "")
              .trim()
          }
          push(segDate, {
            id: genTripId("layover"),
            kind: "note",
            time: seg.arriveTime,
            text: formatLayoverLine({
              place,
              durationLabel: layDur,
              confirmation: parsed.confirmation,
            }),
          })
        }

        // Overnight final landing on the next calendar day
        if (isLast && seg.arriveTime && seg.to) {
          const overnight = Boolean(seg.departTime && seg.arriveTime < seg.departTime)
          const landDate = seg.arriveDate || (overnight ? addDaysIso(segDate, 1) : segDate)
          if (landDate !== segDate) {
            push(landDate, {
              id: genTripId("land"),
              kind: "plan",
              time: seg.arriveTime,
              text: `Land in ${seg.to}${seg.flightNumber ? ` — ${seg.flightNumber}` : ""}${
                parsed.confirmation ? ` · Conf ${parsed.confirmation}` : ""
              }`,
            })
          }
        }
      })

      let days = prev.days.map((d) => {
        const extra = additions.get(d.date)
        if (!extra?.length) return d
        return { ...d, schedule: [...d.schedule, ...extra] }
      })

      const orphanNotes: string[] = []
      for (const [day, entries] of additions) {
        if (dayDates.has(day)) continue
        orphanNotes.push(`${entries.length} item(s) for ${day}`)
        days = days.map((d) =>
          d.date === date ? { ...d, schedule: [...d.schedule, ...entries] } : d,
        )
      }

      persist({ ...prev, days })
      setFlightPasteDraft((s) => ({ ...s, [date]: "" }))
      setFlightPasteOpen(null)
      const legCount = segs.length
      const bits = [
        `Added ${legCount} flight leg${legCount === 1 ? "" : "s"}`,
        parsed.layovers.length ? `${parsed.layovers.length} layover` : "",
        parsed.confirmation ? `conf ${parsed.confirmation}` : "",
        orphanNotes.length ? `(${orphanNotes.join(", ")} placed on this day — outside trip range)` : "",
      ].filter(Boolean)
      setMsg(bits.join(" · "))
      setTimeout(() => setMsg(null), 7000)
    } finally {
      setFlightBusy(null)
    }
  }

  const reparseFlight = async (date: string, entryId: string, raw: string) => {
    if (!raw.trim()) return
    removeEntry(date, entryId)
    await addFlightFromPaste(date, raw)
  }

  if (!moduleId) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Open this view inside a Trip Itinerary workspace.</p>
  }

  return (
    <div
      className="itinerary-doc-root space-y-4"
      style={{ ["--itin-accent" as string]: accentColor }}
    >
      <div className="itinerary-doc-toolbar no-print flex flex-wrap gap-3 items-end rounded border bg-card p-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground block">Trip start</label>
          <Input type="date" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} className="h-8 w-[150px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground block">Trip end</label>
          <Input type="date" value={endDraft} onChange={(e) => setEndDraft(e.target.value)} className="h-8 w-[150px]" />
        </div>
        <Button size="sm" onClick={applyDateRange}>
          Build / update days
        </Button>
        <div className="min-w-[12rem] flex-1 max-w-sm">
          <label className="text-[10px] uppercase text-muted-foreground block">City (all days)</label>
          <div className="flex gap-1.5 items-center">
            <CitySuggestInput
              className="itinerary-inline-input flex-1"
              placeholder="e.g. Lima, Peru"
              value={globalCityDraft}
              onChange={setGlobalCityDraft}
              onCommit={(city) => applyCityToAllDays(city)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyCityToAllDays()}
              disabled={!globalCityDraft.trim()}
              title="Set every day to this city"
            >
              Apply
            </Button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground block" htmlFor="itin-accent-color">
            Accent color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="itin-accent-color"
              type="color"
              className="itin-accent-color-input"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              title="Color for dates, notes, and highlights"
              aria-label="Itinerary accent color"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-[10px]"
              onClick={() => setAccentColor(DEFAULT_ITINERARY_ACCENT)}
              title="Reset to default crimson"
              disabled={accentColor === DEFAULT_ITINERARY_ACCENT}
            >
              Reset
            </Button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none pb-1">
          <input
            type="checkbox"
            className="rounded border"
            checked={showSleep}
            onChange={toggleSleep}
          />
          Show sleep
        </label>
        <p className="text-xs text-muted-foreground max-w-md">
          Hover a day to add plans or notes. Drag ⋮⋮ to reorder. Paste flight details from any booking
          site. Use City (all days) for a single base city. Accent applies to dates and notes.
        </p>
        {msg && <p className="text-xs text-amber-800 dark:text-amber-200 w-full">{msg}</p>}
      </div>

      <div className="itinerary-doc-paper">
        {data.days.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center">Set a start and end date, then Build days.</p>
        )}
        {data.days.map((day) => {
          // Preserve manual order so notes/plans can be dragged anywhere.
          const entries = day.schedule
          return (
            <section key={day.date} className="itinerary-day-block">
              <div className="itinerary-day-main">
                <div className="itinerary-day-meta">
                  <div className="itinerary-date">{formatItineraryDateLabel(day.date)}</div>
                  <div className="itinerary-city-edit no-print">
                    <select
                      className="itinerary-mode-select"
                      value={day.cityMode}
                      onChange={(e) => {
                        const cityMode = e.target.value as "city" | "travel"
                        patchDay(day.date, {
                          cityMode,
                          weather: undefined,
                          sunrise: undefined,
                          sunset: undefined,
                          climateCity: undefined,
                          weatherFetchedAt: undefined,
                        })
                      }}
                    >
                      <option value="city">City</option>
                      <option value="travel">Travel (A → B)</option>
                    </select>
                    {day.cityMode === "travel" ? (
                      <div className="itinerary-travel-fields">
                        <CitySuggestInput
                          className="itinerary-inline-input"
                          placeholder="From (e.g. San Diego)"
                          value={day.fromCity || ""}
                          onChange={(fromCity) =>
                            patchDay(day.date, {
                              fromCity,
                              weather: undefined,
                              sunrise: undefined,
                              sunset: undefined,
                              climateCity: undefined,
                              weatherFetchedAt: undefined,
                            })
                          }
                          onCommit={(fromCity) => {
                            const latest = dataRef.current.days.find((d) => d.date === day.date) || day
                            patchDay(day.date, { fromCity })
                            void refreshWeather({ ...latest, fromCity, cityMode: "travel" })
                          }}
                        />
                        <span className="itinerary-arrow">→</span>
                        <CitySuggestInput
                          className="itinerary-inline-input"
                          placeholder="To (e.g. Lima, Peru)"
                          value={day.toCity || ""}
                          onChange={(toCity) =>
                            patchDay(day.date, {
                              toCity,
                              weather: undefined,
                              sunrise: undefined,
                              sunset: undefined,
                              climateCity: undefined,
                              weatherFetchedAt: undefined,
                            })
                          }
                          onCommit={(toCity) => {
                            const latest = dataRef.current.days.find((d) => d.date === day.date) || day
                            patchDay(day.date, { toCity })
                            void refreshWeather({ ...latest, toCity, cityMode: "travel" })
                          }}
                        />
                      </div>
                    ) : (
                      <CitySuggestInput
                        className="itinerary-inline-input itinerary-city-input"
                        placeholder="City (e.g. Lima, Peru)"
                        value={day.city}
                        onChange={(city) =>
                          patchDay(day.date, {
                            city,
                            weather: undefined,
                            sunrise: undefined,
                            sunset: undefined,
                            climateCity: undefined,
                            weatherFetchedAt: undefined,
                          })
                        }
                        onCommit={(city) => {
                          const latest = dataRef.current.days.find((d) => d.date === day.date) || day
                          patchDay(day.date, { city })
                          void refreshWeather({ ...latest, city })
                        }}
                      />
                    )}
                  </div>
                  <div className="itinerary-city print-only">{cityLabel(day)}</div>
                  <div className="itinerary-weather">
                    {weatherLoading[day.date]
                      ? "Weather…"
                      : day.weather
                        ? day.cityMode === "travel" && day.climateCity
                          ? `Weather (${day.climateCity.split(",")[0]}): ${day.weather}`
                          : `Weather: ${day.weather}`
                        : weatherCityQuery(day)
                          ? "Weather unavailable"
                          : "Set a city for weather"}
                  </div>
                  {(day.sunrise || day.sunset) && (
                    <div className="itinerary-sun">
                      {day.sunrise && <span title="Sunrise">↑ {day.sunrise}</span>}
                      {day.sunrise && day.sunset && <span className="itinerary-sun-sep">·</span>}
                      {day.sunset && <span title="Sunset">↓ {day.sunset}</span>}
                    </div>
                  )}
                  <button
                    type="button"
                    className="itinerary-wx-refresh no-print"
                    onClick={() =>
                      refreshWeather({
                        ...day,
                        weather: undefined,
                        sunrise: undefined,
                        sunset: undefined,
                        climateCity: undefined,
                      })
                    }
                    disabled={
                      !(day.cityMode === "travel" ? day.fromCity || day.toCity : day.city.trim()) ||
                      weatherLoading[day.date]
                    }
                  >
                    Refresh weather
                  </button>
                </div>

                <div className="itinerary-day-schedule">
                  {day.dayNote != null && (
                    <div className="itinerary-day-banner">
                      <AutoGrowTextarea
                        className="itinerary-inline-input itinerary-autogrow w-full"
                        value={day.dayNote}
                        placeholder="Day note (e.g. last day in Lima)"
                        onChange={(v) => patchDay(day.date, { dayNote: v })}
                      />
                    </div>
                  )}
                  {entries.length === 0 && day.dayNote == null && (
                    <div className="itinerary-schedule-empty" aria-hidden />
                  )}
                  {entries.map((entry) => {
                    const chunks =
                      entry.kind === "flight" && (entry.flight?.segments?.length || 0) >= 2
                        ? expandFlightScheduleChunks(entry)
                        : null

                    if (chunks && chunks.length > 0) {
                      return (
                        <div
                          key={entry.id}
                          className={`itinerary-flight-chunks ${dragId === entry.id ? "is-dragging" : ""} ${
                            dragOverId === entry.id ? "is-drag-over" : ""
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            if (dragId && dragId !== entry.id) setDragOverId(entry.id)
                          }}
                          onDragLeave={() => {
                            if (dragOverId === entry.id) setDragOverId(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragId) reorderSchedule(day.date, dragId, entry.id)
                            setDragId(null)
                            setDragOverId(null)
                          }}
                        >
                          {chunks.map((chunk, chunkIdx) => (
                            <div
                              key={chunk.key}
                              className={`itinerary-schedule-row is-editable ${
                                chunk.kind === "layover" ? "is-layover" : "is-flight-leg"
                              }`}
                            >
                              {chunkIdx === 0 ? (
                                <button
                                  type="button"
                                  className="itinerary-drag-handle no-print"
                                  title="Drag to reorder"
                                  draggable
                                  onDragStart={(e) => {
                                    setDragId(entry.id)
                                    e.dataTransfer.effectAllowed = "move"
                                    e.dataTransfer.setData("text/plain", entry.id)
                                  }}
                                  onDragEnd={() => {
                                    setDragId(null)
                                    setDragOverId(null)
                                  }}
                                >
                                  ⋮⋮
                                </button>
                              ) : (
                                <span className="itinerary-drag-handle no-print" aria-hidden />
                              )}
                              <input
                                type="time"
                                className="itinerary-time-input"
                                value={chunk.time || ""}
                                readOnly
                                title="Re-paste flight to edit legs"
                              />
                              <span className="itinerary-sched-body">
                                <div className="itinerary-sched-title">{chunk.text}</div>
                                {chunk.detail && (
                                  <div className="itinerary-sched-detail">{chunk.detail}</div>
                                )}
                              </span>
                            </div>
                          ))}
                          <details className="itinerary-flight-raw no-print itinerary-flight-chunks-edit">
                            <summary>Edit / re-paste flight details</summary>
                            <textarea
                              className="itinerary-flight-paste"
                              rows={8}
                              value={entry.flight?.rawText || ""}
                              placeholder="Paste unstructured flight details…"
                              onChange={(e) =>
                                updateEntry(day.date, entry.id, {
                                  flight: {
                                    ...(entry.flight || { flightNumber: "" }),
                                    rawText: e.target.value,
                                  },
                                })
                              }
                            />
                            <button
                              type="button"
                              className="itin-action itin-action-primary"
                              onClick={() =>
                                reparseFlight(day.date, entry.id, entry.flight?.rawText || "")
                              }
                            >
                              Re-parse into separate legs
                            </button>
                            <button
                              type="button"
                              className="itinerary-row-remove"
                              title="Remove flight"
                              onClick={() => removeEntry(day.date, entry.id)}
                            >
                              Remove
                            </button>
                          </details>
                        </div>
                      )
                    }

                    return (
                    <div
                      key={entry.id}
                      className={`itinerary-schedule-row is-editable ${entry.kind === "note" ? "is-accent" : ""} ${
                        /layover|arrive in/i.test(entry.text) ? "is-layover" : ""
                      } ${dragId === entry.id ? "is-dragging" : ""} ${
                        dragOverId === entry.id ? "is-drag-over" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragId && dragId !== entry.id) setDragOverId(entry.id)
                      }}
                      onDragLeave={() => {
                        if (dragOverId === entry.id) setDragOverId(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragId) reorderSchedule(day.date, dragId, entry.id)
                        setDragId(null)
                        setDragOverId(null)
                      }}
                    >
                      <button
                        type="button"
                        className="itinerary-drag-handle no-print"
                        title="Drag to reorder"
                        draggable
                        onDragStart={(e) => {
                          setDragId(entry.id)
                          e.dataTransfer.effectAllowed = "move"
                          e.dataTransfer.setData("text/plain", entry.id)
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setDragOverId(null)
                        }}
                      >
                        ⋮⋮
                      </button>
                      {entry.kind === "note" ? (
                        <span className="itinerary-sched-body itinerary-note-body">
                          <AutoGrowTextarea
                            className="itinerary-inline-input itinerary-autogrow"
                            value={entry.text}
                            placeholder="Note…"
                            onChange={(v) =>
                              updateEntry(day.date, entry.id, { text: v, time: undefined })
                            }
                          />
                        </span>
                      ) : entry.kind === "flight" ? (
                        <>
                          <input
                            type="time"
                            className="itinerary-time-input"
                            value={entry.time || ""}
                            onChange={(e) => {
                              const time = e.target.value
                              const base = entry.flight || { flightNumber: "" }
                              const depDate = (base.departureTime || `${day.date}T${time}:00`).slice(0, 10)
                              const patched = patchFlightFields(base, {
                                departureTime: time ? `${depDate}T${time}:00` : base.departureTime,
                              })
                              updateEntry(day.date, entry.id, {
                                time,
                                text: patched.text,
                                flight: patched.flight,
                              })
                            }}
                          />
                          <span className="itinerary-sched-body">
                            <input
                              className="itinerary-inline-input itinerary-flight-title"
                              value={entry.text}
                              placeholder="Flight title"
                              onChange={(e) => {
                                const text = e.target.value
                                updateEntry(day.date, entry.id, {
                                  text,
                                  flight: { ...(entry.flight || { flightNumber: "" }), title: text },
                                })
                              }}
                            />
                            <AutoGrowTextarea
                              className="itinerary-inline-input itinerary-autogrow itinerary-flight-detail"
                              value={entry.flight?.detail || ""}
                              placeholder="Duration, stops, landing…"
                              onChange={(v) =>
                                updateEntry(day.date, entry.id, {
                                  flight: { ...(entry.flight || { flightNumber: "" }), detail: v },
                                })
                              }
                            />
                            <div className="itinerary-flight-fields no-print">
                              <input
                                className="itinerary-inline-input"
                                placeholder="Airline"
                                value={entry.flight?.airline || ""}
                                onChange={(e) => {
                                  const patched = patchFlightFields(entry.flight || { flightNumber: "" }, {
                                    airline: e.target.value,
                                  })
                                  updateEntry(day.date, entry.id, {
                                    flight: patched.flight,
                                    text: patched.text,
                                  })
                                }}
                              />
                              <input
                                className="itinerary-inline-input"
                                placeholder="Flight #"
                                value={entry.flight?.flightNumber || ""}
                                onChange={(e) => {
                                  const patched = patchFlightFields(entry.flight || { flightNumber: "" }, {
                                    flightNumber: e.target.value,
                                  })
                                  updateEntry(day.date, entry.id, {
                                    flight: patched.flight,
                                    text: patched.text,
                                  })
                                }}
                              />
                              <input
                                className="itinerary-inline-input"
                                placeholder="From airport"
                                value={entry.flight?.fromAirport || entry.flight?.fromCity || ""}
                                onChange={(e) => {
                                  const v = e.target.value
                                  const patched = patchFlightFields(entry.flight || { flightNumber: "" }, {
                                    fromAirport: v.length <= 4 ? v.toUpperCase() : v,
                                    fromCity: v.length > 4 ? v : entry.flight?.fromCity,
                                  })
                                  updateEntry(day.date, entry.id, {
                                    flight: patched.flight,
                                    text: patched.text,
                                  })
                                }}
                              />
                              <span>→</span>
                              <input
                                className="itinerary-inline-input"
                                placeholder="To airport"
                                value={entry.flight?.toAirport || entry.flight?.toCity || ""}
                                onChange={(e) => {
                                  const v = e.target.value
                                  const patched = patchFlightFields(entry.flight || { flightNumber: "" }, {
                                    toAirport: v.length <= 4 ? v.toUpperCase() : v,
                                    toCity: v.length > 4 ? v : entry.flight?.toCity,
                                  })
                                  updateEntry(day.date, entry.id, {
                                    flight: patched.flight,
                                    text: patched.text,
                                  })
                                }}
                              />
                              <input
                                className="itinerary-inline-input itinerary-conf-input"
                                placeholder="Confirmation #"
                                value={entry.flight?.confirmation || ""}
                                onChange={(e) => {
                                  const patched = patchFlightFields(entry.flight || { flightNumber: "" }, {
                                    confirmation: e.target.value,
                                  })
                                  updateEntry(day.date, entry.id, { flight: patched.flight })
                                }}
                              />
                            </div>
                            <details className="itinerary-flight-raw no-print">
                              <summary>Edit / re-paste flight details</summary>
                              <textarea
                                className="itinerary-flight-paste"
                                rows={8}
                                value={entry.flight?.rawText || ""}
                                placeholder="Paste unstructured flight details from any travel site…"
                                onChange={(e) =>
                                  updateEntry(day.date, entry.id, {
                                    flight: {
                                      ...(entry.flight || { flightNumber: "" }),
                                      rawText: e.target.value,
                                    },
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="itin-action itin-action-primary"
                                onClick={() =>
                                  reparseFlight(day.date, entry.id, entry.flight?.rawText || "")
                                }
                              >
                                Re-parse paste
                              </button>
                            </details>
                          </span>
                        </>
                      ) : (
                        <>
                          <input
                            type="time"
                            className="itinerary-time-input"
                            value={entry.time || ""}
                            onChange={(e) => updateEntry(day.date, entry.id, { time: e.target.value })}
                          />
                          <span className="itinerary-sched-body">
                            <AutoGrowTextarea
                              className="itinerary-inline-input itinerary-autogrow"
                              value={entry.text}
                              placeholder="Plan / event (multiline OK)"
                              onChange={(v) => updateEntry(day.date, entry.id, { text: v })}
                            />
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        className="itinerary-row-remove no-print"
                        title="Remove"
                        onClick={() => removeEntry(day.date, entry.id)}
                      >
                        ×
                      </button>
                    </div>
                    )
                  })}

                  <div className="itinerary-day-actions no-print">
                    <button type="button" className="itin-action" onClick={() => addPlan(day.date, "plan")}>
                      + Plan
                    </button>
                    <button type="button" className="itin-action" onClick={() => addPlan(day.date, "note")}>
                      + Note
                    </button>
                    <button
                      type="button"
                      className="itin-action itin-action-primary"
                      onClick={() =>
                        setFlightPasteOpen((cur) => (cur === day.date ? null : day.date))
                      }
                    >
                      + Flight
                    </button>
                    <button
                      type="button"
                      className="itin-action itin-action-ghost"
                      onClick={() => syncDayToHomePlan(day)}
                      title="Write into Home → Plan for this date"
                    >
                      Sync to day plan
                    </button>
                  </div>
                  {flightPasteOpen === day.date && (
                    <div className="itinerary-flight-paste-panel no-print">
                      <label className="itinerary-flight-paste-label">
                        Paste flight details from any travel site
                      </label>
                      <textarea
                        className="itinerary-flight-paste"
                        rows={10}
                        placeholder={`Paste anything — Volaris boarding pass, Google Flights, etc.

Volaris reservation code: OBGTNV
DEPARTURE  Mon, 27Jul2026
4:27 PM → 8:50 PM  Tijuana → Mexico City
Operated by: Y4 Volaris México 183
Layover of 1h 10m in Mexico City
10:00 PM → 5:01 AM  Mexico City → Lima
Operated by: Y4 Volaris México 3918`}
                        value={flightPasteDraft[day.date] || ""}
                        onChange={(e) =>
                          setFlightPasteDraft((s) => ({ ...s, [day.date]: e.target.value }))
                        }
                      />
                      <div className="itinerary-flight-paste-actions">
                        <button
                          type="button"
                          className="itin-action itin-action-primary"
                          onClick={() => void addFlightFromPaste(day.date)}
                          disabled={flightBusy === day.date || !(flightPasteDraft[day.date] || "").trim()}
                        >
                          {flightBusy === day.date ? "Looking up…" : "Parse & add"}
                        </button>
                        <button
                          type="button"
                          className="itin-action"
                          onClick={() => setFlightPasteOpen(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {showSleep && (
                <div className="itinerary-sleep-row">
                  <span className="itinerary-sleep-label">Sleep:</span>
                  <div className="itinerary-sleep-content">
                    <input
                      className="itinerary-inline-input"
                      placeholder="Where you're staying"
                      value={day.sleepName || ""}
                      onChange={(e) => patchDay(day.date, { sleepName: e.target.value })}
                    />
                    <input
                      className="itinerary-inline-input"
                      placeholder="Address"
                      value={day.sleepAddress || ""}
                      onChange={(e) => patchDay(day.date, { sleepAddress: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
