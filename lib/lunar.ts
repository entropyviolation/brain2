/**
 * lib/lunar.ts — Local calendar day of the new moon and the full moon
 *
 * Jean Meeus, Astronomical Algorithms, ch. 49. Accurate to a couple of minutes,
 * which is enough to name the local day the phase falls on. Terrestrial Time
 * is treated as UTC; the difference is about a minute and only matters when
 * the phase sits on local midnight.
 *
 * The traditional lunar month opens on the new moon (the 1st) and reaches the
 * full moon near the 15th. The report day is the local day that contains the
 * phase, not a civil 1st or 15th.
 *
 * `moonGlance` names the eight familiar phases and counts calendar days to
 * the sooner of the next full moon and the next new moon.
 */

const DEG = Math.PI / 180

function sinD(deg: number): number {
  return Math.sin(deg * DEG)
}

function cosD(deg: number): number {
  return Math.cos(deg * DEG)
}

export type LunarKind = "new" | "full"

function phaseOfK(k: number): LunarKind | null {
  const frac = ((k % 1) + 1) % 1
  if (frac < 1e-6 || frac > 1 - 1e-6) return "new"
  if (Math.abs(frac - 0.5) < 1e-6) return "full"
  return null
}

/**
 * Julian Ephemeris Day of a mean phase.
 * Integer `k` is a new moon. `k + 0.5` is a full moon.
 */
export function lunarPhaseJde(k: number): number {
  const phase = phaseOfK(k)
  if (!phase) throw new Error(`lunarPhaseJde: k ${k} is not a new or full moon`)

  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const T4 = T3 * T

  let jde =
    2451550.09766 +
    29.530588861 * k +
    0.00015437 * T2 -
    0.00000015 * T3 +
    0.00000000073 * T4

  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const E2 = E * E
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3

  const core =
    (phase === "new" ? -0.4072 : -0.40614) * sinD(Mp) +
    (phase === "new" ? 0.17241 : 0.17302) * E * sinD(M) +
    (phase === "new" ? 0.01608 : 0.01614) * sinD(2 * Mp) +
    (phase === "new" ? 0.01039 : 0.01043) * sinD(2 * F) +
    (phase === "new" ? 0.00739 : 0.00734) * E * sinD(Mp - M) -
    (phase === "new" ? 0.00514 : 0.00515) * E * sinD(Mp + M) +
    (phase === "new" ? 0.00208 : 0.00209) * E2 * sinD(2 * M) -
    0.00111 * sinD(Mp - 2 * F) -
    0.00057 * sinD(Mp + 2 * F) +
    0.00056 * E * sinD(2 * Mp + M) -
    0.00042 * sinD(3 * Mp) +
    0.00042 * E * sinD(M + 2 * F) +
    0.00038 * E * sinD(M - 2 * F) -
    0.00024 * E * sinD(2 * Mp - M) -
    0.00017 * sinD(Om) -
    0.00007 * sinD(Mp + 2 * M) +
    0.00004 * sinD(2 * Mp - 2 * F) +
    0.00004 * sinD(3 * M) +
    0.00003 * sinD(Mp + M - 2 * F) +
    0.00003 * sinD(2 * Mp + 2 * F) -
    0.00003 * sinD(Mp + M + 2 * F) +
    0.00003 * sinD(Mp - M + 2 * F) -
    0.00002 * sinD(Mp - M - 2 * F) -
    0.00002 * sinD(3 * Mp + M) +
    0.00002 * sinD(4 * Mp)

  jde += core

  if (phase === "full") {
    jde +=
      0.00306 -
      0.00038 * E * cosD(M) +
      0.00026 * cosD(Mp) -
      0.00002 * cosD(Mp - M) +
      0.00002 * cosD(Mp + M) +
      0.00002 * cosD(2 * F)
  }

  const A1 = 299.77 + 0.107408 * k - 0.009173 * T2
  const A2 = 251.88 + 0.016321 * k
  const A3 = 251.83 + 26.651886 * k
  const A4 = 349.42 + 36.412478 * k
  const A5 = 84.66 + 18.206239 * k
  const A6 = 141.74 + 53.303771 * k
  const A7 = 207.14 + 2.453732 * k
  const A8 = 154.84 + 7.30686 * k
  const A9 = 34.52 + 27.261239 * k
  const A10 = 207.19 + 0.121824 * k
  const A11 = 291.34 + 1.844379 * k
  const A12 = 161.72 + 24.198154 * k
  const A13 = 239.56 + 25.513099 * k
  const A14 = 331.55 + 3.592518 * k

  jde +=
    0.000325 * sinD(A1) +
    0.000165 * sinD(A2) +
    0.000164 * sinD(A3) +
    0.000126 * sinD(A4) +
    0.00011 * sinD(A5) +
    0.000062 * sinD(A6) +
    0.00006 * sinD(A7) +
    0.000056 * sinD(A8) +
    0.000047 * sinD(A9) +
    0.000042 * sinD(A10) +
    0.00004 * sinD(A11) +
    0.000037 * sinD(A12) +
    0.000035 * sinD(A13) +
    0.000023 * sinD(A14)

  return jde
}

/** UTC instant of a phase. `k` as in `lunarPhaseJde`. */
export function lunarPhaseInstant(k: number): Date {
  return new Date((lunarPhaseJde(k) - 2440587.5) * 86400000)
}

function nearestK(date: Date, kind: LunarKind): number {
  const year = date.getUTCFullYear() + (date.getUTCMonth() + (date.getUTCDate() - 1) / 31) / 12
  const k0 = (year - 2000) * 12.3685
  return kind === "new" ? Math.round(k0) : Math.round(k0 - 0.5) + 0.5
}

/** The phase instants nearest `date` (the closest, plus one lunation either side). */
export function phaseInstantsNear(date: Date, kind: LunarKind): Date[] {
  const k = nearestK(date, kind)
  return [k - 1, k, k + 1].map((n) => lunarPhaseInstant(n))
}

function localKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * `"new"` or `"full"` when `date`'s local calendar day contains that phase.
 * A day never holds both.
 */
export function lunarOccasion(date: Date): LunarKind | null {
  const key = localKey(date)
  for (const kind of ["new", "full"] as const) {
    for (const instant of phaseInstantsNear(date, kind)) {
      if (localKey(instant) === key) return kind
    }
  }
  return null
}

const MS_DAY = 86_400_000

export type MoonPhaseId =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent"

export type MoonUntilKind = "full" | "new"

export type MoonGlance = {
  phase: MoonPhaseId
  label: string
  /** 0 at the new moon, 0.5 at the full moon, approaching 1 at the next new moon. */
  cycle: number
  /** 0 is dark, 1 is a full disk. */
  illumination: number
  waxing: boolean
  untilKind: MoonUntilKind
  untilDays: number
  untilPhrase: string
  daysUntilFull: number
  daysUntilNew: number
  /** "~21% visible (increasing each night)" */
  illuminationLine: string
  previousMajor: MajorPhase
  nextMajor: MajorPhase
}

export type MajorKind = "new" | "first" | "full" | "third"

export type MajorPhase = {
  kind: MajorKind
  label: string
  at: Date
}

const MAJOR_LABEL: Record<MajorKind, string> = {
  new: "New Moon",
  first: "First Quarter",
  full: "Full Moon",
  third: "Third Quarter",
}

const MOON_PHASES: MoonPhaseId[] = [
  "new",
  "waxing-crescent",
  "first-quarter",
  "waxing-gibbous",
  "full",
  "waning-gibbous",
  "last-quarter",
  "waning-crescent",
]

const MOON_PHASE_LABEL: Record<MoonPhaseId, string> = {
  new: "New moon",
  "waxing-crescent": "Waxing crescent",
  "first-quarter": "First quarter",
  "waxing-gibbous": "Waxing gibbous",
  full: "Full moon",
  "waning-gibbous": "Waning gibbous",
  "last-quarter": "Last quarter",
  "waning-crescent": "Waning crescent",
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function calendarDaysUntil(from: Date, instant: Date): number {
  return Math.max(0, Math.round((localMidnight(instant) - localMidnight(from)) / MS_DAY))
}

function nextPhaseAfter(date: Date, kind: LunarKind): Date {
  const k = nearestK(date, kind)
  const t = date.getTime()
  for (const n of [k - 1, k, k + 1, k + 2, k + 3]) {
    const instant = lunarPhaseInstant(n)
    if (instant.getTime() > t) return instant
  }
  return lunarPhaseInstant(k + 3)
}

function phaseAtOrBefore(date: Date, kind: LunarKind): Date {
  const k = nearestK(date, kind)
  const t = date.getTime()
  let best: Date | null = null
  for (const n of [k - 2, k - 1, k, k + 1]) {
    const instant = lunarPhaseInstant(n)
    if (instant.getTime() <= t && (!best || instant.getTime() > best.getTime())) best = instant
  }
  return best ?? lunarPhaseInstant(k - 2)
}

function phaseIdForCycle(cycle: number): MoonPhaseId {
  const wrapped = ((cycle % 1) + 1) % 1
  const index = Math.floor((wrapped + 1 / 16) * 8) % 8
  return MOON_PHASES[index]!
}

export function moonUntilPhrase(days: number, kind: MoonUntilKind): string {
  const target = kind === "full" ? "full moon" : "new moon"
  if (days <= 0) return kind === "full" ? "Full moon today" : "New moon today"
  if (days === 1) return `1 day until ${target}`
  return `${days} days until ${target}`
}

/** Current phase, plus calendar days to the sooner of the next full moon and new moon. */
export function moonGlance(date: Date): MoonGlance {
  const prevNew = phaseAtOrBefore(date, "new")
  const followingNew = nextPhaseAfter(new Date(prevNew.getTime() + 1000), "new")
  const span = followingNew.getTime() - prevNew.getTime()
  const cycle = span > 0 ? Math.min(0.999999, Math.max(0, (date.getTime() - prevNew.getTime()) / span)) : 0
  const phase = phaseIdForCycle(cycle)
  const nextNew = nextPhaseAfter(date, "new")
  const nextFull = nextPhaseAfter(date, "full")
  const daysUntilNew = calendarDaysUntil(date, nextNew)
  const daysUntilFull = calendarDaysUntil(date, nextFull)
  const untilKind: MoonUntilKind =
    daysUntilFull < daysUntilNew || (daysUntilFull === daysUntilNew && nextFull.getTime() <= nextNew.getTime())
      ? "full"
      : "new"
  const untilDays = untilKind === "full" ? daysUntilFull : daysUntilNew
  const angle = cycle * 2 * Math.PI
  const illumination = (1 - Math.cos(angle)) / 2
  const majors = neighboringMajorPhases(date)
  return {
    phase,
    label: MOON_PHASE_LABEL[phase],
    cycle,
    illumination,
    waxing: cycle < 0.5,
    untilKind,
    untilDays,
    untilPhrase: moonUntilPhrase(untilDays, untilKind),
    daysUntilFull,
    daysUntilNew,
    illuminationLine: moonIlluminationLine(illumination, cycle),
    previousMajor: majors.previous,
    nextMajor: majors.next,
  }
}

/**
 * SVG path of the lit disk. Northern hemisphere: waxing lights the right.
 * `cycle` 0 and 1 are new (empty path); 0.5 is full.
 */
export function moonLitPath(cycle: number, cx = 50, cy = 50, r = 28): string {
  const p = ((cycle % 1) + 1) % 1
  if (p < 0.02 || p > 0.98) return ""
  const top = `${cx} ${cy - r}`
  const bot = `${cx} ${cy + r}`
  if (p > 0.48 && p < 0.52) {
    return `M ${top} A ${r} ${r} 0 0 1 ${bot} A ${r} ${r} 0 0 1 ${top}`
  }
  const rx = Math.cos(p * 2 * Math.PI) * r
  const arx = Math.max(0.4, Math.abs(rx))
  const limb = p <= 0.5 ? 1 : 0
  const term = p <= 0.5 ? (rx >= 0 ? 0 : 1) : rx >= 0 ? 1 : 0
  return `M ${top} A ${r} ${r} 0 0 ${limb} ${bot} A ${arx} ${r} 0 0 ${term} ${top}`
}

export function moonIlluminationLine(illumination: number, cycle: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, illumination)) * 100)
  const trend = cycle < 0.5 ? "increasing each night" : "decreasing each night"
  return `Illumination: ~${pct}% visible (${trend})`
}

function majorKindOfK(k: number): MajorKind | null {
  const frac = ((k % 1) + 1) % 1
  if (frac < 1e-6 || frac > 1 - 1e-6) return "new"
  if (Math.abs(frac - 0.25) < 1e-6) return "first"
  if (Math.abs(frac - 0.5) < 1e-6) return "full"
  if (Math.abs(frac - 0.75) < 1e-6) return "third"
  return null
}

/**
 * Julian Ephemeris Day of a major phase.
 * Integer `k` new, `k+0.25` first quarter, `k+0.5` full, `k+0.75` third quarter.
 * New and full reuse `lunarPhaseJde`. Quarters are Meeus ch. 49.
 */
export function majorPhaseJde(k: number): number {
  const kind = majorKindOfK(k)
  if (!kind) throw new Error(`majorPhaseJde: k ${k} is not a major phase`)
  if (kind === "new" || kind === "full") return lunarPhaseJde(k)

  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const T4 = T3 * T
  let jde =
    2451550.09766 +
    29.530588861 * k +
    0.00015437 * T2 -
    0.00000015 * T3 +
    0.00000000073 * T4

  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const E2 = E * E
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3

  jde +=
    -0.62801 * sinD(Mp) +
    0.17172 * E * sinD(M) -
    0.01183 * E * sinD(Mp + M) +
    0.00862 * sinD(2 * Mp) +
    0.00804 * sinD(2 * F) +
    0.00454 * E * sinD(Mp - M) +
    0.00204 * E2 * sinD(2 * M) -
    0.0018 * sinD(Mp - 2 * F) -
    0.0007 * sinD(Mp + 2 * F) -
    0.0004 * sinD(3 * Mp) -
    0.00034 * E * sinD(2 * Mp - M) +
    0.00032 * E * sinD(M + 2 * F) +
    0.00032 * E * sinD(M - 2 * F) -
    0.00028 * E2 * sinD(Mp + 2 * M) +
    0.00027 * E * sinD(2 * Mp + M) -
    0.00017 * sinD(Om) -
    0.00005 * sinD(Mp - M - 2 * F) +
    0.00004 * sinD(2 * Mp + 2 * F) -
    0.00004 * sinD(Mp + M + 2 * F) +
    0.00004 * sinD(Mp - 2 * M) +
    0.00003 * sinD(Mp + M - 2 * F) +
    0.00003 * sinD(3 * M) +
    0.00002 * sinD(2 * Mp - 2 * F) +
    0.00002 * sinD(Mp - M + 2 * F) -
    0.00002 * sinD(3 * Mp + M)

  const W =
    0.00306 -
    0.00038 * E * cosD(M) +
    0.00026 * cosD(Mp) -
    0.00002 * cosD(Mp - M) +
    0.00002 * cosD(Mp + M) +
    0.00002 * cosD(2 * F)
  jde += kind === "first" ? W : -W

  const A1 = 299.77 + 0.107408 * k - 0.009173 * T2
  const A2 = 251.88 + 0.016321 * k
  const A3 = 251.83 + 26.651886 * k
  const A4 = 349.42 + 36.412478 * k
  const A5 = 84.66 + 18.206239 * k
  const A6 = 141.74 + 53.303771 * k
  const A7 = 207.14 + 2.453732 * k
  const A8 = 154.84 + 7.30686 * k
  const A9 = 34.52 + 27.261239 * k
  const A10 = 207.19 + 0.121824 * k
  const A11 = 291.34 + 1.844379 * k
  const A12 = 161.72 + 24.198154 * k
  const A13 = 239.56 + 25.513099 * k
  const A14 = 331.55 + 3.592518 * k
  jde +=
    0.000325 * sinD(A1) +
    0.000165 * sinD(A2) +
    0.000164 * sinD(A3) +
    0.000126 * sinD(A4) +
    0.00011 * sinD(A5) +
    0.000062 * sinD(A6) +
    0.00006 * sinD(A7) +
    0.000056 * sinD(A8) +
    0.000047 * sinD(A9) +
    0.000042 * sinD(A10) +
    0.00004 * sinD(A11) +
    0.000037 * sinD(A12) +
    0.000035 * sinD(A13) +
    0.000023 * sinD(A14)
  return jde
}

export function majorPhaseInstant(k: number): Date {
  return new Date((majorPhaseJde(k) - 2440587.5) * 86400000)
}

function asMajor(k: number, at: Date): MajorPhase {
  const kind = majorKindOfK(k)!
  return { kind, label: MAJOR_LABEL[kind], at }
}

/** The major phase just passed, and the next one still ahead. */
export function neighboringMajorPhases(date: Date): { previous: MajorPhase; next: MajorPhase } {
  const k0 = nearestK(date, "new")
  const hits: { k: number; at: Date }[] = []
  for (let step = -2; step <= 3; step++) {
    const base = k0 + step
    for (const frac of [0, 0.25, 0.5, 0.75]) {
      const k = base + frac
      hits.push({ k, at: majorPhaseInstant(k) })
    }
  }
  const t = date.getTime()
  const past = hits.filter((hit) => hit.at.getTime() <= t).sort((a, b) => b.at.getTime() - a.at.getTime())
  const future = hits.filter((hit) => hit.at.getTime() > t).sort((a, b) => a.at.getTime() - b.at.getTime())
  const previous = past[0] ?? hits[0]!
  const next = future[0] ?? hits[hits.length - 1]!
  return { previous: asMajor(previous.k, previous.at), next: asMajor(next.k, next.at) }
}

/** "October 10, 2026, at 11:50 am" in the local zone. */
export function formatMajorWhen(date: Date): string {
  const day = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(" AM", " am")
    .replace(" PM", " pm")
  return `${day}, at ${time}`
}
