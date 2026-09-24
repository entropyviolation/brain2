/**
 * lib/solar-remainder.ts — Home Solar remainder clock
 *
 * One day cycles: until sunrise → sunrise → to sunset → sunset → after
 * sunset → midnight, then the next day's sunrise. Pure; astronomy lives in
 * `sun-times.ts`. Polar days with no rise/set return an empty face.
 */

export type SolarPhase = "until-sunrise" | "sunrise" | "to-sunset" | "sunset" | "after-sunset"

export type SolarRemainderFace = {
  phase: SolarPhase | "none"
  crt: string
  footer: string
}

export type SolarClock = {
  sunriseMinutes: number
  sunsetMinutes: number
  sunriseLabel: string
  sunsetLabel: string
}

/** `2h 14m` / `47m` / `3h`. Zero is `0m`. */
export function formatRemainSpan(minutes: number): string {
  const abs = Math.max(0, Math.round(minutes))
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function clockMinutesOnDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Phase for `nowMin` on a local day whose sun is `sun`.
 * The sunrise and sunset minutes themselves speak the event name.
 */
export function solarRemainderFace(nowMin: number, sun: SolarClock | null | undefined): SolarRemainderFace {
  if (!sun) return { phase: "none", crt: "—", footer: "No sun clock" }
  const now = ((Math.floor(nowMin) % 1440) + 1440) % 1440
  const rise = ((Math.round(sun.sunriseMinutes) % 1440) + 1440) % 1440
  const set = ((Math.round(sun.sunsetMinutes) % 1440) + 1440) % 1440

  if (now < rise) {
    return {
      phase: "until-sunrise",
      crt: formatRemainSpan(rise - now),
      footer: `until sunrise · ${sun.sunriseLabel}`,
    }
  }
  if (now === rise) {
    return { phase: "sunrise", crt: "Sunrise", footer: sun.sunriseLabel }
  }
  if (now < set) {
    return {
      phase: "to-sunset",
      crt: formatRemainSpan(set - now),
      footer: `to sunset · ${sun.sunsetLabel}`,
    }
  }
  if (now === set) {
    return { phase: "sunset", crt: "Sunset", footer: sun.sunsetLabel }
  }
  return {
    phase: "after-sunset",
    crt: formatRemainSpan(now - set),
    footer: `after sunset · ${sun.sunsetLabel}`,
  }
}
