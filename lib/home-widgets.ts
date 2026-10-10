/**
 * lib/home-widgets.ts — Home overview strip catalog
 *
 * Square modules on the Home header (every sub-tab). Persist v9 appends
 * Already flowing and Plan and lived and leaves them hidden. Persist v8 adds
 * `widgetsFollowClock` (default off: squares stay on the day you are viewing).
 * Persist v7 shows Moon after Days Until. Persist v6 shows Latest award.
 * Persist v5 tucks Night well, Harvest leftover, and Inbox mill.
 * Persist lives in `home-widgets-store.ts`. Gradient stops are the three Habits hues —
 * Percent LED, Week grade tube, Perfect output tube — read-only.
 * `weatherIconKind` maps Open-Meteo copy to sun / cloud / rain glyphs.
 * Glance + tide hint for the square; hourly strip / sparkline / analog
 * needle feed the click-open instrument. Widget city/beach persist is
 * `cogs-home-weather` (`lib/home-weather-store.ts`).
 *
 * `HOME_WIDGET_CATALOG` records the readings in `docs/widget-improvement/plan/`.
 * The sample caption is `HOME_WIDGET_LABEL` (Weather keeps an example city;
 * the pet keeps an example time). A square the user hid stays hidden. The
 * milled face and phosphor green stay. Overview type is already being made
 * slightly larger; a long plate may tighten tracking so the name fits, and
 * this catalog does not schedule another size change.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import type { DaysUntilFormat, DaysUntilMode } from "@/lib/home-days-until-store"
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

/** Catalog id set (stable for migrate append). Fresh strip order is `DEFAULT_HOME_WIDGET_ORDER`. */
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
  "moon",
  "solar",
  "tracking",
  "night",
  "harvest",
  "inbox",
  "flow",
  "paint",
] as const

/** Points wells that used to be four tiles. Folded into `points` in persist v3. */
export const LEGACY_POINTS_WIDGET_IDS = ["alltime", "today", "week", "month"] as const

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number]

export const HOME_WIDGET_LABEL: Record<HomeWidgetId, string> = {
  review: "Rituals",
  points: "Points",
  award: "Latest award",
  progress: "Today's Progress",
  affirmation: "Affirmation",
  weather: "Weather",
  pet: "Screen pet",
  next: "Next",
  daylamp: "Day lamp",
  daysuntil: "Days Until",
  moon: "Moon",
  solar: "Solar remainder",
  tracking: "Tracking now",
  night: "Night well",
  harvest: "Harvest leftover",
  inbox: "Inbox mill",
  flow: "Already flowing",
  paint: "Plan and lived",
}

/**
 * Fresh-install reading order: Progress + Rituals lead; Moon / Days Until sit
 * quieter later. Existing vaults keep their stored order.
 */
export const DEFAULT_HOME_WIDGET_ORDER: HomeWidgetId[] = [
  "progress",
  "review",
  "points",
  "award",
  "pet",
  "affirmation",
  "weather",
  "next",
  "daylamp",
  "harvest",
  "inbox",
  "flow",
  "paint",
  "tracking",
  "night",
  "solar",
  "moon",
  "daysuntil",
]

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
  "flow",
  "paint",
]

/** Optional tiles introduced in persist version 2 — tuck them on older blobs. */
export const HOME_WIDGETS_TUCKED_IN_V2: HomeWidgetId[] = ["next", "daylamp"]

/** Optional tiles introduced in persist version 4. */
export const HOME_WIDGETS_TUCKED_IN_V4: HomeWidgetId[] = ["solar", "tracking"]

/** Optional tiles introduced in persist version 5. */
export const HOME_WIDGETS_TUCKED_IN_V5: HomeWidgetId[] = ["night", "harvest", "inbox"]

/** Optional tiles introduced in persist version 9. Left hidden so the strip does not move. */
export const HOME_WIDGETS_TUCKED_IN_V9: HomeWidgetId[] = ["flow", "paint"]

/**
 * One catalog card: what the square is for, the reading it should tell, and a
 * static example of that face. Score tiles share one today: habits split into
 * done, miss, and blank; the to-do fraction; points split into habit pay,
 * bonuses, and the rest; habit points still unpaid. A mixed day is not finished.
 */
export type HomeWidgetBlurb = {
  id: HomeWidgetId
  name: string
  shows: string
  useful: string
  preview: { caption: string; crt: string; footer: string }
}

export const HOME_WIDGET_CATALOG: HomeWidgetBlurb[] = [
  {
    id: "review",
    name: "Rituals",
    shows: "The CRT counts rites due for this day: today's morning and today's night, not the older backlog. The footer names the next of those and its state. Open resumes that rite. A clear day stays on the strip at 0, so an empty reading is not a hidden square. Dismiss hides the square until the next session and does not change this catalog.",
    useful: "Keep it showing when you want today's due rite to meet you on every Home tab.",
    preview: { caption: "Rituals", crt: "2", footer: "Morning · in progress" },
  },
  {
    id: "points",
    name: "Points",
    shows: "Four CRT lines: all time, today, this week, this month. Today's footer splits that sum into habit pay, bonuses, and everything else. The today meter is habit points paid over the habit ceiling, the same reading as Harvest and Progress. A mixed habit day does not fill the meter. Click opens the wells and the sparklines.",
    useful: "The day's score, split, so a mixed habit day does not look finished.",
    preview: { caption: "Points", crt: "42", footer: "30 habits · 12 bonuses" },
  },
  {
    id: "award",
    name: "Latest award",
    shows: "A habit completion or a bonus on this day, the larger one in the CRT and why in the footer. A later inbox +1 does not take the face when a +50 is already on that day. Click lists recent awards under that split.",
    useful: "The last real payment on this day, not the latest inbox handle.",
    preview: { caption: "Latest award", crt: "+50", footer: "Higher habit grades" },
  },
  {
    id: "progress",
    name: "Today's Progress",
    shows: "Habits for this day, split into done, miss, and blank, and the to-do fraction. The habit line is those three piles, not one leftover. The footer keeps both fractions. A miss is not a blank, and a mixed day is not finished. Click lists what is still open. Each list folds.",
    useful: "Done, miss, and blank for the day the squares are reading.",
    preview: { caption: "Today's Progress", crt: "2 done · 1 miss", footer: "1 blank · to do 1/4" },
  },
  {
    id: "affirmation",
    name: "Affirmation",
    shows: "Today's line from the Affirmations list, the sentence this date already picks, or a built-in line when that list is empty. The footer is its place in the pool. The handheld repeats the line, the place, and the date.",
    useful: "A sentence already on the list, and which one it is.",
    preview: { caption: "Affirmation", crt: "I follow through.", footer: "9 of 57" },
  },
  {
    id: "weather",
    name: "Weather",
    shows: "City in the caption, temperature and a sun, cloud, or rain glyph in the CRT, and a glance at the next change still ahead. A high that has already passed is not the glance. Click opens the city, beach, week, and tide instrument.",
    useful: "When the sky still ahead should sit next to the day you planned.",
    preview: { caption: "San Diego", crt: "72°", footer: "Clear · rain Saturday" },
  },
  {
    id: "pet",
    name: "Screen pet",
    shows: "A pixel creature, a clock, and the day's habit progress: done, miss, and blank. At night, a sheet that is underway keeps that progress on the face. Asleep is for under 20% or a blank sheet. Pleased stays a finished sheet, including at night.",
    useful: "The day's habit progress, including at night. It is not today's friend.",
    preview: { caption: "11:14p", crt: "7/28", footer: "1 miss · 20 blank" },
  },
  {
    id: "next",
    name: "Next",
    shows: "The next timed thing still ahead: a Plan event or a planned action, including one on a later day. An all-day event says All day and the date. An untimed row, including an inbox cue, is not the hit. Click opens that hit and can jump to Plan or To Do.",
    useful: "When you want the next timed thing, not an untimed cue.",
    preview: { caption: "Next", crt: "Evening", footer: "18:00" },
  },
  {
    id: "daylamp",
    name: "Day lamp",
    shows: "One word — Quiet, Dim, Warm, Bright, or Full — from today's habit and to-do bars, the same reading as Progress. When both bars exist, the word follows the lower one. Full means every present bar is finished. Quiet means nothing was scheduled. A cleared to-do list does not call a partly done habit sheet Bright.",
    useful: "A single brightness. The lower bar keeps a mixed day from reading finished.",
    preview: { caption: "Day lamp", crt: "Warm", footer: "habits 1/4 · to do 3/3" },
  },
  {
    id: "daysuntil",
    name: "Days Until",
    shows: "As many countdown-to or count-up-from tiles as you add. Each CRT is a live count in units or as a decimal. Attach a Plan event, and optionally keep that mark as an all-day day on the scheduler. A date with no clock starts at local midnight. Set the mode, date, optional time, and format in the detail.",
    useful: "Dates you do not want to do math for — ahead or behind, each on its own square.",
    preview: { caption: "Days Until", crt: "01 day 3 hours", footer: "Until Launch" },
  },
  {
    id: "moon",
    name: "Moon",
    shows: "An 8-bit moon for the widget day, and one phase voice. The name uses the same local day as the countdown, so the glass does not call the phase new while the footer still counts toward it. On the local day of the new moon the name and the footer agree. Detail adds illumination and a sky chart.",
    useful: "When the month's light should be one voice, the name and the countdown together.",
    preview: { caption: "Moon", crt: "Waning crescent", footer: "1 day until new moon" },
  },
  {
    id: "solar",
    name: "Solar remainder",
    shows: "Time left in the sun's day for the pinned city. Before sunset the CRT counts down to today's sunset and the footer is that clock. After sunset the CRT counts forward to the next sunrise and the footer is that clock. It is not minutes already past sunset.",
    useful: "The sun's remainder. After sunset it counts toward the next sunrise.",
    preview: { caption: "Solar remainder", crt: "7h 40m", footer: "6:50 AM" },
  },
  {
    id: "tracking",
    name: "Tracking now",
    shows: "The current Activity, Location, Mood, and Company, or the last ones you painted. The footer is the age of that last stamp: the clock it was last true, and how long the grid has been open since. Update stamps up to now and does not paint through midnight.",
    useful: "The grid's last stamp, and how old it is.",
    preview: { caption: "Tracking now", crt: "Work", footer: "9:55p · 1h open" },
  },
  {
    id: "night",
    name: "Night well",
    shows: "When this morning has a night, its hours are in the CRT. When tonight and the morning before are blank, the face is the last real night, an all-nighter or a duration, and the footer names that morning. It does not say no night was logged.",
    useful: "The last real night, including when tonight is still blank.",
    preview: { caption: "Night well", crt: "5h 59m", footer: "Oct 4 · last real night" },
  },
  {
    id: "harvest",
    name: "Harvest leftover",
    shows: "Habit points still unpaid today, from the same reading as Points. The CRT is that remainder. The footer is how many are left of the habit ceiling. A to-do reward is not this number.",
    useful: "Habit points still unpaid, not the score you already have.",
    preview: { caption: "Harvest leftover", crt: "18", footer: "18 left of 40" },
  },
  {
    id: "inbox",
    name: "Inbox mill",
    shows: "How many revisit-Inbox ideas are waiting. The footer is the newest title and the age of the oldest. The handheld is that count, how many titles are bare, and that oldest age. It is not a second list of the pile. Monkey brain is not in this count. Click can open Inbox.",
    useful: "The pile's size, its newest capture, how many titles are bare, and how old the oldest one is.",
    preview: { caption: "Inbox mill", crt: "4", footer: "Call the dentist · 6d" },
  },
  {
    id: "flow",
    name: "Already flowing",
    shows: "One word for finished work on the shared today. Daily habits you completed, and to-dos you finished that were already on the books, count as already in motion. A to-do you created and finished the same day counts as new. A generated Done row, a habit mirror or a tracking copy, does not. Quiet means nothing was finished.",
    useful: "Whether finished work was already on the books. Generated Done rows are not new.",
    preview: { caption: "Already flowing", crt: "Flowing", footer: "3 already · 1 new" },
  },
  {
    id: "paint",
    name: "Plan and lived",
    shows: "Prospective forward plan against retrospective waking paint. Plan is scheduled minutes still ahead, not duration copied onto done rows. Lived is painted minutes, each minute once, with sleep left out. Open means neither side has anything.",
    useful: "Prospective minutes and retrospective waking paint, in the same square.",
    preview: { caption: "Plan and lived", crt: "Short", footer: "plan 5h · lived 3h" },
  },
]

export function homeWidgetBlurb(id: HomeWidgetId): HomeWidgetBlurb {
  const found = HOME_WIDGET_CATALOG.find((entry) => entry.id === id)
  if (!found) throw new Error(`Missing widget catalog entry: ${id}`)
  return found
}

/** Latest award joins the strip in persist version 6. It stays visible. */

/** Moon joins the strip in persist version 7, after Days Until. It stays visible. */

/** Persist v8. Off keeps overview squares on the day being viewed. */

/**
 * Date the overview strip should read. Off (the default) is the selected day.
 * On is the wall clock, so a browsed day does not move the squares.
 */
export function homeWidgetDate(selected: Date, now: Date, followClock: boolean): Date {
  return followClock ? now : selected
}

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

/** Screen-pet pose from today's habit completion and the hour.
 * No habits → idle by day, asleep at night. Pleased wins over night. */
export function petPose(habitPercent: number, habitTotal: number, hour?: number): PetPose {
  const night = hour != null && (hour < 6 || hour >= 22)
  if (habitTotal <= 0) return night ? "asleep" : "idle"
  if (habitPercent >= 100) return "pleased"
  if (habitPercent < 20 || night) return "asleep"
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

/** Persist v1 → v2 tucks Next and Day lamp. v2 → v3 folds four points wells into one. v3 → v4 tucks Solar remainder and Tracking now. v4 → v5 tucks Night well, Harvest leftover, and Inbox mill. v5 → v6 places Latest award after Points and leaves it showing. v6 → v7 places Moon after Days Until and leaves it showing. v7 → v8 leaves widgets on the selected day (`widgetsFollowClock` false). v8 → v9 appends Already flowing and Plan and lived and leaves them hidden. */
export function migrateHomeWidgetPersist(
  persisted: { order?: unknown; hidden?: unknown; widgetsFollowClock?: unknown } | undefined,
  fromVersion: number,
): { order: string[]; hidden: HomeWidgetId[]; widgetsFollowClock: boolean } {
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

  if (fromVersion < 7 && !order.includes("moon")) {
    const at = order.indexOf("daysuntil")
    order.splice(at < 0 ? order.length : at + 1, 0, "moon")
  }

  if (fromVersion < 9) {
    for (const id of HOME_WIDGETS_TUCKED_IN_V9) {
      if (!order.includes(id)) order.push(id)
      if (!hidden.includes(id)) hidden.push(id)
    }
  }

  return {
    order,
    hidden: sanitizeHomeWidgetHidden(hidden),
    widgetsFollowClock: fromVersion >= 8 && persisted?.widgetsFollowClock === true,
  }
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

const MS_PER_MIN = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/** Local instant for the countdown. No time → start of that local day. */
export function daysUntilTargetDate(date: string, time = ""): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  let hours = 0
  let minutes = 0
  const clock = /^(\d{2}):(\d{2})$/.exec(time.trim())
  if (clock) {
    hours = Number(clock[1])
    minutes = Number(clock[2])
    if (hours > 23 || minutes > 59) return null
  }
  const target = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (
    target.getFullYear() !== year ||
    target.getMonth() !== month - 1 ||
    target.getDate() !== day
  ) {
    return null
  }
  return target
}

/** Signed ms until the target (positive = future). Null when the date is unset/invalid. */
export function daysUntilRemainingMs(date: string, time: string, now: Date): number | null {
  const target = daysUntilTargetDate(date, time)
  if (!target) return null
  return target.getTime() - now.getTime()
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0")
}

/** Trim trailing zeros but keep a meaningful tenth (`1.5`, not `1.50` or `1`). */
export function formatCountdownDecimal(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (!Number.isFinite(rounded)) return "0"
  const fixed = rounded.toFixed(2)
  return fixed.replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}

function unitWord(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/**
 * Live CRT + footer for a Days Until tile.
 * Unit: `01 day 3 hours` (≥1d) or `03 hours 30 min` (<1d).
 * Decimal: `1.25 days` (≥1d) or `3.5 hours` (<1d). Never shows `0 days`.
 * `countdown` stays on the mark ahead (and says passed once it is gone).
 * `countup` stays on time since (and says ahead before the mark).
 * Omit `mode` for the old auto face: Until while ahead, Since once past.
 */
export function daysUntilLiveFace(input: {
  remainingMs: number | null
  label: string
  format: DaysUntilFormat
  hasTime: boolean
  mode?: DaysUntilMode
}): { crt: string; footer: string } {
  const name = input.label.trim() || "that day"
  if (input.remainingMs == null) return { crt: "—", footer: "Set a date" }

  const ms = input.remainingMs
  const mode = input.mode ?? "auto"

  if (mode === "countdown") {
    if (ms <= 0) {
      if (!input.hasTime && ms > -MS_PER_DAY) {
        return { crt: "0", footer: `${name} is today` }
      }
      if (Math.abs(ms) < MS_PER_MIN) return { crt: "now", footer: name }
      return { crt: "0", footer: `${name} passed` }
    }
    return { crt: formatCountdownSpan(ms, input.format), footer: `Until ${name}` }
  }

  if (mode === "countup") {
    if (ms > 0) {
      return { crt: "0", footer: `${name} ahead` }
    }
    if (!input.hasTime && ms > -MS_PER_DAY) {
      return { crt: "0", footer: `${name} is today` }
    }
    if (Math.abs(ms) < MS_PER_MIN) return { crt: "now", footer: name }
    return {
      crt: formatCountdownSpan(Math.abs(ms), input.format),
      footer: `Since ${name}`,
    }
  }

  if (ms <= 0) {
    if (!input.hasTime && ms > -MS_PER_DAY) {
      return { crt: "0", footer: `${name} is today` }
    }
    if (Math.abs(ms) < MS_PER_MIN) {
      return { crt: "now", footer: name }
    }
    const elapsed = Math.abs(ms)
    return {
      crt: formatCountdownSpan(elapsed, input.format),
      footer: `Since ${name}`,
    }
  }

  return {
    crt: formatCountdownSpan(ms, input.format),
    footer: `Until ${name}`,
  }
}

/** Plate label for a countdown or count-up tile. */
export function daysUntilCaption(mode: DaysUntilMode, remainingMs?: number | null): string {
  if (mode === "countup") return "Days Since"
  if (mode === "countdown") return "Days Until"
  if (remainingMs != null && remainingMs <= 0) return "Days Since"
  return "Days Until"
}

export function formatCountdownSpan(ms: number, format: DaysUntilFormat): string {
  const total = Math.max(0, ms)
  if (format === "decimal") {
    if (total >= MS_PER_DAY) {
      const days = total / MS_PER_DAY
      const text = formatCountdownDecimal(days)
      return `${text} ${parseFloat(text) === 1 ? "day" : "days"}`
    }
    const hours = total / MS_PER_HOUR
    const text = formatCountdownDecimal(Math.max(hours, 0.1))
    return `${text} ${parseFloat(text) === 1 ? "hour" : "hours"}`
  }

  if (total >= MS_PER_DAY) {
    const days = Math.floor(total / MS_PER_DAY)
    const hours = Math.floor((total % MS_PER_DAY) / MS_PER_HOUR)
    return `${pad2(days)} ${unitWord(days, "day", "days")} ${hours} ${unitWord(hours, "hour", "hours")}`
  }

  const hours = Math.floor(total / MS_PER_HOUR)
  const mins = Math.floor((total % MS_PER_HOUR) / MS_PER_MIN)
  return `${pad2(hours)} ${unitWord(hours, "hour", "hours")} ${pad2(mins)} min`
}
