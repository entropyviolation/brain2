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

describe("hubRows, each state", () => {
  const row = (input: Partial<HubInput>, id: string) => hubRows({ ...base, ...input }).find((r) => r.id === id)

  it("words every Mac window state with a tone", () => {
    expect(row({ windowStatus: "loading", windowDetail: "(asking 192.168.0.150:3000)" }, "mac")).toMatchObject({
      tone: "warn",
      line: "Loading… (asking 192.168.0.150:3000)",
    })
    expect(row({ windowStatus: "stale", windowDetail: null }, "mac")).toMatchObject({ tone: "warn", line: "Saved copy only.", fix: expect.stringContaining("electron:dev") })
    expect(row({ windowStatus: "idle" }, "mac")).toMatchObject({ tone: "off", fix: "Tap Reload." })
    expect(row({ loadedAt: null }, "mac")?.line).toBe("Loaded.")
    expect(row({ loadedAt: NOW - 3 * 3600000 }, "mac")?.line).toBe("Loaded 3 h ago.")
  })

  it("says the hub is still checking, empty, or has no address", () => {
    expect(row({ ping: null }, "hub")).toMatchObject({ tone: "off", line: "http://192.168.0.150:3000 — checking…" })
    expect(row({ ping: null, hubUrl: "" }, "hub")?.line).toBe("No address — checking…")
    expect(row({ ping: { ok: true, hasData: false } }, "hub")).toMatchObject({ tone: "warn" })
  })

  it("flags a build without HealthKit or the NFC radio, and an NFC hub not set", () => {
    expect(row({ healthAvailable: false }, "health")).toMatchObject({ tone: "bad" })
    expect(row({ nfcAvailable: false }, "nfc")).toMatchObject({ tone: "bad" })
    expect(row({ nfcConfigured: false }, "nfc")).toMatchObject({ tone: "warn", fix: expect.stringContaining("NFC hub") })
  })

  it("adds the location error to its line", () => {
    const line = row({ location: { ...base.location, lastError: "Upload refused" } }, "location")?.line
    expect(line).toMatch(/\. Upload refused$/)
  })

  it("counts down the sideload and says when it stops today", () => {
    expect(row({ location: { ...base.location, appExpiresAt: NOW + 30 * 86400000 } }, "app")).toMatchObject({ tone: "ok", line: "Opens for 30 more days." })
    expect(row({ location: { ...base.location, appExpiresAt: NOW + 1000 } }, "app")).toMatchObject({ tone: "bad", line: "Stops opening today." })
    expect(row({ location: { ...base.location, appExpiresAt: NOW - 86400000 } }, "app")?.line).toBe("Stops opening today.")
    expect(row({}, "app")).toBeUndefined()
  })
})

describe("hubSummary", () => {
  it("names the rows to look at when nothing is broken", () => {
    expect(hubSummary(hubRows({ ...base, outbox: 1, nfcConfigured: false }))).toEqual({ tone: "warn", line: "2 to look at: Phone edits, NFC." })
  })

  it("ignores rows that are off", () => {
    expect(hubSummary(hubRows({ ...base, onPhone: false })).tone).toBe("ok")
  })
})
