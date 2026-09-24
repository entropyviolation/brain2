/**
 * components/Home/Tracking/trk-time-markers.tsx — Now / sunrise / sunset lines
 *
 * These lines are part of the instrument. Do not remove them. The day grid
 * runs time left-to-right inside each hour row, so the markers are vertical.
 * The week grid runs time down the columns, so they are horizontal. Colors
 * stay gray/red on a white plot — never brown or yellow.
 */
"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import { minutesToLabel } from "@/lib/time-entries"
import type { DaySunTimes } from "@/lib/sun-times"
import {
  peekOrComputeDaySun,
  sunPlaceForCity,
  useSunTimesStore,
} from "@/lib/sun-times-store"

export type MarkerAxis = "x" | "y"

export type TrackingSunTimes = {
  sunriseMinutes: number
  sunsetMinutes: number
  sunriseLabel: string
  sunsetLabel: string
}

function toTrackingSun(sun: DaySunTimes | null | undefined): TrackingSunTimes | null {
  if (!sun) return null
  return {
    sunriseMinutes: sun.sunriseMinutes,
    sunsetMinutes: sun.sunsetMinutes,
    sunriseLabel: sun.sunriseLabel,
    sunsetLabel: sun.sunsetLabel,
  }
}

function useHomeSunPlace() {
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const places = useSunTimesStore((s) => s.places)
  const city = homeCity.trim() || DEFAULT_HOME_CITY
  return sunPlaceForCity(city, places)
}

/** Sun clocks keyed by each row's `YYYY-MM-DD`, not `new Date()`. */
export function useTrackingSunMap(dateKeys: readonly string[]): Record<string, TrackingSunTimes> {
  const place = useHomeSunPlace()
  const days = useSunTimesStore((s) => s.days)
  const firstKeyByDate = useSunTimesStore((s) => s.firstKeyByDate)
  const rememberManyIfAbsent = useSunTimesStore((s) => s.rememberManyIfAbsent)
  const keys = dateKeys.join(",")

  useEffect(() => {
    if (!place) return
    const state = useSunTimesStore.getState()
    const batch: DaySunTimes[] = []
    for (const key of dateKeys) {
      const sun = peekOrComputeDaySun(key, place.lat, place.lng, state)
      if (sun) batch.push(sun)
    }
    rememberManyIfAbsent(batch)
  }, [keys, place, rememberManyIfAbsent, dateKeys])

  return useMemo(() => {
    const out: Record<string, TrackingSunTimes> = {}
    if (!place) return out
    const state = { days, firstKeyByDate }
    for (const key of dateKeys) {
      const tracking = toTrackingSun(peekOrComputeDaySun(key, place.lat, place.lng, state))
      if (tracking) out[key] = tracking
    }
    return out
  }, [keys, place, days, firstKeyByDate, dateKeys])
}

export function useTrackingDayMarkers(date: Date): {
  nowMinute: number | null
  sun: TrackingSunTimes | null
} {
  const dayKey = formatLocalDateKey(date)
  const todayKey = formatLocalDateKey(new Date())
  const isToday = dayKey === todayKey
  const sunByDate = useTrackingSunMap([dayKey])
  const [nowMinute, setNowMinute] = useState<number | null>(() => {
    if (!isToday) return null
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    if (!isToday) {
      setNowMinute(null)
      return
    }
    const tick = () => {
      const n = new Date()
      setNowMinute(n.getHours() * 60 + n.getMinutes())
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [isToday, dayKey])

  return { nowMinute, sun: sunByDate[dayKey] ?? null }
}

function markerStyle(axis: MarkerAxis, minute: number, origin: number, span: number): CSSProperties {
  const t = span <= 0 ? 0 : ((minute - origin) / span) * 100
  if (axis === "x") {
    return { left: `${t}%`, top: 0, bottom: 0, width: 2 }
  }
  return { top: `${t}%`, left: 0, right: 0, height: 2 }
}

export function TrkTimeMarker({
  minute,
  origin,
  span,
  axis,
  tone,
  label,
}: {
  minute: number
  origin: number
  span: number
  axis: MarkerAxis
  tone: "now" | "sunrise" | "sunset"
  label: string
}) {
  if (minute < origin || minute >= origin + span) return null
  return (
    <div
      className={`trk-marker trk-marker-${tone}${axis === "x" ? " trk-marker-x" : " trk-marker-y"}`}
      style={markerStyle(axis, minute, origin, span)}
      title={label}
      aria-hidden
    >
      <span className="trk-marker-label">{label}</span>
    </div>
  )
}

export function TrkPlotMarkers({
  origin,
  span,
  axis,
  nowMinute,
  sun,
  showNowLabel = false,
}: {
  origin: number
  span: number
  axis: MarkerAxis
  nowMinute: number | null
  sun: TrackingSunTimes | null
  showNowLabel?: boolean
}) {
  return (
    <>
      {sun && (
        <TrkTimeMarker
          minute={sun.sunriseMinutes}
          origin={origin}
          span={span}
          axis={axis}
          tone="sunrise"
          label={`Sunrise ${sun.sunriseLabel}`}
        />
      )}
      {sun && (
        <TrkTimeMarker
          minute={sun.sunsetMinutes}
          origin={origin}
          span={span}
          axis={axis}
          tone="sunset"
          label={`Sunset ${sun.sunsetLabel}`}
        />
      )}
      {nowMinute != null && (
        <TrkTimeMarker
          minute={nowMinute}
          origin={origin}
          span={span}
          axis={axis}
          tone="now"
          label={showNowLabel ? `Now ${minutesToLabel(nowMinute)}` : "Now"}
        />
      )}
    </>
  )
}
