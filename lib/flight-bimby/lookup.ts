/**
 * lib/flight-bimby/lookup.ts — Fill the blanks a confirmation left, from facts only
 *
 * `searchFlightInfo` asks the live schedule (Aviationstack, when a key is set) for one flight number
 * on one date. `fillBlanks` uses it, and the local tables, to finish a draft. It only ever fills a
 * field the paste left empty, and it never keeps the schedule `flight-lookup.ts` would estimate:
 * an estimate is a guess, and a guessed time on a calendar is worse than a blank.
 */
import { lookupFlightLive, type FlightLookupResult } from "@/lib/flight-lookup"
import { airlineByCode } from "./airlines"
import { airportForCity, airportInfo } from "./airports"
import { finishDraft } from "./extract"
import type { FlightDraft } from "./types"

/** One flight number on one date, from the live schedule. Null with no key, no match, or no network. */
export async function searchFlightInfo(
  flightNumber: string,
  date: string,
  ctx: { from?: string; to?: string } = {},
): Promise<FlightLookupResult | null> {
  try {
    return await lookupFlightLive(flightNumber, date, { fromAirport: ctx.from, toAirport: ctx.to })
  } catch {
    return null
  }
}

const clockOf = (iso?: string) => iso?.match(/T(\d{2}):(\d{2})/)?.slice(1, 3).join(":")
const dateOf = (iso?: string) => iso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]

/** Local tables first (always right), then the live schedule for what is still empty. */
export async function fillBlanks(draft: FlightDraft, opts: { live?: boolean } = {}): Promise<FlightDraft> {
  const d: FlightDraft = { ...draft, notes: [...draft.notes] }
  if (!d.airline && d.flightNumber) d.airline = airlineByCode(d.flightNumber.slice(0, 2))?.name
  if (!d.from) d.from = airportForCity(d.fromCity)
  if (!d.to) d.to = airportForCity(d.toCity)
  d.fromCity ??= airportInfo(d.from)?.city
  d.toCity ??= airportInfo(d.to)?.city

  const gaps = !d.from || !d.to || !d.departTime || !d.arriveTime
  if (opts.live !== false && d.flightNumber && d.departDate && gaps) {
    const live = await searchFlightInfo(d.flightNumber, d.departDate, { from: d.from, to: d.to })
    if (live && live.source === "aviationstack") {
      let used = false
      const take = <K extends keyof FlightDraft>(key: K, value: FlightDraft[K] | undefined) => {
        if (value && !d[key]) {
          d[key] = value
          used = true
        }
      }
      take("airline", live.airline)
      take("from", live.fromAirport)
      take("to", live.toAirport)
      take("departTime", clockOf(live.departureTime))
      take("arriveTime", clockOf(live.arrivalTime))
      take("arriveDate", dateOf(live.arrivalTime))
      if (used) d.notes.push("Blanks filled from the live flight schedule.")
    }
  }
  return finishDraft(d)
}
