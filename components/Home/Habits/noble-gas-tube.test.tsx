import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  NobleGasTube,
  TUBE_INNER_R,
  clampPercent,
  plasmaClipRx,
  plasmaClipWidth,
  plasmaFill,
} from "./noble-gas-tube"
import { DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"

describe("plasmaFill", () => {
  it("maps percent to chamber fraction with a tiny 0% spark", () => {
    expect(clampPercent(-4)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(plasmaFill(0)).toBe(0.018)
    expect(plasmaFill(82)).toBeCloseTo(0.82)
    expect(plasmaFill(89)).toBeCloseTo(0.89)
    expect(plasmaFill(100)).toBe(1)
    expect(plasmaClipWidth(82)).toBeGreaterThan(plasmaClipWidth(0))
    expect(plasmaClipWidth(100)).toBeGreaterThan(plasmaClipWidth(89))
    expect(plasmaClipWidth(100)).toBeGreaterThan(plasmaClipWidth(82))
    expect(plasmaClipWidth(50)).toBeCloseTo(plasmaClipWidth(100) / 2)
  })

  it("rounds the column front to a hemisphere, not a flat cut", () => {
    expect(plasmaClipRx(0)).toBeCloseTo(plasmaClipWidth(0) / 2)
    expect(plasmaClipRx(50)).toBe(TUBE_INNER_R)
    expect(plasmaClipRx(100)).toBe(TUBE_INNER_R)
    expect(plasmaClipRx(100)).toBeLessThan(plasmaClipWidth(100) / 2)
  })
})

describe("NobleGasTube", () => {
  it("exposes progressbar semantics and clip width for the percent", () => {
    const { rerender } = render(<NobleGasTube value={82} gas="argon" label="Week grade" />)
    const bar = screen.getByRole("progressbar", { name: "Week grade" })
    expect(bar).toHaveAttribute("aria-valuenow", "82")
    expect(bar).toHaveAttribute("data-percent", "82")
    expect(bar).toHaveAttribute("data-shape", "finger-tube")
    expect(bar.style.getPropertyValue("--hab-plasma")).toBe("82%")
    const clip82 = screen.getByTestId("hab-gas-plasma-clip")
    const width82 = Number(clip82.getAttribute("width"))
    expect(width82).toBeCloseTo(plasmaClipWidth(82))
    expect(Number(clip82.getAttribute("rx"))).toBeCloseTo(plasmaClipRx(82))

    rerender(<NobleGasTube value={100} gas="xenon" label="Perfect output" />)
    const full = screen.getByRole("progressbar", { name: "Perfect output" })
    expect(full).toHaveAttribute("aria-valuenow", "100")
    expect(full).toHaveAttribute("data-percent", "100")
    expect(full).toHaveAttribute("data-gas", "xenon")
    const clip100 = screen.getByTestId("hab-gas-plasma-clip")
    expect(Number(clip100.getAttribute("width"))).toBeGreaterThan(width82)
    expect(Number(clip100.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(100))
    expect(Number(clip100.getAttribute("rx"))).toBe(TUBE_INNER_R)
    expect(Number(clip100.getAttribute("height"))).toBe(TUBE_INNER_R * 2)

    rerender(<NobleGasTube value={0} gas="krypton" label="Empty" />)
    expect(screen.getByRole("progressbar", { name: "Empty" })).toHaveAttribute("aria-valuenow", "0")
    const clip0 = screen.getByTestId("hab-gas-plasma-clip")
    expect(Number(clip0.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(0))
    expect(Number(clip0.getAttribute("rx"))).toBeCloseTo(plasmaClipRx(0))
    expect(Number(clip0.getAttribute("height"))).toBeCloseTo(Number(clip0.getAttribute("width")))
  })

  it("tints the discharge from hue while keeping percent mapping", () => {
    render(<NobleGasTube value={64} gas="argon" hue="#ff8800" label="Tinted" />)
    const bar = screen.getByRole("progressbar", { name: "Tinted" })
    expect(bar).toHaveAttribute("data-hue", "#ff8800")
    expect(bar).toHaveAttribute("data-gas", "argon")
    expect(bar.style.getPropertyValue("--hab-gas-halo")).toBe("#ff8800")
    expect(bar.style.getPropertyValue("--hab-plasma")).toBe("64%")
    const clip = screen.getByTestId("hab-gas-plasma-clip")
    expect(Number(clip.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(64))
  })

  it("falls back to the gas default hue when the pick is missing", () => {
    render(<NobleGasTube value={40} gas="xenon" label="Default xenon" />)
    expect(screen.getByRole("progressbar", { name: "Default xenon" })).toHaveAttribute(
      "data-hue",
      DEFAULT_OUTPUT_TUBE_COLOR,
    )
  })

  it("fills the bore height once the column is long enough", () => {
    render(<NobleGasTube value={50} gas="argon" label="Half" />)
    const clip = screen.getByTestId("hab-gas-plasma-clip")
    expect(Number(clip.getAttribute("height"))).toBe(TUBE_INNER_R * 2)
    expect(Number(clip.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(50))
  })

  it("draws a hemispherical dome, not a pointed ampoule tip", () => {
    const { container } = render(<NobleGasTube value={50} gas="argon" label="Span grade" />)
    const envelope = container.querySelector("[data-dome='hemisphere']")
    expect(envelope).toBeTruthy()
    const d = envelope?.getAttribute("d") ?? ""
    expect(d).toMatch(/A 18 18/)
    expect(d).not.toMatch(/C286 10 298 16 308 28/)
    expect(d).not.toMatch(/pipette/)
  })
})
