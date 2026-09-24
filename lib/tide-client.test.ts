import { describe, expect, it } from "vitest"
import {
  formatTideClock,
  noaaStamp,
  parseHomeTide,
  pickTideStation,
  shiftDateKey,
  stationById,
} from "./tide-client"

const SCRIPPS = stationById("9410230")!

describe("pickTideStation", () => {
  it("pins San Diego and Ocean Beach to La Jolla Scripps", () => {
    expect(pickTideStation("San Diego, California").id).toBe("9410230")
    expect(pickTideStation("Ocean Beach, California").id).toBe("9410230")
    expect(pickTideStation("La Jolla").id).toBe("9410230")
  })

  it("picks the nearest catalog coast when the city is inland", () => {
    expect(pickTideStation("Manhattan", 40.7128, -74.006).id).toBe("8518750")
  })
})

describe("parseHomeTide", () => {
  it("reads NOAA high/low, current height, and next extremes", () => {
    const tide = parseHomeTide(
      SCRIPPS,
      [
        { t: "2026-09-21 01:10", v: "0.9", type: "L" },
        { t: "2026-09-21 07:14", v: "5.14", type: "H" },
        { t: "2026-09-21 13:02", v: "0.81", type: "L" },
        { t: "2026-09-21 19:14", v: "5.12", type: "H" },
        { t: "2026-09-22 01:02", v: "0.77", type: "L" },
      ],
      [
        { t: "2026-09-21 00:00", v: "1.2" },
        { t: "2026-09-21 12:00", v: "3.21" },
      ],
      [{ t: "2026-09-21 12:06", v: "3.24" }],
      "2026-09-21 12:00",
    )
    expect(tide).toMatchObject({
      stationId: "9410230",
      place: "La Jolla",
      heightFt: 3.2,
    })
    expect(tide!.nextHigh).toMatchObject({ heightFt: 5.1, timeLabel: "7:14 PM", timeCompact: "7:14p" })
    expect(tide!.nextLow).toMatchObject({ heightFt: 0.8, timeLabel: "1:02 PM", timeCompact: "1:02p" })
    expect(tide!.hourlyFt).toEqual([1.2, 3.21])
  })

  it("returns null when NOAA sent no extremes", () => {
    expect(parseHomeTide(SCRIPPS, [], [], [], "2026-09-21 12:00")).toBeNull()
  })
})

describe("tide clocks", () => {
  it("formats NOAA stamps", () => {
    expect(noaaStamp("2026-09-21")).toBe("20260921")
    expect(shiftDateKey("2026-09-21", 1)).toBe("2026-09-22")
    expect(formatTideClock("2026-09-21 19:14")).toEqual({ label: "7:14 PM", compact: "7:14p" })
  })
})
