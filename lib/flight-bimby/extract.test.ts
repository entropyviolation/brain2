import { describe, expect, it } from "vitest"
import { extractFlights, looksLikeFlightConfirmation } from "./extract"
import { PASTED } from "./fixture"

const NOW = new Date("2026-11-07T12:00:00")


describe("extractFlights on the pasted confirmations", () => {
  const { flights, leftover } = extractFlights(PASTED, NOW)
  it("finds both flights", () => expect(flights).toHaveLength(2))
  it("reads the JetBlue flight out of San Diego", () => {
    expect(flights[0]).toMatchObject({
      airline: "JetBlue", from: "SAN", to: "JFK", departDate: "2026-11-12", departTime: "11:48",
      arriveDate: "2026-11-12", arriveTime: "20:13", confirmation: "WTWUQC",
    })
    expect(flights[0]!.flightNumber).toBeUndefined()
    expect(flights[0]!.missing).toContain("flight number")
  })
  it("reads the Alaska flight into San Diego", () => {
    expect(flights[1]).toMatchObject({
      airline: "Alaska Airlines", flightNumber: "AS25", from: "JFK", to: "SAN", departDate: "2026-11-18",
      departTime: "17:28", arriveDate: "2026-11-18", arriveTime: "20:45", confirmation: "LLVAJR", durationMinutes: 377, miles: 2439,
    })
    expect(flights[1]!.missing).toEqual([])
  })
  it("hands the chatter on", () => expect(leftover).toMatch(/^now it's time to order brow bleach/))
})

describe("looksLikeFlightConfirmation", () => {
  it("is true for a confirmation", () => expect(looksLikeFlightConfirmation(PASTED, NOW)).toBe(true))
  it("leaves plans and chatter alone", () => {
    expect(looksLikeFlightConfirmation("need to book flights but im stuck, no idea where to start with the whole trip", NOW)).toBe(false)
    expect(looksLikeFlightConfirmation("Plan for rn: make more coffee, book ny flights (nowwww), then clean space for 15 min", NOW)).toBe(false)
  })
})
