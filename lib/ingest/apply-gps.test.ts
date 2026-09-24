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
  })
})
