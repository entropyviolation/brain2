/**
 * components/Analytics/cross-section.ts — Shared-range density series
 *
 * Pure. Each series is a day-aligned strip over the Analytics window. Missing
 * observations stay missing (never interpolated as zero). n is days with a
 * real reading. Domain is the observed max, with a sensible floor so a 12-minute
 * day is not stretched to look like a full day.
 */
export type CrossSectionSeriesId =
  | "habits"
  | "tracking"
  | "sleep"
  | "completions"
  | "points"
  | "operations"
  | "regret"
  | "mood"
  | "joy"
  | "switches"
  | "location"
  | "goals"
  | "screentime"

export type DensityPresence = "missing" | "zero" | "value"

export interface DensityPoint {
  date: string
  /** null = no observation that day (do not paint as zero). */
  value: number | null
}

export interface DensitySeries {
  id: CrossSectionSeriesId
  label: string
  unit: string
  hue: number
  points: DensityPoint[]
  n: number
  domainMax: number
  format: (value: number) => string
}

export interface CrossSectionMaps {
  dateKeys: readonly string[]
  /** Habit AV % for the day, or null when there are no habits to score. */
  habits: Readonly<Record<string, number | null>>
  /** Occupied minutes (0 is a real empty grid). */
  tracking: Readonly<Record<string, number>>
  /** Sleep minutes, or null when the night was not tracked. */
  sleep: Readonly<Record<string, number | null>>
  completions: Readonly<Record<string, number>>
  points: Readonly<Record<string, number>>
  operations: Readonly<Record<string, number>>
  regret: Readonly<Record<string, number>>
  mood?: Readonly<Record<string, number>>
  joy?: Readonly<Record<string, number | null>>
  switches?: Readonly<Record<string, number>>
  location?: Readonly<Record<string, number>>
  goals?: Readonly<Record<string, number>>
  /** Occupied minutes on the Screen Time scope (0 is a real empty grid). */
  screentime?: Readonly<Record<string, number>>
}

function pointsFrom(
  dateKeys: readonly string[],
  values: Readonly<Record<string, number | null | undefined>>,
  missingMeansNull: boolean,
): DensityPoint[] {
  return dateKeys.map((date) => {
    const raw = values[date]
    if (raw === null) return { date, value: null }
    if (raw === undefined) return { date, value: missingMeansNull ? null : 0 }
    return { date, value: raw }
  })
}

export function observedN(points: readonly DensityPoint[]): number {
  return points.filter((p) => p.value !== null).length
}

export function presenceOf(value: number | null): DensityPresence {
  if (value === null) return "missing"
  if (value === 0) return "zero"
  return "value"
}

/** Observed max, never below `floor`, never treating missing as zero. */
export function observedDomainMax(points: readonly DensityPoint[], floor: number): number {
  let max = 0
  let any = false
  for (const p of points) {
    if (p.value === null) continue
    any = true
    if (p.value > max) max = p.value
  }
  if (!any) return floor
  return Math.max(max, floor)
}

export function intensity(value: number | null, domainMax: number): number {
  if (value === null || domainMax <= 0 || value <= 0) return 0
  return Math.min(1, value / domainMax)
}

export function formatMinutes(value: number): string {
  const total = Math.max(0, Math.round(value))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`
}

export function buildCrossSection(maps: CrossSectionMaps): DensitySeries[] {
  const { dateKeys } = maps

  const habits = pointsFrom(dateKeys, maps.habits, true)
  const tracking = pointsFrom(dateKeys, maps.tracking, false)
  const sleep = pointsFrom(dateKeys, maps.sleep, true)
  const completions = pointsFrom(dateKeys, maps.completions, false)
  const points = pointsFrom(dateKeys, maps.points, false)
  const operations = pointsFrom(dateKeys, maps.operations, false)
  const regret = pointsFrom(dateKeys, maps.regret, false)
  const extra: DensitySeries[] = []

  if (maps.mood) {
    const mood = pointsFrom(dateKeys, maps.mood, false)
    extra.push({
      id: "mood",
      label: "Mood",
      unit: "min",
      hue: 312,
      points: mood,
      n: mood.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(mood, 30),
      format: formatMinutes,
    })
  }
  if (maps.joy) {
    const joy = pointsFrom(dateKeys, maps.joy, true)
    extra.push({
      id: "joy",
      label: "Joy",
      unit: "",
      hue: 48,
      points: joy,
      n: observedN(joy),
      domainMax: 100,
      format: (v) => String(Math.round(v)),
    })
  }
  if (maps.switches) {
    const switches = pointsFrom(dateKeys, maps.switches, false)
    extra.push({
      id: "switches",
      label: "Switches",
      unit: "",
      hue: 22,
      points: switches,
      n: switches.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(switches, 1),
      format: (v) => String(Math.round(v)),
    })
  }
  if (maps.location) {
    const location = pointsFrom(dateKeys, maps.location, false)
    extra.push({
      id: "location",
      label: "Places",
      unit: "pens",
      hue: 198,
      points: location,
      n: location.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(location, 1),
      format: (v) => String(Math.round(v)),
    })
  }
  if (maps.goals) {
    const goals = pointsFrom(dateKeys, maps.goals, false)
    extra.push({
      id: "goals",
      label: "Goals",
      unit: "items",
      hue: 268,
      points: goals,
      n: goals.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(goals, 1),
      format: (v) => String(Math.round(v)),
    })
  }
  if (maps.screentime) {
    const screentime = pointsFrom(dateKeys, maps.screentime, false)
    extra.push({
      id: "screentime",
      label: "Screen Time",
      unit: "min",
      hue: 168,
      points: screentime,
      n: screentime.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(screentime, 60),
      format: formatMinutes,
    })
  }

  return [
    {
      id: "habits",
      label: "Habits",
      unit: "%",
      hue: 142,
      points: habits,
      n: observedN(habits),
      domainMax: 100,
      format: (v) => `${Math.round(v)}%`,
    },
    {
      id: "tracking",
      label: "Tracking",
      unit: "min",
      hue: 188,
      points: tracking,
      n: tracking.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(tracking, 60),
      format: formatMinutes,
    },
    {
      id: "sleep",
      label: "Sleep",
      unit: "h",
      hue: 252,
      points: sleep,
      n: observedN(sleep),
      domainMax: observedDomainMax(sleep, 8 * 60),
      format: formatHours,
    },
    {
      id: "completions",
      label: "Completed",
      unit: "items",
      hue: 38,
      points: completions,
      n: completions.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(completions, 1),
      format: (v) => String(Math.round(v)),
    },
    {
      id: "points",
      label: "Points",
      unit: "pts",
      hue: 45,
      points: points,
      n: points.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(points, 10),
      format: (v) => `${Math.round(v)} pts`,
    },
    {
      id: "operations",
      label: "Operations",
      unit: "min",
      hue: 312,
      points: operations,
      n: operations.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(operations, 30),
      format: formatMinutes,
    },
    {
      id: "regret",
      label: "Regret",
      unit: "",
      hue: 350,
      points: regret,
      n: regret.filter((p) => (p.value ?? 0) > 0).length,
      domainMax: observedDomainMax(regret, 1),
      format: (v) => String(Math.round(v * 10) / 10),
    },
    ...extra,
  ]
}

export function readoutFor(series: readonly DensitySeries[], date: string): string {
  const bits = series.map((s) => {
    const point = s.points.find((p) => p.date === date)
    if (!point || point.value === null) return `${s.label} —`
    return `${s.label} ${s.format(point.value)}`
  })
  return bits.join(" · ")
}
