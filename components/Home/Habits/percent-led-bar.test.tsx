import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { PercentLedBar } from "./percent-led-bar"
import { HabitPercentReadout } from "./habit-percent-readout"
import "./habit-grid.css"

describe("PercentLedBar", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("lights five of ten lamps at 50% and keeps the numeric label", () => {
    render(<PercentLedBar value={50} label="row" />)
    const meter = screen.getByRole("meter", { name: "row 50%" })
    expect(meter).toHaveAttribute("aria-valuenow", "50")
    expect(meter).toHaveAttribute("data-lit", "5")
    expect(meter.querySelector(".hab-pled-bar-well")).toBeTruthy()
    expect(meter.querySelectorAll(".hab-pled-bar-lamp")).toHaveLength(10)
    expect(meter.querySelectorAll(".hab-pled-bar-lamp.is-on")).toHaveLength(5)
    expect(meter.textContent).toContain("50%")
    expect(meter).toHaveStyle({ "--hab-led-tint": "#7e14ff" })
  })

  it("uses the stored tint", () => {
    useHabitsStore.getState().setPercentLedTint("#ff8800")
    render(<PercentLedBar value={100} />)
    expect(screen.getByRole("meter")).toHaveStyle({ "--hab-led-tint": "#ff8800" })
    expect(screen.getByRole("meter").querySelectorAll(".hab-pled-bar-lamp.is-on")).toHaveLength(10)
  })

  it("keeps compact as ten pips and does not let the % label shrink the channel", () => {
    const { container } = render(<PercentLedBar value={0} />)
    const bar = container.querySelector(".hab-pled-bar") as HTMLElement
    const read = container.querySelector(".hab-pled-bar-read") as HTMLElement
    const bezel = container.querySelector(".hab-pled-bar-bezel") as HTMLElement
    expect(bar).toHaveAttribute("data-density", "compact")
    expect(window.getComputedStyle(bar).display).toBe("flex")
    expect(window.getComputedStyle(bar).width).toBe("100%")
    expect(window.getComputedStyle(read).width).toBe("3.2em")
    expect(window.getComputedStyle(read).minWidth).toBe("3.2em")
    expect(window.getComputedStyle(read).maxWidth).toBe("3.2em")
    expect(window.getComputedStyle(bezel).flexGrow).toBe("1")
  })

  it("fills a wide slot with a percent-true bar and 10% ticks", () => {
    render(<PercentLedBar value={19} label="daily" density="wide" />)
    const meter = screen.getByRole("meter", { name: "daily 19%" })
    expect(meter).toHaveAttribute("aria-valuenow", "19")
    expect(meter).toHaveAttribute("data-density", "wide")
    expect(meter).toHaveAttribute("data-lit", "2")
    expect(meter.querySelectorAll(".hab-pled-bar-lamp")).toHaveLength(0)
    expect(meter.querySelectorAll(".hab-pled-bar-tick")).toHaveLength(9)
    expect((meter.querySelector(".hab-pled-bar-fill") as HTMLElement).style.width).toBe("19%")
  })
})

describe("HabitPercentReadout", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("defaults to the loading bar and switches to numeric digits when off", () => {
    const { rerender } = render(<HabitPercentReadout value={46} label="week" />)
    expect(document.querySelector(".hab-pled-bar")).toBeTruthy()
    expect(document.querySelector(".hab-pled-face")).toBeNull()
    expect(screen.getByRole("meter", { name: "week 46%" })).toHaveAttribute("data-lit", "5")

    act(() => {
      useHabitsStore.getState().setPercentLoadingBar(false)
    })
    rerender(<HabitPercentReadout value={46} label="week" />)
    expect(document.querySelector(".hab-pled-bar")).toBeNull()
    expect(document.querySelector(".hab-pled-face")).toBeTruthy()
    expect(screen.getByRole("meter", { name: "week 46%" })).toHaveAttribute("aria-valuenow", "46")
  })

  it("keeps the percent slot size when Loading Bar toggles", () => {
    const { rerender } = render(<HabitPercentReadout value={46} label="week" />)
    const slot = document.querySelector(".habit-pct") as HTMLElement
    expect(slot).toBeTruthy()
    const before = {
      height: window.getComputedStyle(slot).height,
      minHeight: window.getComputedStyle(slot).minHeight,
      maxHeight: window.getComputedStyle(slot).maxHeight,
    }
    act(() => {
      useHabitsStore.getState().setPercentLoadingBar(false)
    })
    rerender(<HabitPercentReadout value={46} label="week" />)
    const after = document.querySelector(".habit-pct") as HTMLElement
    expect(window.getComputedStyle(after).height).toBe(before.height)
    expect(window.getComputedStyle(after).minHeight).toBe(before.minHeight)
    expect(window.getComputedStyle(after).maxHeight).toBe(before.maxHeight)
    expect(after.querySelector(".hab-pled-face")).toBeTruthy()
  })

  it("passes wide density through to the loading bar", () => {
    render(<HabitPercentReadout value={19} label="daily" density="wide" />)
    expect(document.querySelector(".hab-pled-bar")).toHaveAttribute("data-density", "wide")
    expect((document.querySelector(".hab-pled-bar-fill") as HTMLElement).style.width).toBe("19%")
  })
})
