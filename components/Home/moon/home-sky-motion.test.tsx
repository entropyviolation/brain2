import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { SkyMotionBar } from "@/components/Home/home-sky-motion"
import { DEFAULT_SKY_MOTION, useSkyMotionStore } from "@/lib/sky-motion-store"

describe("sky motion bar", () => {
  beforeEach(() => {
    localStorage.clear()
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
  })

  it("saves a faster rate and resets to real time", () => {
    render(<SkyMotionBar />)
    expect(screen.getByLabelText("Time rate")).toHaveValue("0")
    expect(screen.getByText("real time")).toBeInTheDocument()
    expect(screen.getByText("3,162 km")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Time rate"), { target: { value: "3" } })
    expect(screen.getByText("1 day per second")).toBeInTheDocument()
    expect(useSkyMotionStore.getState().rateIndex).toBe(3)

    fireEvent.change(screen.getByLabelText("View width"), { target: { value: "4.4" } })
    expect(screen.getByText("25,119 km")).toBeInTheDocument()
    expect(screen.getByText("About 2.0 x Earth diameter")).toBeInTheDocument()
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)

    fireEvent.click(screen.getByRole("button", { name: "Reset to real time" }))
    expect(screen.getByText("real time")).toBeInTheDocument()
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)
    expect(screen.getByText("25,119 km")).toBeInTheDocument()
  })

  it("does not write pause or reverse into the motion store", () => {
    render(<SkyMotionBar />)
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    expect(screen.getByRole("button", { name: "Reverse" })).toBeInTheDocument()
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(3.5)
  })
})
