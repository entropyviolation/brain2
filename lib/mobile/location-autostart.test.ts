import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LocationStatus } from "./location-bridge"

const bridge = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  request: vi.fn(),
  start: vi.fn(),
}))

vi.mock("./location-bridge", () => ({
  getLocationStatus: async () => ({ ...bridge.status }),
  requestAlwaysLocation: async () => {
    bridge.request()
    bridge.status.permission = bridge.status.answer ?? "always"
    return bridge.status.permission
  },
  startLocationRecording: async () => {
    bridge.start()
    bridge.status.recording = true
    return true
  },
}))

import { ensureLocationOn, nextLocationStep, setLocationUserOff } from "./location-autostart"

const base: LocationStatus = {
  available: true,
  permission: "notDetermined",
  recording: false,
  configured: true,
  queued: 0,
  dropped: 0,
}

describe("nextLocationStep", () => {
  it("does nothing off the phone", () => {
    expect(nextLocationStep({ ...base, available: false }, false)).toBe("unavailable")
  })

  it("waits for the upload setup", () => {
    expect(nextLocationStep({ ...base, configured: false }, false)).toBe("needsSetup")
  })

  it("asks, then starts, then is on", () => {
    expect(nextLocationStep(base, false)).toBe("ask")
    expect(nextLocationStep({ ...base, permission: "always" }, false)).toBe("start")
    expect(nextLocationStep({ ...base, permission: "always", recording: true }, false)).toBe("on")
  })

  it("asks once for Always, then starts on While Using", () => {
    const whenInUse = { ...base, permission: "whenInUse" as const }
    expect(nextLocationStep(whenInUse, false)).toBe("ask")
    expect(nextLocationStep(whenInUse, false, true)).toBe("start")
  })

  it("sends a denial or no answer to iOS Settings", () => {
    expect(nextLocationStep({ ...base, permission: "denied" }, false)).toBe("settings")
    expect(nextLocationStep(base, false, true)).toBe("settings")
  })

  it("leaves it off when the person turned it off", () => {
    expect(nextLocationStep({ ...base, permission: "always" }, true)).toBe("userOff")
  })
})

describe("ensureLocationOn", () => {
  beforeEach(() => {
    bridge.status = { ...base }
    bridge.request.mockClear()
    bridge.start.mockClear()
    setLocationUserOff(false)
  })

  it("asks once and starts", async () => {
    const status = await ensureLocationOn()
    expect(status).toMatchObject({ permission: "always", recording: true })
    expect(bridge.request).toHaveBeenCalledTimes(1)
    expect(bridge.start).toHaveBeenCalledTimes(1)
  })

  it("starts on While Using without asking twice", async () => {
    bridge.status.answer = "whenInUse"
    const status = await ensureLocationOn()
    expect(status).toMatchObject({ permission: "whenInUse", recording: true })
    expect(bridge.request).toHaveBeenCalledTimes(1)
  })

  it("stops at a denial", async () => {
    bridge.status.answer = "denied"
    expect((await ensureLocationOn()).recording).toBe(false)
    expect(bridge.start).not.toHaveBeenCalled()
  })

  it("does nothing after Turn off", async () => {
    setLocationUserOff(true)
    await ensureLocationOn()
    expect(bridge.request).not.toHaveBeenCalled()
    expect(bridge.start).not.toHaveBeenCalled()
  })
})
