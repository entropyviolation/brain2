import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const bridge = vi.hoisted(() => ({
  available: true,
  status: {
    available: true,
    permission: "notDetermined",
    recording: false,
    configured: false,
    queued: 0,
    dropped: 0,
  } as Record<string, unknown>,
  configure: vi.fn(async () => true),
  request: vi.fn(async () => "always"),
  start: vi.fn(async () => true),
  stop: vi.fn(async () => true),
  flush: vi.fn(async () => true),
  settings: vi.fn(async () => true),
}))

vi.mock("@/lib/mobile/location-bridge", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/location-bridge")>()
  return {
    ...real,
    isLocationPluginAvailable: () => bridge.available,
    getLocationStatus: async () => (bridge.available ? { ...bridge.status } : { ...bridge.status, available: false }),
    configureLocationUpload: bridge.configure,
    requestAlwaysLocation: bridge.request,
    startLocationRecording: bridge.start,
    stopLocationRecording: bridge.stop,
    flushLocationQueue: bridge.flush,
    openLocationSettings: bridge.settings,
  }
})

import { MobileLocationCard } from "./MobileLocationCard"

describe("MobileLocationCard", () => {
  beforeEach(() => {
    bridge.available = true
    bridge.status = { available: true, permission: "notDetermined", recording: false, configured: false, queued: 0, dropped: 0 }
    vi.clearAllMocks()
  })

  it("renders nothing off the phone", async () => {
    bridge.available = false
    const { container } = render(<MobileLocationCard />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
  })

  it("saving the upload goes straight on to asking for location and starting", async () => {
    render(<MobileLocationCard />)
    await screen.findByText("Location: allow access")
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Upload URL"), { target: { value: " http://100.1.2.3:8788/upload " } })
    fireEvent.change(screen.getByLabelText("Upload token"), { target: { value: "tok" } })
    fireEvent.change(screen.getByLabelText("Capture public key"), { target: { value: "MCow" } })
    bridge.status = { ...bridge.status, configured: true, permission: "always", recording: true }
    fireEvent.click(screen.getByRole("button", { name: "Save upload" }))
    await screen.findByText("Upload saved. Recording.")
    expect(bridge.configure).toHaveBeenCalledWith({ uploadUrl: "http://100.1.2.3:8788/upload", token: "tok", publicKey: "MCow" })
    expect(bridge.request).toHaveBeenCalled()
    expect(bridge.start).toHaveBeenCalled()
    expect(screen.queryByLabelText("Upload token")).toBeNull()
    await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())
    expect(screen.queryByRole("button", { name: "Set to Always" })).toBeNull()
  })

  it("does not start when location is denied", async () => {
    bridge.status = { ...bridge.status, configured: true }
    bridge.request.mockResolvedValueOnce("denied")
    render(<MobileLocationCard />)
    const on = await screen.findByRole("button", { name: "Turn on" })
    await waitFor(() => expect(on).toBeEnabled())
    fireEvent.click(on)
    await screen.findByText(/Location is off for Brain2/)
    expect(bridge.start).not.toHaveBeenCalled()
  })

  it("starts on While Using but not without an answer", async () => {
    bridge.status = { ...bridge.status, configured: true }
    bridge.request.mockResolvedValueOnce("notDetermined").mockResolvedValueOnce("whenInUse")
    render(<MobileLocationCard />)
    const on = await screen.findByRole("button", { name: "Turn on" })
    await waitFor(() => expect(on).toBeEnabled())
    fireEvent.click(on)
    await screen.findByText(/No location answer yet/)
    expect(bridge.start).not.toHaveBeenCalled()
    await waitFor(() => expect(on).toBeEnabled())
    fireEvent.click(on)
    await screen.findByText(/Choose Always in iPhone Settings/)
    expect(bridge.start).toHaveBeenCalledTimes(1)
  })

  it("offers iPhone Settings while only While Using is granted", async () => {
    bridge.status = { ...bridge.status, configured: true, permission: "whenInUse", recording: true }
    render(<MobileLocationCard />)
    const always = await screen.findByRole("button", { name: "Set to Always" })
    fireEvent.click(always)
    await waitFor(() => expect(bridge.settings).toHaveBeenCalled())
  })
})
