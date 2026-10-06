/**
 * machine-loading.tsx — the wait instrument names itself, and stays quiet
 * when the surrounding copy already does.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MachineLoading, rollCritterCount, rollWaitCast } from "./machine-loading"

function seq(values: number[]) {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe("MachineLoading", () => {
  it("announces the wait", () => {
    render(<MachineLoading label="Loading lists" />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Loading lists")
    expect(status.querySelector(".ml-sine")).not.toBeNull()
    expect(status.querySelector(".ml-cursor")).toBeNull()
    expect(status.querySelector(".ml-idea")).toBeNull()
  })

  it("keeps a name on the status-row scope without the glass pets", () => {
    render(<MachineLoading size="pip" label="Loading lists" />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Loading lists")
    expect(status.querySelector(".ml-floor")).toBeNull()
    expect(status.querySelector(".ml-readout")).toBeNull()
  })

  it("stays out of the accessibility tree when decorative", () => {
    render(<MachineLoading decorative label="Listing" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByTestId("machine-loading")).toHaveAttribute("aria-hidden", "true")
  })

  it("says loading and blinks three bars", () => {
    render(<MachineLoading />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("loading")
    expect(status.querySelectorAll(".ml-bar")).toHaveLength(3)
    expect(status.querySelector(".ml-caret")).toBeNull()
  })

  it("leaves most empty waits empty, and adds pets less often as the count grows", () => {
    expect(rollCritterCount(seq([0.6]))).toBe(0)
    expect(rollCritterCount(seq([0, 0]))).toBe(1)
    expect(rollCritterCount(seq([0, 0.5]))).toBe(2)
    expect(rollCritterCount(seq([0, 0.78]))).toBe(3)
    expect(rollCritterCount(seq([0, 0.93]))).toBe(4)
  })

  it("sends four of the same pet onto the floor", () => {
    const cast = rollWaitCast(seq([0, 0.93, 0]))
    expect(cast.petCount).toBe(4)
    expect(cast.lamp).toBe("green")
  })
})
