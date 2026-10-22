import { describe, expect, it } from "vitest"
import {
  configureLocationUpload,
  flushLocationQueue,
  getLocationStatus,
  isLocationPluginAvailable,
  locationChip,
  requestAlwaysLocation,
  startLocationRecording,
  type LocationStatus,
} from "./location-bridge"

describe("location bridge on the web", () => {
  it("is a no-op", async () => {
    expect(isLocationPluginAvailable()).toBe(false)
    expect((await getLocationStatus()).available).toBe(false)
    expect(await configureLocationUpload({ uploadUrl: "http://x/upload", token: "t", publicKey: "k" })).toBe(false)
    expect(await requestAlwaysLocation()).toBe("unknown")
    expect(await startLocationRecording()).toBe(false)
    expect(await flushLocationQueue()).toBe(false)
  })
})

describe("locationChip", () => {
  const on: LocationStatus = { available: true, permission: "always", recording: true, configured: true, queued: 0, dropped: 0 }
  const now = new Date(2026, 9, 21, 12).getTime()

  it("names each state", () => {
    expect(locationChip({ ...on, available: false }).label).toBe("Location: phone app only")
    expect(locationChip({ ...on, permission: "denied" }).tone).toBe("warn")
    expect(locationChip({ ...on, permission: "whenInUse" }).label).toBe("Location: set to Always")
    expect(locationChip({ ...on, recording: false }).label).toBe("Location: off")
    expect(locationChip({ ...on, configured: false }).label).toBe("Location: no upload set")
    expect(locationChip({ ...on, queued: 4, lastError: "offline" }).label).toBe("Location: 4 waiting")
    expect(locationChip({ ...on, lastUploadAt: now - 5 * 60000 }, now).label).toBe("Location: sent 5 min ago")
    expect(locationChip(on).label).toBe("Location: on")
  })
})
