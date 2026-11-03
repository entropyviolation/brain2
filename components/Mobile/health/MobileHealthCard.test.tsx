/**
 * components/Mobile/health/MobileHealthCard.test.tsx — The import control and its result
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const bridge = vi.hoisted(() => ({
  onPhone: false,
  result: {
    status: "unavailable" as "unavailable" | "imported" | "denied" | "empty" | "failed",
    message: "Health import runs in the iPhone app.",
  },
}))

vi.mock("@/lib/mobile/health-bridge", () => ({
  isHealthPluginAvailable: () => bridge.onPhone,
  importAllHealth: async () => bridge.result,
  openHealthSettings: async () => true,
}))

import { MobileHealthCard } from "./MobileHealthCard"

describe("MobileHealthCard", () => {
  beforeEach(() => {
    bridge.onPhone = false
    bridge.result = { status: "unavailable", message: "Health import runs in the iPhone app." }
  })

  it("shows the import and says it runs on the iPhone when HealthKit is not there", async () => {
    render(<MobileHealthCard />)
    fireEvent.click(screen.getByRole("button", { name: "Import all history" }))
    expect(await screen.findByText("Health import runs in the iPhone app.")).toBeInTheDocument()
  })

  it("shows a denied import instead of staying quiet", async () => {
    bridge.onPhone = true
    bridge.result = { status: "denied", message: "Health access is off. Turn it on in the Health app, under Sharing, then Apps, then Brain2." }
    render(<MobileHealthCard />)
    fireEvent.click(screen.getByRole("button", { name: "Import all history" }))
    expect(await screen.findByText(/Health access is off/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open iPhone Settings" })).toBeInTheDocument()
  })
})
