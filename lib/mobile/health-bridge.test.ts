/**
 * lib/mobile/health-bridge.test.ts — The Health import through a mocked `BrainHealth` plugin
 *
 * `@capacitor/core` is mocked, so these runs never touch HealthKit. The page
 * walk itself is tested in `lib/phone-sync/health.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  platform: "web",
  available: false,
  requestAccess: vi.fn(async () => ({ ok: true }) as { ok?: boolean; denied?: boolean }),
  earliest: vi.fn(async () => ({ at: null }) as { at?: number | null; denied?: boolean }),
  readPage: vi.fn(async (_: { startMs: number; endMs: number }) => ({ days: [], sleeps: [], workouts: [] }) as Record<string, unknown>),
  openSettings: vi.fn(async () => {}),
}))

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => native.platform, isPluginAvailable: () => native.available },
  registerPlugin: () => ({
    requestAccess: () => native.requestAccess(),
    earliest: () => native.earliest(),
    readPage: (o: { startMs: number; endMs: number }) => native.readPage(o),
    openSettings: () => native.openSettings(),
  }),
}))
vi.mock("@/lib/phone-sync/health-apply", () => ({
  commitHealthPage: () => ({ written: { days: 1, nights: 0, workouts: 0 }, read: { days: 1, nights: 0, workouts: 0 } }),
}))
vi.mock("@/lib/action-history", () => ({ rememberWorld: () => {} }))

import { importAllHealth, isHealthPluginAvailable, openHealthSettings } from "./health-bridge"

const DAY = 86400000

function onPhone() {
  native.platform = "ios"
  native.available = true
}

beforeEach(() => {
  native.platform = "web"
  native.available = false
  native.requestAccess.mockReset().mockResolvedValue({ ok: true })
  native.earliest.mockReset().mockResolvedValue({ at: null })
  native.readPage.mockReset().mockResolvedValue({ days: [], sleeps: [], workouts: [] })
  native.openSettings.mockClear()
})

describe("health bridge", () => {
  it("in a browser says the import runs in the iPhone app and asks HealthKit nothing", async () => {
    expect(isHealthPluginAvailable()).toBe(false)
    const result = await importAllHealth()
    expect(result).toMatchObject({ status: "unavailable", message: "Health import runs in the iPhone app." })
    expect(native.requestAccess).not.toHaveBeenCalled()
    expect(await openHealthSettings()).toBe(false)
  })

  it("an empty history reads no pages", async () => {
    onPhone()
    expect((await importAllHealth()).status).toBe("empty")
    expect(native.readPage).not.toHaveBeenCalled()
  })

  it("access off stops before the first page", async () => {
    onPhone()
    native.requestAccess.mockResolvedValue({ denied: true })
    expect((await importAllHealth()).status).toBe("denied")
    expect(native.readPage).not.toHaveBeenCalled()
  })

  it("names each month while it reads, 30 days at a time", async () => {
    onPhone()
    native.earliest.mockResolvedValue({ at: Date.now() - 65 * DAY })
    const lines: string[] = []
    expect((await importAllHealth((line) => lines.push(line))).status).toBe("imported")
    expect(native.readPage.mock.calls.length).toBeGreaterThanOrEqual(3)
    for (const [{ startMs, endMs }] of native.readPage.mock.calls) expect(endMs - startMs).toBeLessThanOrEqual(30 * DAY)
    expect(lines[0]).toMatch(/^Reading .+ · 1 of \d+$/)
  })

  it("a page that throws (the app sent to the background mid-import) ends failed, not stuck", async () => {
    onPhone()
    native.earliest.mockResolvedValue({ at: Date.now() - 65 * DAY })
    native.readPage.mockResolvedValueOnce({ days: [], sleeps: [], workouts: [] }).mockRejectedValueOnce(new Error("WebView suspended"))
    const result = await importAllHealth()
    expect(result.status).toBe("failed")
    expect(result.written.days).toBe(1)
  })
})
