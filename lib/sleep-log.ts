/**
 * lib/sleep-log.ts — What time you fell asleep, what time you woke up
 *
 * ## Why a night is keyed by the morning
 *
 * A night straddles midnight, so "which day does it belong to" has no obvious
 * answer — and picking the wrong one produces a model that fights itself. This
 * module names a night after **the morning you wake into**: the night keyed
 * `2026-09-17` is the one that ended on the 17th.
 *
 * Both ends are then stored as **signed minutes from midnight of that morning**:
 *
 * ```
 *   fell asleep 11:30 PM on the 16th → sleptMin = -30
 *   fell asleep 12:45 AM on the 17th → sleptMin =  45
 *   woke        7:00 AM on the 17th → wokeMin  = 420
 * ```
 *
 * One signed number per end, one date per night. Everything that is awkward
 * about sleep data falls out of this for free:
 *
 * - **Duration** is always `wokeMin - sleptMin`. No midnight branch, no second
 *   date to keep in step, no timezone arithmetic.
 * - **Averages are linear.** Bedtimes cluster around midnight, where a naive mean
 *   of wall-clock times gives nonsense (23:50 and 00:10 average to noon). Because
 *   bedtimes here are already expressed relative to their own morning, -10 and
 *   +10 average to 0 — midnight — with plain arithmetic. No circular statistics.
 * - **A night is one record**, so editing either end can never orphan the other.
 *
 * Splitting a night back into calendar days (for the Tracking grid, which stores
 * minutes past local midnight per date) is `sleepIntervals` — the only place the
 * two-day nature of a night surfaces at all.
 *
 * The Tracking strip types clocks **on the day on screen**. `placeAsleepOnDay`
 * puts a pre-noon time on this morning's night and an evening time on the *next*
 * morning as a negative offset, so Thursday 1 AM–9 AM and Thursday 10 PM (waiting
 * on Friday's wake) are two records. Morning Review still uses `parseBedtime`
 * (noon pivot) against the morning you woke into — that ritual is "last night".
 *
 * Each end carries its own `precision`, reusing the vocabulary already on
 * `HabitTimeEstimate.precision` in `lib/types.ts`: a remembered bedtime is
 * `"estimated"`, a glanced-at clock is `"definite"`. Analytics reports how much
 * of a stretch was guessed so a trend is never read as firmer than its evidence.
 *
 * Pure: no stores, no `Date.now()` outside explicit arguments.
 */

/** Mirrors `HabitTimeEstimate.precision` — the app's existing word for this. */
export type SleepPrecision = "estimated" | "definite"

/**
 * Where a night's times came from. The store only ever holds `"logged"` (or
 * nothing, which means the same); the others are produced on read by
 * `lib/sleep-inference.ts` when the grid has to fill a gap the user left.
 */
export type SleepSource = "logged" | "tracked" | "mixed"

export interface SleepNight {
  /** Local `YYYY-MM-DD` of the **morning**. The night's identity. */
  date: string
  /** Signed minutes from midnight of `date`; negative is the evening before. */
  sleptMin?: number
  /** Minutes past midnight of `date`, 0–1439. */
  wokeMin?: number
  sleptPrecision?: SleepPrecision
  wokePrecision?: SleepPrecision
  note?: string
  /** ISO timestamp of the last edit, for "recorded 3 days later" honesty. */
  updatedAt?: string
  /** Unset in storage; set on nights reconstructed from painted Tracking time. */
  source?: SleepSource
  /** User marked this morning as an all-nighter (no sleep). */
  allNighter?: boolean
  /** When the all-nighter was recorded (ISO). */
  allNighterAt?: string
  /**
   * Where the all-nighter was marked. `"telegram"` / `"text"` = text pipeline
   * (BIM / Simulate); `"desktop"` = Morning Review UI.
   */
  allNighterSource?: "telegram" | "desktop" | "text"
}

/**
 * The tag that means "this time was sleep", wherever it is painted.
 *
 * Lives here rather than with the sync so pure modules can read it without
 * pulling in the stores.
 */
export const SLEEP_TAG_ID = "tag-sleep"

export const MINUTES_PER_DAY = 1440
/** Earlier than this before midnight and it is the previous *afternoon*, not a bedtime. */
export const EARLIEST_BEDTIME = -MINUTES_PER_DAY / 2
/** A night longer than this is a typo, not a lie-in. */
export const MAX_SLEEP_MINUTES = 20 * 60
export const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60

/**
 * Read a bedtime off an `<input type="time">` into a signed offset.
 *
 * Noon is the pivot: a bedtime at or after 12:00 belongs to the evening before
 * (11:30 PM → -30), one before noon to the small hours of the morning itself
 * (12:45 AM → 45). That covers every human sleep schedule that calls the result
 * "last night" without asking the user which day they meant.
 */
export function parseBedtime(clock: string): number | undefined {
  const minutes = parseClock(clock)
  if (minutes === undefined) return undefined
  return minutes >= MINUTES_PER_DAY / 2 ? minutes - MINUTES_PER_DAY : minutes
}

/** Read a wake time; always a minute of the morning itself. */
export function parseWakeTime(clock: string): number | undefined {
  return parseClock(clock)
}

function parseClock(clock: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(mins)) return undefined
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return undefined
  return hours * 60 + mins
}

/** A signed offset back to `HH:MM` for an `<input type="time">`. */
export function offsetToClock(offset: number): string {
  const wrapped = ((Math.round(offset) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`
}

/** "11:30 PM" — for reading, not for inputs. */
export function offsetToLabel(offset: number): string {
  const wrapped = ((Math.round(offset) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours24 = Math.floor(wrapped / 60)
  const mins = wrapped % 60
  const suffix = hours24 >= 12 ? "PM" : "AM"
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`
}

export function formatSleepDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))
  const hours = Math.floor(whole / 60)
  const mins = whole % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function hasBothEnds(night: SleepNight | undefined): boolean {
  return night?.sleptMin !== undefined && night?.wokeMin !== undefined
}

/**
 * How long the night was, or `null` when it is incomplete or impossible.
 * A non-positive or absurdly long span means the two ends contradict each other,
 * and silently returning a number would launder that into a statistic.
 */
export function sleepMinutes(night: SleepNight | undefined): number | null {
  if (!night || night.sleptMin === undefined || night.wokeMin === undefined) return null
  const span = night.wokeMin - night.sleptMin
  if (span <= 0 || span > MAX_SLEEP_MINUTES) return null
  return span
}

/** Why a night with both ends filled in still has no duration. */
export function nightProblem(night: SleepNight | undefined): string | null {
  if (!night || night.sleptMin === undefined || night.wokeMin === undefined) return null
  const span = night.wokeMin - night.sleptMin
  if (span <= 0) return "Woke up before falling asleep — check which end is which."
  if (span > MAX_SLEEP_MINUTES) return `That is over ${Math.floor(MAX_SLEEP_MINUTES / 60)} hours; check the times.`
  return null
}

/** `true` when either end was only remembered rather than observed. */
export function isNightEstimated(night: SleepNight | undefined): boolean {
  if (!night) return false
  return (night.sleptPrecision ?? "estimated") === "estimated" || (night.wokePrecision ?? "estimated") === "estimated"
}

export interface SleepInterval {
  /** Local date key the minutes belong to. */
  date: string
  /** Minutes past midnight of `date`, exclusive end. */
  startMin: number
  endMin: number
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const shifted = new Date(y, (m ?? 1) - 1, (d ?? 1) + days)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(
    shifted.getDate(),
  ).padStart(2, "0")}`
}

export function previousDateKey(dateKey: string): string {
  return shiftDateKey(dateKey, -1)
}

export function nextDateKey(dateKey: string): string {
  return shiftDateKey(dateKey, 1)
}

/**
 * The night as calendar-day intervals, which is the shape the Tracking grid
 * stores. A night that crosses midnight becomes two: the tail of the evening
 * before and the head of the morning.
 */
export function sleepIntervals(night: SleepNight | undefined): SleepInterval[] {
  const minutes = sleepMinutes(night)
  if (!night || minutes === null) return []
  const { sleptMin, wokeMin } = night as { sleptMin: number; wokeMin: number }

  if (sleptMin >= 0) {
    // Fell asleep after midnight: the whole night sits on the morning's date.
    return [{ date: night.date, startMin: sleptMin, endMin: wokeMin }]
  }

  const intervals: SleepInterval[] = [
    { date: previousDateKey(night.date), startMin: MINUTES_PER_DAY + sleptMin, endMin: MINUTES_PER_DAY },
  ]
  if (wokeMin > 0) intervals.push({ date: night.date, startMin: 0, endMin: wokeMin })
  return intervals
}

/**
 * Wall-clock minutes (0–1439) on the day the user is looking at → the night
 * record that bedtime belongs to.
 *
 * Times apply to **that calendar day**. Before noon is the morning of `viewDate`
 * (1 AM Thursday → Thursday's night). From noon on is tonight, stored on the
 * *next* morning as a negative offset (10 PM Thursday → Friday's night at -120),
 * so an unpaired evening bedtime waits for the next day's wake.
 */
export function placeAsleepOnDay(viewDate: string, clockMin: number): { date: string; sleptMin: number } {
  if (clockMin >= MINUTES_PER_DAY / 2) {
    return { date: nextDateKey(viewDate), sleptMin: clockMin - MINUTES_PER_DAY }
  }
  return { date: viewDate, sleptMin: clockMin }
}

/** A wake time always belongs to the morning of the day it was typed on. */
export function placeAwakeOnDay(viewDate: string, clockMin: number): { date: string; wokeMin: number } {
  return { date: viewDate, wokeMin: clockMin }
}

export interface DaySleepRow {
  /** Morning date of the underlying `SleepNight`. */
  nightDate: string
  /** Stretch that ended this morning, vs tonight's start waiting on tomorrow. */
  side: "ended-this-morning" | "starts-this-evening"
  /** Wall-clock on `viewDate`, when that end was typed on this day. */
  asleepClock?: number
  awakeClock?: number
  /** The other end lives on a neighbouring day (overnight pairing). */
  asleepElsewhere?: { date: string; clock: number }
  awakeElsewhere?: { date: string; clock: number }
}

/**
 * Sleep ends that belong on `viewDate`'s clock, plus the overnight half that
 * started last evening or continues tomorrow.
 *
 * Thursday 1 AM–9 AM is `nights[Thu]` shown as a morning row. Thursday 10 PM
 * is `nights[Fri].sleptMin < 0` shown as an evening row on Thursday, pairing
 * with Friday's 5 AM wake — two complete stretches, two records, no collision.
 */
export function sleepRowsForDay(nights: Record<string, SleepNight>, viewDate: string): DaySleepRow[] {
  const rows: DaySleepRow[] = []
  const morning = nights[viewDate]
  if (morning && (morning.sleptMin !== undefined || morning.wokeMin !== undefined)) {
    const asleepHere = morning.sleptMin !== undefined && morning.sleptMin >= 0
    rows.push({
      nightDate: viewDate,
      side: "ended-this-morning",
      asleepClock: asleepHere ? morning.sleptMin : undefined,
      awakeClock: morning.wokeMin,
      asleepElsewhere:
        morning.sleptMin !== undefined && morning.sleptMin < 0
          ? { date: previousDateKey(viewDate), clock: morning.sleptMin + MINUTES_PER_DAY }
          : undefined,
    })
  }

  const next = nextDateKey(viewDate)
  const tonight = nights[next]
  if (tonight?.sleptMin !== undefined && tonight.sleptMin < 0) {
    rows.push({
      nightDate: next,
      side: "starts-this-evening",
      asleepClock: tonight.sleptMin + MINUTES_PER_DAY,
      awakeElsewhere: tonight.wokeMin !== undefined ? { date: next, clock: tonight.wokeMin } : undefined,
    })
  }
  return rows
}

export function weekdayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { weekday: "short" })
}

/** Every date key a night writes minutes onto. */
export function nightDateKeys(night: SleepNight): string[] {
  const keys = new Set(sleepIntervals(night).map((i) => i.date))
  keys.add(night.date)
  return [...keys]
}

// ---- analysis ---------------------------------------------------------------

export interface SleepNightStat {
  date: string
  minutes: number
  sleptMin: number
  wokeMin: number
  estimated: boolean
  /** Where the times came from — a night read off the grid is marked `tracked`. */
  source: SleepSource
}

export interface SleepStats {
  /** Nights with a usable duration. */
  nights: SleepNightStat[]
  /** Nights in the range that were left blank or contradictory. */
  missing: number
  averageMinutes: number
  medianMinutes: number
  /** Mean bedtime as a signed offset; negative is before midnight. */
  averageBedtime: number
  averageWake: number
  /** Standard deviation in minutes — lower is a more regular schedule. */
  bedtimeVariation: number
  wakeVariation: number
  shortest?: SleepNightStat
  longest?: SleepNightStat
  /** The night with the earliest bedtime in the range, and the latest. */
  earliestBedtime?: SleepNightStat
  latestBedtime?: SleepNightStat
  earliestWake?: SleepNightStat
  latestWake?: SleepNightStat
  /** Minutes below target, summed over nights that fell short. */
  debtMinutes: number
  /** Nights that met or beat the target. */
  nightsAtTarget: number
  /** Share of counted nights with at least one remembered end, 0–1. */
  estimatedShare: number
  /** Counted nights whose times were read off the Tracking grid, not stated. */
  fromTracking: number
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Roll a set of nights up over `dateKeys` (morning dates, oldest first).
 *
 * Because bedtimes are signed offsets from their own morning, the mean and
 * standard deviation below are ordinary arithmetic — see the module header for
 * why that would otherwise need circular statistics.
 */
export function sleepStats(
  nightsByDate: Record<string, SleepNight>,
  dateKeys: string[],
  targetMinutes = DEFAULT_SLEEP_TARGET_MINUTES,
): SleepStats {
  const nights: SleepNightStat[] = []
  let missing = 0

  for (const key of dateKeys) {
    const night = nightsByDate[key]
    const minutes = sleepMinutes(night)
    if (!night || minutes === null) {
      missing++
      continue
    }
    nights.push({
      date: key,
      minutes,
      sleptMin: night.sleptMin as number,
      wokeMin: night.wokeMin as number,
      estimated: isNightEstimated(night),
      source: night.source ?? "logged",
    })
  }

  const durations = nights.map((n) => n.minutes)
  const bedtimes = nights.map((n) => n.sleptMin)
  const wakes = nights.map((n) => n.wokeMin)

  return {
    nights,
    missing,
    averageMinutes: mean(durations),
    medianMinutes: median(durations),
    averageBedtime: mean(bedtimes),
    averageWake: mean(wakes),
    bedtimeVariation: stdDev(bedtimes),
    wakeVariation: stdDev(wakes),
    shortest: pick(nights, (n) => n.minutes, "min"),
    longest: pick(nights, (n) => n.minutes, "max"),
    // Bedtimes are signed offsets, so "earliest" is just the smallest number:
    // 10 PM (-120) sorts before 1 AM (+60) with no wrap-around special case.
    earliestBedtime: pick(nights, (n) => n.sleptMin, "min"),
    latestBedtime: pick(nights, (n) => n.sleptMin, "max"),
    earliestWake: pick(nights, (n) => n.wokeMin, "min"),
    latestWake: pick(nights, (n) => n.wokeMin, "max"),
    debtMinutes: durations.reduce((sum, m) => sum + Math.max(0, targetMinutes - m), 0),
    nightsAtTarget: durations.filter((m) => m >= targetMinutes).length,
    estimatedShare: nights.length ? nights.filter((n) => n.estimated).length / nights.length : 0,
    fromTracking: nights.filter((n) => n.source !== "logged").length,
  }
}

function pick(
  nights: SleepNightStat[],
  of: (night: SleepNightStat) => number,
  end: "min" | "max",
): SleepNightStat | undefined {
  return nights.reduce<SleepNightStat | undefined>((best, night) => {
    if (!best) return night
    return (end === "min" ? of(night) < of(best) : of(night) > of(best)) ? night : best
  }, undefined)
}

export interface SleepTrend {
  /** Change in average nightly minutes, later half minus earlier half. */
  durationDelta: number
  /** Change in average bedtime; positive means going to bed later. */
  bedtimeDelta: number
  /** Change in average wake time; positive means waking later. */
  wakeDelta: number
  /** False when either half has too few nights to compare honestly. */
  comparable: boolean
}

/**
 * Split the range down the middle and compare the halves. Two nights per half is
 * the floor — below that a "trend" is one bad night wearing a hat.
 */
export function sleepTrend(
  nightsByDate: Record<string, SleepNight>,
  dateKeys: string[],
): SleepTrend {
  const half = Math.floor(dateKeys.length / 2)
  const earlier = sleepStats(nightsByDate, dateKeys.slice(0, half))
  const later = sleepStats(nightsByDate, dateKeys.slice(half))
  const comparable = earlier.nights.length >= 2 && later.nights.length >= 2
  return {
    comparable,
    durationDelta: comparable ? later.averageMinutes - earlier.averageMinutes : 0,
    bedtimeDelta: comparable ? later.averageBedtime - earlier.averageBedtime : 0,
    wakeDelta: comparable ? later.averageWake - earlier.averageWake : 0,
  }
}

export interface TypicalSleepWindow {
  /** Median bedtime as a signed offset from midnight. */
  bedtime: number
  /** Median wake time, minutes past midnight. */
  wake: number
  /** How many nights the pair was drawn from. */
  nights: number
}

/**
 * When the user normally sleeps, for filling in blanks elsewhere in the app.
 *
 * The **median** rather than the mean, because this is used as a stand-in for a
 * specific unknown night: one all-nighter should not move the assumption the app
 * makes about every other evening. `minNights` is a floor on saying anything at
 * all — two nights is a coincidence, not a routine.
 */
export function typicalSleepWindow(
  nightsByDate: Record<string, SleepNight>,
  dateKeys: string[],
  minNights = 3,
): TypicalSleepWindow | undefined {
  const { nights } = sleepStats(nightsByDate, dateKeys)
  if (nights.length < minNights) return undefined
  return {
    bedtime: median(nights.map((n) => n.sleptMin)),
    wake: median(nights.map((n) => n.wokeMin)),
    nights: nights.length,
  }
}

/** "1h 5m earlier" / "20m later" / "about the same" for a signed minute delta. */
export function describeShift(deltaMinutes: number, unit: "earlier" | "less" = "earlier"): string {
  const rounded = Math.round(deltaMinutes)
  if (Math.abs(rounded) < 5) return "about the same"
  const later = unit === "earlier" ? "later" : "more"
  const sooner = unit === "earlier" ? "earlier" : "less"
  return `${formatSleepDuration(Math.abs(rounded))} ${rounded > 0 ? later : sooner}`
}
