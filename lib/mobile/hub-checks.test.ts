/**
 * lib/mobile/hub-checks.test.ts — Each phone link says what is wrong and what to do
 */
import { describe, expect, it } from "vitest"
import { hubRows, hubSummary, type HubInput } from "./hub-checks"

const NOW = Date.UTC(2026, 9, 30, 12)
const base: HubInput = {
  windowStatus: "live",
  windowDetail: null,
  hubUrl: "http://192.168.0.150:3000",
  ping: { ok: true, hasData: true },
  loadedAt: NOW - 120000,
  outbox: 0,
  onPhone: true,
  location: { available: true, permission: "always", recording: true, configured: true, queued: 0, dropped: 0, lastUploadAt: NOW - 60000 },
  healthAvailable: true,
  nfcAvailable: true,
  nfcConfigured: true,
  now: NOW,
}

describe("hubRows", () => {
  it("is all green when every link answers", () => {
    expect(hubSummary(hubRows(base))).toEqual({ tone: "ok", line: "Everything is hooked up." })
  })

  it("names a Mac that did not answer and says how to fix it", () => {
    const rows = hubRows({ ...base, windowStatus: "offline", windowDetail: "Timed out.", ping: { ok: false, reason: "Load failed" } })
    expect(rows.find((r) => r.id === "mac")).toMatchObject({ tone: "bad", fix: expect.stringContaining("Local Network") })
    expect(hubSummary(rows).line).toBe("2 broken: Mac data, Hub.")
  })

  it("flags unsent phone edits", () => {
    expect(hubRows({ ...base, outbox: 3 }).find((r) => r.id === "outbox")).toMatchObject({ tone: "warn", line: "3 waiting for the Mac." })
  })

  it("leaves the native links off outside the phone app", () => {
    const rows = hubRows({ ...base, onPhone: false })
    expect(rows.filter((r) => ["location", "health", "nfc"].includes(r.id)).every((r) => r.tone === "off")).toBe(true)
  })

  it("warns when the sideloaded build is about to stop opening", () => {
    const rows = hubRows({ ...base, location: { ...base.location, appExpiresAt: NOW + 86400000 } })
    expect(rows.find((r) => r.id === "app")).toMatchObject({ tone: "bad" })
  })
})
