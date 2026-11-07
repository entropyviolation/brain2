/**
 * lib/flight-bimby/types.ts — What the Flight BIMBY reads and writes
 */

/** One flight leg as read from a confirmation. Times are the clock of the airport they are printed for. */
export interface FlightDraft {
  airline?: string
  /** Compact, e.g. `AS25`. Absent when the confirmation never prints it. */
  flightNumber?: string
  /** IATA codes. */
  from?: string
  to?: string
  fromCity?: string
  toCity?: string
  /** `YYYY-MM-DD`, local to the departure airport. */
  departDate?: string
  /** `HH:mm`, local to the departure airport. */
  departTime?: string
  /** `YYYY-MM-DD`, local to the arrival airport. */
  arriveDate?: string
  /** `HH:mm`, local to the arrival airport. */
  arriveTime?: string
  confirmation?: string
  /** Printed gate-to-gate length, in minutes. */
  durationMinutes?: number
  miles?: number
  cost?: number
  /** Plain facts worth keeping: fare, refundability, seats, what was inferred. */
  notes: string[]
  /** Fields the paste did not give and nothing could fill. Shown to the person, never guessed. */
  missing: string[]
}

export interface ExtractResult {
  flights: FlightDraft[]
  /** Chatter after the last flight fact on the same line ("…LLVAJR now it's time to order…"). Goes on to the normal ingest. */
  leftover: string
}

export interface FiledFlight {
  draft: FlightDraft
  taskId: string
  eventId?: string
  /** `created` a new item, `updated` blanks on an existing one, `existing` nothing to add. */
  status: "created" | "updated" | "existing"
  eventStatus?: "created" | "updated" | "existing" | "skipped"
  /** One plain line for the reply. */
  line: string
}
