/**
 * lib/ingest/apply-gps.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyGps } from "./apply-gps"

const NOW = new Date(2026, 8, 21, 18, 48, 0)
const DATE = formatLocalDateKey(NOW)

beforeEach(() => {
  resetAllStores()
})

describe("applyGps", () => {
  it("errors without a payload", () => {
    const result = applyGps("", NOW)
    expect(result.status).toBe("error")
    expect(result.kind).toBe("gps")
    if (result.status === "error") {
      expect(result.reply).toBe("Where? gps: Home or a Telegram location pin.")
    }
  })

  it("creates and paints a location pen; second identical gps is ignored", () => {
    const first = applyGps("Home", NOW)
    expect(first.status).toBe("ok")
    expect(first.kind).toBe("gps")
    if (first.status === "ok") {
      expect(first.reply).toMatch(/Location: Home/)
    }

    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    const home = scope?.pens.find((p) => p.name === "Home")
    expect(home).toBeTruthy()

    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries.some((e) => e.penId === home!.id)).toBe(true)
    expect(entries.every((e) => e.endMin <= 18 * 60 + 49)).toBe(true)
    expect(entries.some((e) => e.endMin >= 1440)).toBe(false)

    const second = applyGps("Home", NOW)
    expect(second.status).toBe("ignored")
    expect(second.kind).toBe("gps")
    if (second.status === "ignored") {
      expect(second.reply).toBeUndefined()
      expect(second.summary).toBe("Still at Home")
    }
  })

  it("paints from coordinates", () => {
    const result = applyGps("37.7749, -122.4194", NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.reply).toMatch(/37\.775,-122\.419/)
    }
    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.some((p) => p.name === "37.775,-122.419")).toBe(true)
    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries.every((e) => e.endMin < 1440)).toBe(true)
  })

  it("keeps a nearby restaurant name on the place you are already standing", () => {
    applyGps("Home\n37.77,-122.42", NOW)
    const later = new Date(2026, 8, 21, 18, 53, 0)
    const result = applyGps("Uber Eats\n37.7702,-122.4202", later)
    expect(result.status).toBe("ignored")
    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.some((p) => p.name === "Uber Eats")).toBe(false)
    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries).toHaveLength(1)
    expect(entries[0]?.endMin).toBe(18 * 60 + 54)
    expect(entries[0]?.endMin).toBeLessThan(1440)
  })

  it("clips an open-until-midnight block back to the sample", () => {
    const store = useTimeTrackingStore.getState()
    const penId = store.addPen("location", { name: "Restaurant", color: "#c45c26" })
    store.paintMinutes(DATE, "location", 18 * 60, 1440, penId)
    const result = applyGps("Home\n37.10,-122.10", new Date(2026, 8, 21, 18, 10, 0))
    expect(result.status).toBe("ok")
    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries.every((e) => e.endMin <= 18 * 60 + 11)).toBe(true)
    expect(entries.some((e) => e.endMin >= 1440)).toBe(false)
  })

  it("does not paint a shared venue pin", () => {
    const result = applyGps("shared-place\nSushi Place\n37.77,-122.42", NOW)
    expect(result.status).toBe("ignored")
    if (result.status === "ignored") expect(result.summary).toMatch(/Shared place/)
    expect(useTimeTrackingStore.getState().entriesFor(DATE, "location")).toHaveLength(0)
  })

  it("ignores a fuzzy jump away from the current place", () => {
    applyGps("Home\n37.77,-122.42", NOW)
    const result = applyGps("37.80,-122.50\n±800m", new Date(2026, 8, 21, 19, 0, 0))
    expect(result.status).toBe("ignored")
    if (result.status === "ignored") expect(result.summary).toMatch(/kept Home/)
    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.some((p) => /37\.800/.test(p.name))).toBe(false)
  })

  it("replays a phone log at each sample's own time", () => {
    const result = applyGps(
      ["2026-09-21T16:00:00;37.77,-122.42;Home", "2026-09-21T18:30:00;37.80,-122.40;Cafe"].join("\n"),
      NOW,
    )
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/Location log: 2/)
    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(entries.every((e) => e.endMin < 1440)).toBe(true)
    const cafe = entries.find((e) => e.endMin === 18 * 60 + 31)
    expect(cafe).toBeTruthy()
    expect(cafe!.startMin).toBeGreaterThanOrEqual(18 * 60 + 31 - 15)
  })

  it("uses an at: stamp instead of the processing clock", () => {
    applyGps("Cafe\n37.78,-122.41\nat: 2026-09-21T09:15:00", NOW)
    const entries = useTimeTrackingStore.getState().entriesFor(DATE, "location")
    expect(entries).toHaveLength(1)
    expect(entries[0]?.endMin).toBe(9 * 60 + 16)
    expect(entries[0]?.startMin).toBe(9 * 60 + 16 - 15)
  })
})
