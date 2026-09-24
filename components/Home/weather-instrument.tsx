/**
 * components/Home/weather-instrument.tsx — Home weather analog tile + detail
 *
 * Tile glance: city caption, CRT degree, one footer line. Click opens the instrument: city
 * search (Open-Meteo geocoding), NOAA beach picker, human forecast, rain
 * plate, week strip — phosphor / metal / Win95 navy, never orange. Last pin
 * lives in `cogs-home-weather`; Settings home city is fallback only.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { searchCities, type CitySuggestion } from "@/lib/city-search"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  weatherHumanForecast,
  weatherAdvisories,
  weatherRainCopy,
  weatherWeekday,
  resolveWeatherCity,
} from "@/lib/home-weather"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import {
  pickWeatherDayStrip,
  weatherIconKind,
  weatherIconKindFromCode,
  weatherLaterGlance,
  weatherNeedleDeg,
  weatherSparkPath,
  type WeatherIconKind,
} from "@/lib/home-widgets"
import { coastPicksNear, fetchHomeTide, type CoastPick, type HomeTide } from "@/lib/tide-client"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { TileHide } from "@/components/Home/home-widget-dialog"
import {
  fetchHomeAirQuality,
  fetchHomeDayWeather,
  type HomeAirQuality,
  type HomeDayWeather,
  type HomeWeekDay,
} from "@/lib/weather-client"
import { cn } from "@/lib/utils"

export function WeatherTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const cityQuery = useHomeWeatherStore((s) => s.cityQuery)
  const cityName = useHomeWeatherStore((s) => s.cityName)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const stationId = useHomeWeatherStore((s) => s.stationId)
  const beachLabel = useHomeWeatherStore((s) => s.beachLabel)
  const dateKey = formatLocalDateKey(currentDate)
  const todayKey = formatLocalDateKey(new Date())
  const [wx, setWx] = useState<HomeDayWeather | null>(null)
  const [tide, setTide] = useState<HomeTide | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading")
  const [open, setOpen] = useState(false)

  const city = resolveWeatherCity(
    { cityQuery, cityName, lat, lng, stationId, beachLabel },
    settingsCity,
  )
  const coords =
    lat != null && lng != null ? { lat, lng, name: cityName || city } : null

  useEffect(() => {
    let alive = true
    setStatus("loading")
    Promise.all([
      fetchHomeDayWeather(city, dateKey, coords),
      fetchHomeTide(city, dateKey, stationId),
    ])
      .then(([nextWx, nextTide]) => {
        if (!alive) return
        setWx(nextWx)
        setTide(nextTide)
        setStatus(nextWx ? "ready" : "empty")
      })
      .catch(() => {
        if (!alive) return
        setWx(null)
        setTide(null)
        setStatus("empty")
      })
    return () => {
      alive = false
    }
  }, [city, dateKey, coords?.lat, coords?.lng, coords?.name, stationId])

  const nowHour = dateKey === todayKey ? currentDate.getHours() : undefined
  const labelCity = wx?.cityName?.split(",")[0] ?? cityName.split(",")[0] ?? city.split(",")[0] ?? "Home"
  const faceCity = beachLabel || labelCity
  const icon =
    status === "ready" && wx
      ? weatherIconKindFromCode(wx.weatherCode)
      : weatherIconKind(undefined)
  const glance =
    status === "loading"
      ? "Looking up…"
      : wx
        ? weatherLaterGlance(wx.hourly, {
            nowHour,
            condition: wx.typical ? `Typically ${wx.condition}` : wx.condition,
            tempF: wx.tempF,
          })
        : city.trim()
          ? "No reading."
          : "Set a home city in Settings."

  return (
    <>
      <div className="home-tile is-weather is-instrument" data-widget="weather" data-testid="home-weather-tile">
        <TileHide id="weather" onHide={onHide} />
        <button
          type="button"
          className="home-weather-open"
          aria-label="Open weather detail"
          onClick={() => setOpen(true)}
        >
          <div className="hab-score-caption">
            <span>{faceCity}</span>
          </div>
          <div className="hab-score-readout home-weather-readout" data-centered="true">
            <WeatherGlyph kind={icon} />
            <span>{status === "loading" ? "···" : wx ? `${wx.tempF}°` : "—"}</span>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{glance}</p>
          </div>
        </button>
      </div>
      <WeatherDetailDialog
        open={open}
        onOpenChange={setOpen}
        city={labelCity}
        beachLabel={beachLabel}
        wx={wx}
        tide={tide}
        nowHour={nowHour}
        icon={icon}
      />
    </>
  )
}

function WeatherGlyph({ kind, className }: { kind: WeatherIconKind; className?: string }) {
  return (
    <svg
      className={className ?? "home-weather-icon"}
      viewBox="0 0 16 16"
      aria-hidden
      data-weather-icon={kind}
    >
      {kind === "sun" ? (
        <>
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="square"
            d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.15 3.15l1.25 1.25M11.6 11.6l1.25 1.25M3.15 12.85l1.25-1.25M11.6 4.4l1.25-1.25"
          />
        </>
      ) : (
        <>
          <path
            fill="currentColor"
            d="M4.1 11.1h7.6c1.35 0 2.3-.95 2.3-2.15 0-1.15-.9-2.05-2.15-2.15-.25-1.55-1.6-2.7-3.25-2.7-1.35 0-2.5.75-3.05 1.85-.25-.1-.55-.15-.85-.15-1.35 0-2.4.95-2.4 2.2 0 1.25 1.1 2.1 2.8 2.1z"
          />
          {kind === "rain" && (
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="square"
              d="M5.2 12.2v2.1M8 12.2v2.1M10.8 12.2v2.1"
            />
          )}
        </>
      )}
    </svg>
  )
}

function WeatherMeter({ temp, low, high }: { temp: number; low: number; high: number }) {
  const deg = weatherNeedleDeg(temp, low, high)
  return (
    <svg className="home-weather-meter" viewBox="0 0 40 28" aria-hidden>
      <path
        className="home-weather-meter-face"
        d="M4 24 A16 16 0 0 1 36 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="butt"
      />
      <path
        className="home-weather-meter-arc"
        d="M6.4 24 A13.6 13.6 0 0 1 33.6 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const a = ((-70 + t * 140) * Math.PI) / 180
        const x1 = 20 + Math.sin(a) * 11.2
        const y1 = 24 - Math.cos(a) * 11.2
        const x2 = 20 + Math.sin(a) * 14.6
        const y2 = 24 - Math.cos(a) * 14.6
        return (
          <line
            key={t}
            className="home-weather-meter-tick"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.9"
          />
        )
      })}
      <g transform={`rotate(${deg} 20 24)`}>
        <line
          className="home-weather-meter-needle"
          x1="20"
          y1="24"
          x2="20"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="square"
        />
      </g>
      <circle className="home-weather-meter-hub" cx="20" cy="24" r="1.7" fill="currentColor" />
    </svg>
  )
}

function WeatherSpark({
  temps,
  nowHour,
  hours,
  testId,
}: {
  temps: number[]
  nowHour?: number
  hours: Array<{ hour: number }>
  testId?: string
}) {
  const spark = weatherSparkPath(temps, 120, 16)
  const sparkNow =
    nowHour != null && hours.length > 1
      ? (() => {
          const idx = hours.findIndex((h) => h.hour === nowHour)
          if (idx < 0) return null
          return (idx / (hours.length - 1)) * 120
        })()
      : null
  return (
    <svg
      className="home-weather-spark"
      viewBox="0 0 120 16"
      preserveAspectRatio="none"
      aria-hidden
      data-testid={testId}
    >
      {spark ? <path d={spark} fill="none" stroke="currentColor" strokeWidth="1.15" /> : null}
      {sparkNow != null ? (
        <line
          className="home-weather-spark-now"
          x1={sparkNow}
          y1="0"
          x2={sparkNow}
          y2="16"
          stroke="currentColor"
          strokeWidth="0.7"
        />
      ) : null}
    </svg>
  )
}

function WeatherHourStrip({
  hours,
  nowHour,
}: {
  hours: Array<{ hour: number; tempF: number; weatherCode?: number }>
  nowHour?: number
}) {
  const strip = pickWeatherDayStrip(hours, nowHour)
  return (
    <ol className="home-weather-strip" data-testid="home-weather-strip">
      {strip.length > 0
        ? strip.map((chip) => (
            <li
              key={chip.hour}
              className={chip.now ? "home-weather-chip is-now" : "home-weather-chip"}
              data-hour={chip.hour}
            >
              <span className="home-weather-chip-hour">{chip.label}</span>
              <WeatherGlyph kind={chip.kind} className="home-weather-chip-icon" />
              <span className="home-weather-chip-temp">{chip.tempF}°</span>
            </li>
          ))
        : ["6a", "9a", "12", "3p", "6p", "9p"].map((hour) => (
            <li key={hour} className="home-weather-chip is-empty" data-hour={hour}>
              <span className="home-weather-chip-hour">{hour}</span>
              <span className="home-weather-chip-temp">—</span>
            </li>
          ))}
    </ol>
  )
}

function WeatherWeekStrip({ days }: { days: HomeWeekDay[] }) {
  const shown = days.slice(0, 7)
  return (
    <ol className="home-weather-week" data-testid="home-weather-week">
      {shown.map((day) => (
        <li key={day.date} className="home-weather-week-day" data-date={day.date}>
          <span className="home-weather-week-name">{weatherWeekday(day.date)}</span>
          <WeatherGlyph kind={weatherIconKindFromCode(day.weatherCode)} className="home-weather-chip-icon" />
          <span className="home-weather-week-hl">
            {day.highF}°/{day.lowF}°
          </span>
          <span className="home-weather-week-rain">
            {day.precipChance != null ? `${day.precipChance}%` : "—"}
          </span>
        </li>
      ))}
    </ol>
  )
}

function WeatherDetailDialog({
  open,
  onOpenChange,
  city,
  beachLabel,
  wx,
  tide,
  nowHour,
  icon,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  city: string
  beachLabel: string | null
  wx: HomeDayWeather | null
  tide: HomeTide | null
  nowHour?: number
  icon: WeatherIconKind
}) {
  const setPlace = useHomeWeatherStore((s) => s.setPlace)
  const stationId = useHomeWeatherStore((s) => s.stationId)
  const [pane, setPane] = useState<"today" | "week">("today")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<CitySuggestion[]>([])
  const [beaches, setBeaches] = useState<CoastPick[]>([])
  const [aqi, setAqi] = useState<HomeAirQuality | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setPane("today")
    setQuery("")
    setHits([])
  }, [open])

  useEffect(() => {
    if (!open) return
    const lat = wx?.lat
    const lng = wx?.lng
    if (lat == null || lng == null) {
      setBeaches([])
      setAqi(null)
      return
    }
    setBeaches(coastPicksNear(lat, lng))
    let alive = true
    void fetchHomeAirQuality(lat, lng).then((next) => {
      if (alive) setAqi(next)
    })
    return () => {
      alive = false
    }
  }, [open, wx?.lat, wx?.lng])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(() => {
      void searchCities(q, 6).then(setHits)
    }, 220)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  const glance = wx
    ? weatherLaterGlance(wx.hourly, {
        nowHour,
        condition: wx.typical ? `Typically ${wx.condition}` : wx.condition,
        tempF: wx.tempF,
      })
    : ""
  const story = wx
    ? weatherHumanForecast({
        city,
        condition: wx.typical ? `Typically ${wx.condition}` : wx.condition,
        glance,
        precipChance: wx.precipChance,
        humidity: wx.humidity,
        uvIndex: wx.uvIndex,
        visibilityMi: wx.visibilityMi,
        apparentF: wx.apparentF,
        tempF: wx.tempF,
        windMph: wx.windMph,
        beachLabel,
      })
    : "No forecast for this day."
  const rain = weatherRainCopy(wx?.precipChance)
  const advisories = wx
    ? weatherAdvisories({
        weatherCode: wx.weatherCode,
        windMph: wx.windMph,
        gustMph: wx.gustMph,
        uvIndex: wx.uvIndex,
        visibilityMi: wx.visibilityMi,
        humidity: wx.humidity,
        precipChance: wx.precipChance,
      })
    : []
  const tideSpark = tide && tide.hourlyFt.length > 1 ? weatherSparkPath(tide.hourlyFt, 120, 14) : ""
  const titleCity = beachLabel ? `${city} · ${beachLabel}` : city

  const pickCity = (hit: CitySuggestion) => {
    setPlace({
      cityQuery: hit.label,
      cityName: hit.name,
      lat: hit.lat,
      lng: hit.lng,
      stationId: null,
      beachLabel: null,
    })
    setQuery("")
    setHits([])
  }

  const pickBeach = (pick: CoastPick) => {
    setPlace({
      stationId: pick.stationId,
      beachLabel: pick.beach,
      lat: pick.lat,
      lng: pick.lng,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="home95 home-weather-dialog home-widget-dialog home-widget-instrument" aria-describedby={undefined} hideClose>
        <button type="button" className="home-widget-dismiss" aria-label="Close" onClick={() => onOpenChange(false)}>
          ×
        </button>
        <DialogHeader className="home-weather-dialog-title home-widget-caption">
          <span className="home-widget-power" aria-hidden="true" />
          <DialogTitle>Weather · {titleCity}</DialogTitle>
        </DialogHeader>
        <div className="home-weather-dialog-body">
          <label className="home-weather-search">
            <span>City</span>
            <input
              type="search"
              value={query}
              placeholder="Search other cities"
              aria-label="Search other cities"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {hits.length > 0 ? (
            <ul className="home-weather-hits" role="listbox" aria-label="Cities">
              {hits.map((hit) => (
                <li key={`${hit.label}-${hit.lat}`}>
                  <button type="button" onClick={() => pickCity(hit)}>
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="home-weather-dialog-label">Beaches</p>
          {beaches.length > 0 ? (
            <div className="home-weather-beaches" role="group" aria-label="Beaches">
              {beaches.map((pick) => {
                const selected = beachLabel ? beachLabel === pick.beach : stationId === pick.stationId && pick.beach === pick.stationName
                return (
                  <button
                    key={`${pick.stationId}:${pick.beach}`}
                    type="button"
                    className={cn("home-weather-beach", selected && "is-on")}
                    aria-pressed={!!selected}
                    onClick={() => pickBeach(pick)}
                  >
                    {pick.beach}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="home-weather-tide-empty">No catalog beach this far inland.</p>
          )}

          <div className="home-weather-panes" role="tablist" aria-label="Forecast range">
            <button
              type="button"
              role="tab"
              aria-selected={pane === "today"}
              className={cn("home-weather-pane", pane === "today" && "is-on")}
              onClick={() => setPane("today")}
            >
              Today
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pane === "week"}
              className={cn("home-weather-pane", pane === "week" && "is-on")}
              onClick={() => setPane("week")}
            >
              Week
            </button>
          </div>

          <div className="home-weather-dialog-head">
            {wx ? <WeatherMeter temp={wx.tempF} low={wx.lowF} high={wx.highF} /> : null}
            <div className="hab-score-readout home-weather-readout is-dialog" data-centered="true">
              <WeatherGlyph kind={icon} />
              <span>{wx ? `${wx.tempF}°` : "—"}</span>
            </div>
          </div>
          <p className="home-weather-dialog-cond">{wx?.condition ?? "No reading"}</p>
          <p className="home-weather-rain" data-testid="home-weather-rain">
            {rain}
          </p>
          <p className="home-weather-story">{story}</p>
          {advisories.length > 0 ? (
            <ul className="home-weather-alerts" data-testid="home-weather-alerts">
              {advisories.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="home-weather-dialog-facts">
            {wx
              ? [
                  `H ${wx.highF}°`,
                  `L ${wx.lowF}°`,
                  wx.humidity != null ? `${wx.humidity}% humidity` : null,
                  wx.uvIndex != null ? `UV ${wx.uvIndex}` : null,
                  wx.visibilityMi != null ? `${wx.visibilityMi} mi vis` : null,
                  wx.windMph != null ? `${wx.windMph} mph` : null,
                  wx.gustMph != null ? `gusts ${wx.gustMph}` : null,
                  aqi ? `AQI ${aqi.usAqi} ${aqi.label}` : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")
              : "No forecast for this day."}
          </p>
          {wx?.sunrise && wx.sunset ? (
            <p className="home-weather-sun">
              {wx.sunrise} – {wx.sunset}
            </p>
          ) : null}

          {pane === "week" ? (
            <>
              <p className="home-weather-dialog-label">This week</p>
              <WeatherWeekStrip days={wx?.week ?? []} />
            </>
          ) : (
            <>
              <p className="home-weather-dialog-label">Through the day</p>
              <WeatherSpark
                temps={wx?.hourly.map((h) => h.tempF) ?? []}
                nowHour={nowHour}
                hours={wx?.hourly ?? []}
                testId="home-weather-spark"
              />
              <WeatherHourStrip hours={wx?.hourly ?? []} nowHour={nowHour} />
            </>
          )}

          <p className="home-weather-dialog-label">
            Tide{beachLabel ? ` · ${beachLabel}` : tide ? ` · ${tide.place}` : ""}
          </p>
          {tide ? (
            <div className="home-weather-tide" data-testid="home-weather-tide">
              <p className="home-weather-tide-station">{tide.stationName}</p>
              <div className="home-weather-tide-readouts">
                <span>Now {tide.heightFt != null ? `${tide.heightFt.toFixed(1)} ft` : "—"}</span>
                <span>
                  ↑ High {tide.nextHigh ? `${tide.nextHigh.heightFt.toFixed(1)} ft ${tide.nextHigh.timeLabel}` : "—"}
                </span>
                <span>
                  ↓ Low {tide.nextLow ? `${tide.nextLow.heightFt.toFixed(1)} ft ${tide.nextLow.timeLabel}` : "—"}
                </span>
              </div>
              {tideSpark ? (
                <svg className="home-weather-spark is-tide" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden>
                  <path d={tideSpark} fill="none" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              ) : null}
            </div>
          ) : (
            <p className="home-weather-tide-empty">No tide for this coast.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
