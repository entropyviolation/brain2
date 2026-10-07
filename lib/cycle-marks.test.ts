import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import {
  readCycleMarks,
  setCycleFlag,
  toggleCycleFlag,
  useCycleMarksStore,
} from "./cycle-marks"

beforeEach(() => {
  localStorage.removeItem(persistKey("cycle-marks"))
  useCycleMarksStore.setState({ marks: {} })
})

describe("cycle marks", () => {
  it("sets and clears each flag, and drops an empty day", () => {
    setCycleFlag("2026-10-06", "bleeding", true)
    setCycleFlag("2026-10-06", "spotting", true)
    expect(readCycleMarks()["2026-10-06"]).toEqual({
      date: "2026-10-06",
      bleeding: true,
      spotting: true,
    })
    expect(toggleCycleFlag("2026-10-06", "bleeding")).toBe(false)
    expect(readCycleMarks()["2026-10-06"]).toEqual({ date: "2026-10-06", spotting: true })
    setCycleFlag("2026-10-06", "spotting", false)
    expect(readCycleMarks()["2026-10-06"]).toBeUndefined()
  })

  it("does not let spotting imply bleeding", () => {
    setCycleFlag("2026-10-07", "ovulation", true)
    expect(readCycleMarks()["2026-10-07"]?.bleeding).toBeUndefined()
    expect(readCycleMarks()["2026-10-07"]?.spotting).toBeUndefined()
  })

  it("ignores a date that is not a local day key", () => {
    setCycleFlag("10/06/2026", "bleeding", true)
    setCycleFlag("2026-02-31", "bleeding", true)
    expect(readCycleMarks()).toEqual({})
  })

  it("persists under the cycle-marks key", () => {
    setCycleFlag("2026-10-06", "ovulation", true)
    const raw = localStorage.getItem(persistKey("cycle-marks"))
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? "{}") as { state?: { marks?: Record<string, unknown> } }
    expect(parsed.state?.marks?.["2026-10-06"]).toEqual({ date: "2026-10-06", ovulation: true })
  })
})
