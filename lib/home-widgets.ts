/**
 * lib/home-widgets.ts — Home overview strip catalog
 *
 * Square modules on the Home header (every sub-tab). Persist v6 shows
 * Latest award. Persist v5 tucks Night well, Harvest leftover, and Inbox mill.
 * Persist lives in `home-widgets-store.ts`. Gradient stops are the three Habits hues —
 * Percent LED, Week grade tube, Perfect output tube — read-only.
 * `weatherIconKind` maps Open-Meteo copy to sun / cloud / rain glyphs.
 * Glance + tide hint for the square; hourly strip / sparkline / analog
 * needle feed the click-open instrument. Widget city/beach persist is
 * `cogs-home-weather` (`lib/home-weather-store.ts`).
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { DEFAULT_PERCENT_LED_TINT, sanitizePercentLedTint } from "@/lib/habit-led"
import {
  DEFAULT_GRADE_TUBE_COLOR,
  DEFAULT_OUTPUT_TUBE_COLOR,
  sanitizeTubeColor,
} from "@/lib/habit-tube"
import {
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
} from "@/lib/affirmations"
import type { List, Task } from "@/lib/types"

export const HOME_WIDGET_IDS = [
  "review",
  "points",
  "award",
  "progress",
  "affirmation",
  "weather",
  "pet",
  "next",
  "daylamp",
  "daysuntil",
  "solar",
  "tracking",
  "night",
  "harvest",
  "inbox",
] as const

/** Points wells that used to be four tiles. Folded into `points` in persist v3. */
export const LEGACY_POINTS_WIDGET_IDS = ["alltime", "today", "week", "month"] as const

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number]

export const HOME_WIDGET_LABEL: Record<HomeWidgetId, string> = {
  review: "Review",
  points: "Points",
  award: "Latest award",
  progress: "Today's Progress",
  affirmation: "Affirmation",
  weather: "Weather",
  pet: "Screen pet",
  next: "Next",
  daylamp: "Day lamp",
  daysuntil: "Days Until",
  solar: "Solar remainder",
  tracking: "Tracking now",
  night: "Night well",
  harvest: "Harvest leftover",
  inbox: "Inbox mill",
}

/** Shown until the user hides one. Affirmation, weather, Next, and Day lamp start tucked. */
export const DEFAULT_HOME_WIDGET_ORDER: HomeWidgetId[] = [...HOME_WIDGET_IDS]

export const DEFAULT_HOME_WIDGET_HIDDEN: HomeWidgetId[] = [
  "affirmation",
  "weather",
  "next",
  "daylamp",
  "solar",
  "tracking",
  "night",
  "harvest",
  "inbox",
]

/** Optional tiles introduced in persist version 2 — tuck them on older blobs. */
export const HOME_WIDGETS_TUCKED_IN_V2: HomeWidgetId[] = ["next", "daylamp"]

/** Optional tiles introduced in persist version 4. */
export const HOME_WIDGETS_TUCKED_IN_V4: HomeWidgetId[] = ["solar", "tracking"]

/** Optional tiles introduced in persist version 5. */
export const HOME_WIDGETS_TUCKED_IN_V5: HomeWidgetId[] = ["night", "harvest", "inbox"]

/** Latest award joins the strip in persist version 6. It stays visible. */

export function isHomeWidgetId(value: unknown): value is HomeWidgetId {
  return typeof value === "string" && (HOME_WIDGET_IDS as readonly string[]).includes(value)
}

export function sanitizeHomeWidgetOrder(value: unknown): HomeWidgetId[] {
  const seen = new Set<HomeWidgetId>()
  const next: HomeWidgetId[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isHomeWidgetId(item) || seen.has(item)) continue
      seen.add(item)
      next.push(item)
    }
  }
  for (const id of HOME_WIDGET_IDS) {
    if (seen.has(id)) continue
    next.push(id)
  }
  return next
}

export function sanitizeHomeWidgetHidden(value: unknown): HomeWidgetId[] {
  if (!Array.isArray(value)) return [...DEFAULT_HOME_WIDGET_HIDDEN]
  const seen = new Set<HomeWidgetId>()
  for (const item of value) {
    if (isHomeWidgetId(item)) seen.add(item)
  }
  return HOME_WIDGET_IDS.filter((id) => seen.has(id))
}

export function visibleHomeWidgets(order: HomeWidgetId[], hidden: HomeWidgetId[]): HomeWidgetId[] {
  const hide = new Set(hidden)
  return order.filter((id) => !hide.has(id))
}

export function moveHomeWidget(
  order: HomeWidgetId[],
  id: HomeWidgetId,
  direction: -1 | 1,
): HomeWidgetId[] {
  const next = sanitizeHomeWidgetOrder(order)
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  const swap = next[target]!
  next[target] = id
  next[index] = swap
  return next
}

/** CSS variables for the 3-stop pastel under points / progress wells. */
export function homeInstrumentColorVars(led: string, grade: string, output: string): {
  "--home-grad-led": string
  "--home-grad-grade": string
  "--home-grad-output": string
} {
  return {
    "--home-grad-led": sanitizePercentLedTint(led),
    "--home-grad-grade": sanitizeTubeColor(grade, DEFAULT_GRADE_TUBE_COLOR),
    "--home-grad-output": sanitizeTubeColor(output, DEFAULT_OUTPUT_TUBE_COLOR),
  }
}

export function homeWellGradient(led: string, grade: string, output: string): string {
  const vars = homeInstrumentColorVars(led, grade, output)
  return `linear-gradient(90deg, ${vars["--home-grad-led"]}, ${vars["--home-grad-grade"]}, ${vars["--home-grad-output"]})`
}

export const HOME_WELL_GRADIENT_FALLBACK = homeWellGradient(
  DEFAULT_PERCENT_LED_TINT,
  DEFAULT_GRADE_TUBE_COLOR,
  DEFAULT_OUTPUT_TUBE_COLOR,
)

export function affirmationLinesForHome(lists: List[], tasks: Task[]): string[] {
  const list = findAffirmationsCategory(lists)
  if (!list) return DEFAULT_AFFIRMATIONS
  const lines = getAffirmationItems(tasks, list.id)
    .map((item) => affirmationText(item).trim())
    .filter(Boolean)
  return lines.length > 0 ? lines : DEFAULT_AFFIRMATIONS
}

/** Stable daily line so the square does not flicker on remount. */
export function pickDailyAffirmation(lines: string[], dateKey: string): string {
  const pool = lines.length > 0 ? lines : DEFAULT_AFFIRMATIONS
  let hash = 0
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0
  }
  return pool[hash % pool.length]!
}

/** Sun / cloud / rain glyph for the Weather square (matches Open-Meteo labels). */
export type WeatherIconKind = "sun" | "cloud" | "rain"

export function weatherIconKind(weather: string | undefined): WeatherIconKind {
  const t = (weather ?? "").toLowerCase()
  if (/thunder|storm|rain|drizzle|shower/.test(t)) return "rain"
  if (/cloud|overcast|fog|mist|snow|haze/.test(t)) return "cloud"
  if (/clear|sunny|\bsun\b/.test(t)) return "sun"
  return "cloud"
}

/** WMO weather_code → same three glyphs as the copy mapper. */
export function weatherIconKindFromCode(code: number | undefined): WeatherIconKind {
  if (code == null || !Number.isFinite(code)) return "cloud"
  if (code === 0 || code === 1) return "sun"
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return "rain"
  return "cloud"
}

/** Morning → evening 3-hour stations for the Home weather strip. */
export const WEATHER_STRIP_HOURS = [6, 9, 12, 15, 18, 21] as const

export type WeatherHourInput = {
  hour: number
  tempF: number
  weatherCode?: number
  precipChance?: number
}

export type WeatherStripChip = {
  hour: number
  label: string
  tempF: number
  kind: WeatherIconKind
  precipChance?: number
  now: boolean
}

export function weatherHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24
  if (h === 0) return "12a"
  if (h === 12) return "12"
  if (h < 12) return `${h}a`
  return `${h - 12}p`
}

function nearestWeatherHour(hours: WeatherHourInput[], target: number): WeatherHourInput | undefined {
  const exact = hours.find((h) => h.hour === target)
  if (exact) return exact
  let best: WeatherHourInput | undefined
  let bestD = 99
  for (const h of hours) {
    const d = Math.abs(h.hour - target)
    if (d < bestD) {
      best = h
      bestD = d
    }
  }
  return best && bestD <= 1 ? best : undefined
}

/** Six chips (6a–9p) so the tile shows morning vs afternoon vs evening change. */
export function pickWeatherDayStrip(
  hours: WeatherHourInput[],
  nowHour?: number,
): WeatherStripChip[] {
  if (!hours.length) return []
  const chips: WeatherStripChip[] = []
  for (const target of WEATHER_STRIP_HOURS) {
    const hit = nearestWeatherHour(hours, target)
    if (!hit) continue
    chips.push({
      hour: target,
      label: weatherHourLabel(target),
      tempF: Math.round(hit.tempF),
      kind: weatherIconKindFromCode(hit.weatherCode),
      precipChance: hit.precipChance,
      now: nowHour != null && Math.abs(nowHour - target) <= 1,
    })
  }
  return chips
}

/** Phosphor polyline for the day's hourly temps (viewBox units). */
export function weatherSparkPath(temps: number[], width: number, height: number): string {
  if (temps.length < 2 || width <= 0 || height <= 0) return ""
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = Math.max(1, max - min)
  const pad = 1.5
  const innerH = Math.max(1, height - pad * 2)
  return temps
    .map((t, i) => {
      const x = (i / (temps.length - 1)) * width
      const y = pad + (1 - (t - min) / span) * innerH
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

/** Analog meter sweep (−70° … +70°) from day's low → high. */
export function weatherNeedleDeg(temp: number, low: number, high: number): number {
  const span = Math.max(1, high - low)
  const t = Math.max(0, Math.min(1, (temp - low) / span))
  return -70 + t * 140
}

/** One-glance “what it does later” line for the summary tile. */
export function weatherLaterGlance(
  hours: WeatherHourInput[],
  opts: { nowHour?: number; condition: string; tempF?: number },
): string {
  const condition = (opts.condition || "Weather").trim() || "Weather"
  if (!hours.length) return condition
  const future = opts.nowHour == null ? hours : hours.filter((h) => h.hour > opts.nowHour)
  const series = future.length > 0 ? future : hours
  const peak = series.reduce((best, h) => (h.tempF > best.tempF ? h : best))
  const last = series[series.length - 1]!
  const lastKind = weatherIconKindFromCode(last.weatherCode)
  const peakKind = weatherIconKindFromCode(peak.weatherCode)
  const peakAt = weatherHourLabel(peak.hour)
  const lastAt = weatherHourLabel(last.hour)

  if (opts.nowHour == null) {
    const first = hours[0]!
    return `${condition} · ${Math.round(first.tempF)}° morning to ${Math.round(peak.tempF)}°`
  }
  if (lastKind === "rain" && peakKind !== "rain") {
    return `${condition} · ${Math.round(peak.tempF)}° by ${peakAt}, then rain`
  }
  if (lastKind === "rain") return `${condition} · rain by ${lastAt}`
  if (opts.tempF != null && peak.tempF >= opts.tempF + 3) {
    return `${condition} · warmer ${Math.round(peak.tempF)}° by ${peakAt}`
  }
  if (opts.tempF != null && last.tempF <= opts.tempF - 4) {
    return `${condition} · cools to ${Math.round(last.tempF)}° by ${lastAt}`
  }
  return `${condition} · holds near ${Math.round(peak.tempF)}°`
}

export type WeatherTideHintInput = {
  heightFt?: number
  nextHigh?: { heightFt: number; timeCompact: string } | null
}

/** Compact next-high hint for the square (`↑ 5.1' 7:14p`). */
export function weatherTideHint(tide: WeatherTideHintInput | null | undefined): string {
  if (!tide) return ""
  if (tide.nextHigh) return `↑ ${tide.nextHigh.heightFt.toFixed(1)}' ${tide.nextHigh.timeCompact}`
  if (tide.heightFt != null) return `${tide.heightFt.toFixed(1)}' tide`
  return ""
}

export type DayLampWord = "Quiet" | "Dim" | "Warm" | "Bright" | "Full"

/** One word for the Day lamp CRT. Empty day is Quiet; both bars full is Full. */
export function dayLampWord(input: {
  habitPercent: number
  habitTotal: number
  todoPercent: number
  todoTotal: number
}): DayLampWord {
  if (input.habitTotal <= 0 && input.todoTotal <= 0) return "Quiet"
  const parts: number[] = []
  if (input.habitTotal > 0) parts.push(input.habitPercent)
  if (input.todoTotal > 0) parts.push(input.todoPercent)
  if (parts.every((part) => part >= 100)) return "Full"
  const avg = parts.reduce((sum, part) => sum + part, 0) / parts.length
  if (avg >= 60) return "Bright"
  if (avg >= 20) return "Warm"
  return "Dim"
}

export type PetPose = "asleep" | "idle" | "pleased"

/** Screen-pet pose from today's habit completion. No habits → idle, not asleep. */
export function petPose(habitPercent: number, habitTotal: number): PetPose {
  if (habitTotal <= 0) return "idle"
  if (habitPercent >= 100) return "pleased"
  if (habitPercent < 20) return "asleep"
  return "idle"
}

export type HomeNextEvent = {
  title: string
  startTime: string
  endTime?: string
  date: Date
  isAllDay?: boolean
}

export type HomeNextTodo = { title: string; footer: string }

export type HomeNextHit = { tab: "plan" | "todo"; title: string; footer: string }

function hmToMin(value: string): number {
  const [h, m] = value.split(":")
  const hh = Number(h)
  const mm = Number(m)
  if (!Number.isFinite(hh)) return 0
  return hh * 60 + (Number.isFinite(mm) ? mm : 0)
}

/**
 * Next Plan event on `now`'s calendar day, else the first open to-do.
 * When `now` is today (`clock`), events that already ended are skipped.
 */
export function pickHomeNext(input: {
  now: Date
  clock?: Date
  events: HomeNextEvent[]
  todos: HomeNextTodo[]
}): HomeNextHit | null {
  const day = formatLocalDateKey(input.now)
  const clock = input.clock ?? input.now
  const live = formatLocalDateKey(clock) === day
  const nowMin = clock.getHours() * 60 + clock.getMinutes()
  const todays = input.events
    .filter((event) => formatLocalDateKey(event.date) === day)
    .slice()
    .sort(
      (a, b) =>
        (a.startTime || "").localeCompare(b.startTime || "") || a.title.localeCompare(b.title),
    )
  const upcoming = todays.find((event) => {
    if (!live || event.isAllDay) return true
    const end = event.endTime ? hmToMin(event.endTime) : hmToMin(event.startTime) + 1
    return end > nowMin
  })
  if (upcoming) {
    return {
      tab: "plan",
      title: upcoming.title,
      footer: upcoming.isAllDay ? "All day" : upcoming.startTime,
    }
  }
  const todo = input.todos[0]
  if (!todo) return null
  return { tab: "todo", title: todo.title, footer: todo.footer }
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function isLegacyPoint(id: string): boolean {
  return (LEGACY_POINTS_WIDGET_IDS as readonly string[]).includes(id)
}

/** Persist v1 → v2 tucks Next and Day lamp. v2 → v3 folds four points wells into one. v3 → v4 tucks Solar remainder and Tracking now. v4 → v5 tucks Night well, Harvest leftover, and Inbox mill. v5 → v6 places Latest award after Points and leaves it showing. */
export function migrateHomeWidgetPersist(
  persisted: { order?: unknown; hidden?: unknown } | undefined,
  fromVersion: number,
): { order: string[]; hidden: HomeWidgetId[] } {
  let order = asIdList(persisted?.order)
  let hidden = Array.isArray(persisted?.hidden) ? asIdList(persisted.hidden) : [...DEFAULT_HOME_WIDGET_HIDDEN]

  if (fromVersion < 3 && (order.some(isLegacyPoint) || hidden.some(isLegacyPoint))) {
    const allHidden = LEGACY_POINTS_WIDGET_IDS.every((id) => hidden.includes(id))
    const first = order.findIndex(isLegacyPoint)
    const insertAt =
      first < 0 ? 0 : order.slice(0, first).filter((id) => !isLegacyPoint(id)).length
    order = order.filter((id) => !isLegacyPoint(id))
    if (!order.includes("points")) order.splice(insertAt, 0, "points")
    hidden = hidden.filter((id) => !isLegacyPoint(id))
    if (allHidden && !hidden.includes("points")) hidden.push("points")
  }

  if (fromVersion < 2) {
    for (const id of HOME_WIDGETS_TUCKED_IN_V2) {
      if (!hidden.includes(id)) hidden.push(id)
    }
  }

  if (fromVersion < 4) {
    for (const id of HOME_WIDGETS_TUCKED_IN_V4) {
      if (!hidden.includes(id)) hidden.push(id)
    }
  }

  if (fromVersion < 5) {
    for (const id of HOME_WIDGETS_TUCKED_IN_V5) {
      if (!hidden.includes(id)) hidden.push(id)
    }
  }

  if (fromVersion < 6 && !order.includes("award")) {
    const at = order.indexOf("points")
    order.splice(at < 0 ? order.length : at + 1, 0, "award")
  }

  return { order, hidden: sanitizeHomeWidgetHidden(hidden) }
}

export function daysUntilCount(target: string, from: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const targetDate = new Date(year, month - 1, day)
  if (targetDate.getFullYear() !== year || targetDate.getMonth() !== month - 1 || targetDate.getDate() !== day) {
    return null
  }
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((targetDate.getTime() - start.getTime()) / 86_400_000)
}

/** CRT number plus the footer phrase. Empty date asks to be set. */
export function daysUntilFace(count: number | null, label: string): { crt: string; footer: string } {
  const name = label.trim() || "that day"
  if (count == null) return { crt: "—", footer: "Set a date" }
  if (count > 0) return { crt: String(count), footer: `Days Until ${name}` }
  if (count === 0) return { crt: "0", footer: `${name} is today` }
  return { crt: String(Math.abs(count)), footer: `Days since ${name}` }
}
