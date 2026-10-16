/**
 * components/Home/ToDo/use-rites-sun.ts — Today's sunset for Rites follow the sun
 *
 * Sunset comes from `computeDaySun` at the Home weather pin, else the home
 * city, else San Diego (the weather tile's order). `now` re-renders once at
 * sunset and once at midnight, so the Morning and Night rows swap without a
 * reload or a minute tick.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { computeDaySun, SAN_DIEGO_COORDS } from "@/lib/sun-times"
import { sunPlaceForCity, useSunTimesStore } from "@/lib/sun-times-store"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { localDayKey } from "@/lib/reviews-store"
import { FALLBACK_SUNSET_MINUTES } from "@/lib/ritual-todo"

export function useRitesSun(enabled: boolean): { now: Date; sunsetMinutes: number } {
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const places = useSunTimesStore((s) => s.places)
  const [now, setNow] = useState(() => new Date())
  const dayKey = localDayKey(now)

  const sunsetMinutes = useMemo(() => {
    const pin = lat != null && lng != null ? { lat, lng } : (sunPlaceForCity(settingsCity, places) ?? SAN_DIEGO_COORDS)
    return computeDaySun(dayKey, pin.lat, pin.lng)?.sunsetMinutes ?? FALLBACK_SUNSET_MINUTES
  }, [dayKey, lat, lng, settingsCity, places])

  useEffect(() => {
    if (!enabled) return
    const current = new Date()
    const mins = current.getHours() * 60 + current.getMinutes()
    const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime()
    const sunset = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, Math.ceil(sunsetMinutes)).getTime()
    const next = mins < sunsetMinutes ? Math.min(sunset, midnight) : midnight
    const id = window.setTimeout(() => setNow(new Date()), Math.max(1000, next - current.getTime() + 500))
    return () => window.clearTimeout(id)
  }, [enabled, sunsetMinutes, now])

  return { now, sunsetMinutes }
}
