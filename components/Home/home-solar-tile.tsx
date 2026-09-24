/**
 * components/Home/home-solar-tile.tsx — Solar remainder on the Home strip
 *
 * Live clock against today's sunrise and sunset at the weather pin (else
 * Settings city / San Diego). Off by default.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { clockMinutesOnDay, solarRemainderFace } from "@/lib/solar-remainder"
import { SAN_DIEGO_COORDS, computeDaySun } from "@/lib/sun-times"
import { sunPlaceForCity, useSunTimesStore } from "@/lib/sun-times-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"

export function SolarRemainderTile({ onHide }: { onHide: () => void }) {
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const places = useSunTimesStore((s) => s.places)
  const rememberIfAbsent = useSunTimesStore((s) => s.rememberIfAbsent)
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const pin = useMemo(() => {
    if (lat != null && lng != null) return { lat, lng }
    return sunPlaceForCity(settingsCity, places) ?? SAN_DIEGO_COORDS
  }, [lat, lng, settingsCity, places])

  const dateKey = formatLocalDateKey(now)
  const sun = useMemo(() => computeDaySun(dateKey, pin.lat, pin.lng), [dateKey, pin.lat, pin.lng])

  useEffect(() => {
    if (sun) rememberIfAbsent(sun)
  }, [sun, rememberIfAbsent])

  const face = solarRemainderFace(clockMinutesOnDay(now), sun)

  return (
    <>
      <div className="home-tile is-solar" data-widget="solar" data-testid="home-solar-tile">
        <TileHide id="solar" onHide={onHide} />
        <TileOpen label="Solar remainder" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Solar remainder</span>
          </div>
          <div className="hab-score-readout home-solar-readout" data-centered="true" data-phase={face.phase}>
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Solar remainder">
        <WidgetWell label={face.footer} tone="nixie">{face.crt}</WidgetWell>
        <p className="home-widget-note">
          Until sunrise, then sunrise, then to sunset, then sunset, then after
          sunset until midnight, then the next day’s sunrise.
        </p>
        {sun ? (
          <WidgetWells>
            <WidgetWell label="Rise">{sun.sunriseLabel}</WidgetWell>
            <WidgetWell label="Set" tone="nixie">{sun.sunsetLabel}</WidgetWell>
          </WidgetWells>
        ) : (
          <p className="home-widget-note">No rise or set at this pin today.</p>
        )}
      </HomeWidgetDialog>
    </>
  )
}
