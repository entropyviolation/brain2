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

  it("saves the upload, then turns recording on with Always", async () => {
    render(<MobileLocationCard />)
    await screen.findByText("Location: allow access")
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Upload URL"), { target: { value: " http://100.1.2.3:8788/upload " } })
    fireEvent.change(screen.getByLabelText("Upload token"), { target: { value: "tok" } })
    fireEvent.change(screen.getByLabelText("Capture public key"), { target: { value: "MCow" } })
    bridge.status = { ...bridge.status, configured: true }
    fireEvent.click(screen.getByRole("button", { name: "Save upload" }))
    await screen.findByText("Upload saved on this phone.")
    expect(bridge.configure).toHaveBeenCalledWith({ uploadUrl: "http://100.1.2.3:8788/upload", token: "tok", publicKey: "MCow" })
    expect(screen.queryByLabelText("Upload token")).toBeNull()

    bridge.status = { ...bridge.status, permission: "always", recording: true }
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }))
    await screen.findByText("Recording.")
    expect(bridge.request).toHaveBeenCalled()
    expect(bridge.start).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())
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
})
