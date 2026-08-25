/**
 * parse-flight-text.test.ts
 */
import { describe, it, expect } from "vitest"
import {
  parseFlightText,
  parseClockToken,
  parseFlightDate,
  parseOperatedByLine,
  extractClocks,
  extractFlightNumbers,
} from "./parse-flight-text"
import { formatCityLabel, titleCaseCity } from "./city-search"

const SAMPLE = `Flight details
Tijuana to Lima

Total flight duration: 10h 34m

1 Stop, Mexico City (AICM)

Flight Y4 183

Operated by Volaris Mexico

04:27 PM

Tijuana


08:50 PM

Mexico City (AICM)

Wait of 1h 10min layover in Mexico City (AICM)

Flight Y4 3918

Operated by Volaris Mexico

10:00 PM

Mexico City (AICM)


05:01 AM

Lima`

const VOLARIS_BOARDING = `Check-in through the Volaris app
24 hours before your flight.
Volaris reservation code:

OBGTNV
TIJ
	1
Stops
LIM
Tijuana		Lima, Peru
Jorge Chavez
THIS IS NOT YOUR BOARDING PASS

DEPARTURE
Mon , 27Jul2026
4:27 PM

8:50 PM
Tijuana		Mexico City

Flight:

Operated by: Y4 Volaris México	183
Layover of 1h 10m in Mexico City
ARRIVAL
10:00 PM

5:01 AM
Mexico City		Lima, Peru

Flight:

Operated by: Y4 Volaris México	3918`

describe("parseClockToken", () => {
  it("parses 12h and 24h", () => {
    expect(parseClockToken("04:27 PM")).toEqual({ display: "4:27 PM", hhmm: "16:27" })
    expect(parseClockToken("05:01 AM")).toEqual({ display: "5:01 AM", hhmm: "05:01" })
    expect(parseClockToken("22:00")).toEqual({ display: "10:00 PM", hhmm: "22:00" })
  })
})

describe("parseFlightDate / operated-by", () => {
  it("parses Volaris date", () => {
    expect(parseFlightDate("Mon , 27Jul2026")).toBe("2026-07-27")
  })
  it("parses Jul 29, 2026 and Wed, Jul 29 without year", () => {
    expect(parseFlightDate("Jul 29, 2026")).toBe("2026-07-29")
    expect(parseFlightDate("Wed, Jul 29", new Date("2026-07-15T12:00:00"))).toBe("2026-07-29")
  })
  it("parses Operated by: Y4 Volaris México\\t183", () => {
    expect(parseOperatedByLine("Operated by: Y4 Volaris México	183")).toEqual({
      airline: "Volaris México",
      flightNumber: "Y4183",
    })
  })
  it("extracts multiple clocks from one line", () => {
    expect(extractClocks("4:27 PM	8:50 PM").map((c) => c.hhmm)).toEqual(["16:27", "20:50"])
  })
  it("parses narrow NBSP times from email paste", () => {
    expect(extractClocks("7:25\u202fPM - 8:50\u202fPM").map((c) => c.display)).toEqual([
      "7:25 PM",
      "8:50 PM",
    ])
  })
})

describe("parseFlightText", () => {
  it("parses multi-leg Volaris-style paste", () => {
    const p = parseFlightText(SAMPLE)
    expect(p.fromCity).toBe("Tijuana")
    expect(p.toCity).toBe("Lima")
    expect(p.durationLabel).toMatch(/10h 34m/)
    expect(p.stopsLabel).toMatch(/1 stop/i)
    expect(p.layoverLabel).toMatch(/Mexico City/i)
    expect(p.flightNumbers).toEqual(["Y4183", "Y43918"])
    expect(p.airline).toMatch(/Volaris/i)
    expect(p.segments).toHaveLength(2)
    expect(p.segments[0]!.departTime).toBe("16:27")
    expect(p.segments[0]!.from).toMatch(/Tijuana/i)
    expect(p.segments[0]!.to).toMatch(/Mexico City/i)
    expect(p.segments[1]!.arriveTime).toBe("05:01")
    expect(p.segments[1]!.to).toMatch(/Lima/i)
    expect(p.title).toMatch(/Tijuana/)
    expect(p.detail).toMatch(/10h 34m/)
    expect(p.detail).toMatch(/layover/i)
    expect(p.time).toBe("16:27")
  })

  it("parses Volaris boarding-pass paste with confirmation + legs", () => {
    const p = parseFlightText(VOLARIS_BOARDING)
    expect(p.confirmation).toBe("OBGTNV")
    expect(p.departureDate).toBe("2026-07-27")
    expect(p.fromCity).toMatch(/Tijuana/i)
    expect(p.toCity).toMatch(/Lima/i)
    expect(p.flightNumbers).toEqual(["Y4183", "Y43918"])
    expect(p.segments).toHaveLength(2)
    expect(p.segments[0]).toMatchObject({
      departTime: "16:27",
      arriveTime: "20:50",
      flightNumber: "Y4183",
      from: "Tijuana",
      to: "Mexico City",
    })
    expect(p.segments[1]).toMatchObject({
      departTime: "22:00",
      arriveTime: "05:01",
      flightNumber: "Y43918",
      from: "Mexico City",
      to: expect.stringMatching(/Lima/i),
    })
    expect(p.layovers.length).toBeGreaterThanOrEqual(1)
    expect(p.layoverLabel).toMatch(/1h 10m/i)
    expect(p.layoverLabel).toMatch(/Mexico City/i)
    // Layover duration must not be mistaken for flight duration
    expect(p.durationLabel || "").not.toMatch(/^1h 10m/)
    expect(p.fromAirport).toBe("TIJ")
    expect(p.toAirport).toBe("LIM")
    expect(p.detail).toMatch(/OBGTNV/)
    expect(p.detail).toMatch(/layover/i)
  })

  it("handles nonstop short paste", () => {
    const p = parseFlightText(`San Diego to Lisbon
Nonstop
Flight TP 204
Operated by TAP Air Portugal
9:30 PM
San Diego
2:15 PM
Lisbon
Duration: 11h 45m`)
    expect(p.fromCity).toMatch(/San Diego/i)
    expect(p.toCity).toMatch(/Lisbon/i)
    expect(p.stopsLabel).toMatch(/Nonstop/i)
    expect(p.flightNumbers[0]).toBe("TP204")
  })

  it("parses Google Flights + LATAM confirmation paste", () => {
    const p = parseFlightText(`Lima to Cusco
Wed, Jul 29, 2026 • 7:25\u202fPM - 8:50\u202fPM
LIM
7:25\u202fPM
1h 25m
CUZ
8:50\u202fPM
Confirmation
GWRYAK
LATAM Airlines
LA2069`)
    expect(p.fromCity).toMatch(/Lima/i)
    expect(p.toCity).toMatch(/Cusco/i)
    expect(p.fromAirport).toBe("LIM")
    expect(p.toAirport).toBe("CUZ")
    expect(p.confirmation).toBe("GWRYAK")
    expect(p.flightNumbers).toContain("LA2069")
    expect(p.airline).toMatch(/LATAM/i)
    expect(p.departureDate).toBe("2026-07-29")
    expect(p.segments).toHaveLength(1)
    expect(p.segments[0]).toMatchObject({
      departTime: "19:25",
      arriveTime: "20:50",
      flightNumber: "LA2069",
    })
    expect(p.durationLabel).toMatch(/1h 25m/)
    expect(p.detail).toMatch(/Conf GWRYAK/)
    expect(p.detail).toMatch(/Takeoff|LIM/i)
  })

  it("parses LATAM confirmation email itinerary block", () => {
    const p = parseFlightText(`LATAM Airlines <info@info.latam.com>
Wed, Jul 15, 7:47 PM (9 hours ago)
to me

Your trip to Cusco is ready!
Order Number: LA0452387WWPA
Reservation Code: GWRYAK

Travel itinerary

Jul 29, 2026
7:25 PM
Lima
(LIM)
LA2069

Jul 29, 2026
8:50 PM
Cusco
(CUZ)`)
    expect(p.confirmation).toBe("GWRYAK")
    expect(p.departureDate).toBe("2026-07-29")
    expect(p.fromAirport).toBe("LIM")
    expect(p.toAirport).toBe("CUZ")
    expect(p.fromCity).toMatch(/Lima/i)
    expect(p.toCity).toMatch(/Cusco/i)
    expect(p.flightNumbers).toContain("LA2069")
    expect(p.flightNumbers.some((n) => n.includes("0452387"))).toBe(false)
    expect(p.segments).toHaveLength(1)
    expect(p.segments[0]).toMatchObject({
      departTime: "19:25",
      arriveTime: "20:50",
    })
  })

  it("does not treat PM 11:05 as a flight number", () => {
    expect(extractFlightNumbers("8:15 PM\n11:05 PM")).toEqual([])
    expect(extractFlightNumbers("AM 685\nPM 11:05")).toEqual(["AM685"])
  })

  it("chains multi-leg cities and keeps layover place", () => {
    const p = parseFlightText(`Quito to Tijuana
1 Stop, Mexico City
Flight AM 685
Operated by Aeroméxico
10:52 AM
Quito
2:30 PM
Ciudad de México
Wait of 5h 45min layover in Ciudad de México
Flight AM 011
Operated by Aeroméxico
8:15 PM
Ciudad de México
11:05 PM
Tijuana
UIO
MEX
TIJ`)
    expect(p.segments).toHaveLength(2)
    expect(p.segments[0]!.from).toMatch(/Quito/i)
    expect(p.segments[0]!.to).toMatch(/México|Mexico|MEX/i)
    expect(p.segments[1]!.from).toMatch(/México|Mexico|MEX/i)
    expect(p.segments[1]!.to).toMatch(/Tijuana|TIJ/i)
    expect(p.flightNumbers).toContain("AM685")
    expect(p.flightNumbers).toContain("AM011")
    expect(p.flightNumbers).not.toContain("PM11")
    expect(p.layovers[0]?.place).toMatch(/México|Mexico/i)
    expect(p.fromAirport).toBe("UIO")
    expect(p.toAirport).toBe("TIJ")
  })
})

describe("city label helpers", () => {
  it("formats US vs international", () => {
    expect(formatCityLabel({ name: "Lima", country: "Peru", admin1: "Lima Province", feature_code: "PPLC" })).toBe(
      "Lima, Peru",
    )
    expect(formatCityLabel({ name: "San Diego", country: "United States", admin1: "California" })).toBe(
      "San Diego, California",
    )
  })
  it("title-cases fragments", () => {
    expect(titleCaseCity("lima peru")).toBe("Lima Peru")
  })
})
