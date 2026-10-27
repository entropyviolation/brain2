/**
 * components/capture-doors.test.tsx — CaptureDoorHost keeps a door mounted.
 *
 * Opening the bus loads that dialog once. Closing the popup leaves the
 * host in place, so a second open is the same instance.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { openCaptureDoor } from "@/components/capture-door-bus"

vi.mock("@/components/ingest-log-dialog", async (importOriginal) => {
  const React = await import("react")
  const real = await importOriginal<typeof import("@/components/ingest-log-dialog")>()
  return {
    IngestLogDialog: (props: { hideTrigger?: boolean }) =>
      React.createElement(
        "div",
        { "data-testid": "ingest-door-host" },
        React.createElement(real.IngestLogDialog, props),
      ),
  }
})

import { CaptureDoorHost } from "@/components/capture-doors"

describe("CaptureDoorHost", () => {
  it("keeps the ingest dialog mounted after close", async () => {
    render(<CaptureDoorHost />)
    expect(screen.queryByTestId("ingest-door-host")).toBeNull()

    openCaptureDoor("ingest")
    await screen.findByRole("dialog", { name: "Message ingest log" })
    const host = screen.getByTestId("ingest-door-host")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Message ingest log" })).toBeNull()
    })
    expect(screen.getByTestId("ingest-door-host")).toBe(host)

    openCaptureDoor("ingest")
    await screen.findByRole("dialog", { name: "Message ingest log" })
    expect(screen.getByTestId("ingest-door-host")).toBe(host)
  })
})
