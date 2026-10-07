import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MoonOrrery } from "@/components/Home/home-moon-orrery"
import { SKY_STAR_DOTS } from "@/components/Home/naked-eye-stars"
import { earthSpinDegrees } from "@/lib/sky-motion"
import { DEFAULT_SKY_MOTION, useSkyMotionStore } from "@/lib/sky-motion-store"
import { planetPlaces } from "@/lib/solar-system"
import { approachZoom, bodyCloseFactor, orbitFitFactor } from "@/lib/sky-zoom"

describe("moon chart date", () => {
  beforeEach(() => {
    localStorage.clear()
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
  })

  afterEach(() => {
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
    localStorage.clear()
  })

  it("sets the chart anchor and Now returns to the widget date", () => {
    const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
    render(<MoonOrrery date={widget} />)
    const input = screen.getByLabelText("Date")
    expect(input).toHaveValue("2026-10-06T15:30")
    expect(screen.getByText("October 6, 2026, at 3:30 pm")).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "2020-01-01T00:00" } })
    expect(input).toHaveValue("2020-01-01T00:00")
    expect(screen.getByText("January 1, 2020, at 12:00 am")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    expect(input).toHaveValue("2026-10-06T15:30")
    expect(screen.getByText("October 6, 2026, at 3:30 pm")).toBeInTheDocument()
    const sky = within(screen.getByRole("list", { name: "Sky build" }))
    expect(sky.getByText("Date control").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Now").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("One clock").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Zoom").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Pause").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Orbit zip").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Close-up").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Reverse").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Earth spin").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Log camera").closest("li")).toHaveAttribute("data-state", "ahead")
    expect(sky.getByText("Stars").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Galaxy").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Moons").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("True sizes").closest("li")).toHaveAttribute("data-state", "done")
    expect(sky.getByText("Chrome").closest("li")).toHaveAttribute("data-state", "ahead")
    expect(sky.getByText("Light-time").closest("li")).toHaveAttribute("data-state", "ahead")

    expect(useSkyMotionStore.getState().viewWidthLog).toBe(3.5)
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
  })

  it("leaves the chosen date when reset clears only the rate", () => {
    const widget = new Date(2026, 9, 6, 12, 0, 0, 0)
    render(<MoonOrrery date={widget} />)
    fireEvent.change(screen.getByLabelText("View width"), { target: { value: "4.4" } })
    fireEvent.change(screen.getByLabelText("Time rate"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "1999-12-31T23:00" } })

    fireEvent.click(screen.getByRole("button", { name: "Reset to real time" }))
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)
    expect(screen.getByLabelText("Date")).toHaveValue("1999-12-31T23:00")
    expect(screen.getByText("December 31, 1999, at 11:00 pm")).toBeInTheDocument()
    expect(screen.getByText("real time")).toBeInTheDocument()
  })

  it("holds the anchor when the widget minute ticks at a fast rate", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0)
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION, rateIndex: 6 })
    const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
    const { rerender } = render(<MoonOrrery date={widget} />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-06T15:30")

    rerender(<MoonOrrery date={new Date(2026, 9, 6, 15, 31, 0, 0)} />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-06T15:30")

    rerender(<MoonOrrery date={new Date(2026, 9, 7, 12, 0, 0, 0)} />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-07T12:00")

    raf.mockRestore()
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
  })

  it("zooms the chart without touching view width or rate, and pause holds the anchor", () => {
    const clock = installFrames()
    try {
    const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
    const { container, rerender } = render(<MoonOrrery date={widget} />)
    const stars = container.querySelectorAll(".home-sky-star")
    expect(stars).toHaveLength(SKY_STAR_DOTS.length)
    expect(container.querySelector("[data-galaxy='band']")).toBeTruthy()
    expect(container.querySelector("[data-galaxy='schematic']")).toBeNull()
    const sirius = [...stars].find((node) => node.querySelector("title")?.textContent?.startsWith("Sirius"))
    expect(sirius?.querySelector("title")?.textContent).toMatch(/V -1\.44/)
    expect(sirius?.querySelector("title")?.textContent).toContain("B−V")
    fireEvent.mouseOver(sirius!)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-06T15:30")
    fireEvent.change(screen.getByLabelText("View width"), { target: { value: "4.4" } })
    fireEvent.change(screen.getByLabelText("Time rate"), { target: { value: "2" } })

    const before = offset(container, "mercury")
    fireEvent.click(screen.getByRole("button", { name: "Inner" }))
    clock.advance(350)
    const mid = offset(container, "mercury")
    expect(mid).toBeGreaterThan(before + 5)
    clock.advance(350)
    const inner = offset(container, "mercury")
    expect(inner).toBeGreaterThan(mid)
    expect(inner).toBeGreaterThan(before + 40)
    expect(offset(container, "mars")).toBeGreaterThan(inner)
    expect(screen.getByRole("button", { name: "Inner" })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("[data-galaxy='band']")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Galaxy" }))
    clock.advance(700)
    expect(screen.getAllByText("Milky Way radius · 50,000 ly").length).toBeGreaterThan(0)
    expect(screen.getByRole("heading", { name: "Milky Way (scale stop, not a catalog)" })).toBeInTheDocument()
    expect(container.querySelector("[data-galaxy='schematic']")).toBeTruthy()
    expect(container.querySelector("[data-galaxy='band']")).toBeTruthy()
    expect(screen.getByText(/Schematic of our galaxy/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "System" }))
    clock.advance(700)
    expect(offset(container, "mercury")).toBeLessThan(40)
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("[data-galaxy='schematic']")).toBeNull()
    expect(container.querySelector("[data-galaxy='band']")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("aria-pressed", "true")
    rerender(<MoonOrrery date={new Date(2026, 9, 7, 12, 0, 0, 0)} />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-06T15:30")

    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-07T12:00")

    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)
    expect(useSkyMotionStore.getState().rateIndex).toBe(2)
    expect(container.querySelectorAll(".home-sky-star")).toHaveLength(SKY_STAR_DOTS.length)
    } finally {
      clock.restore()
    }
  })

  it("flies a planet to its orbit, then closer, and keeps the Sun centered on the orbit", async () => {
    const clock = installFrames()
    try {
      const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
      const { container } = render(<MoonOrrery date={widget} />)
      const earth = planetPlaces(widget).find((planet) => planet.id === "earth")!
      const fit = orbitFitFactor(earth.au)
      const close = bodyCloseFactor(earth.au)
      const factorOf = () => Number(container.querySelector(".home-sky-chart")?.getAttribute("data-factor"))
      expect(container.querySelector("[data-earth-spin]")?.getAttribute("data-earth-spin")).toBe(
        earthSpinDegrees(widget.getTime()).toFixed(1),
      )

      fireEvent.click(screen.getByRole("button", { name: "Earth" }))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 280))
      })
      clock.advance(350)
      const mid = factorOf()
      expect(mid).toBeGreaterThan(1.2)
      expect(mid).toBeLessThan(fit)
      expect(mid).toBeCloseTo(approachZoom(1, fit, 0.5), 1)
      clock.advance(350)
      expect(factorOf()).toBeCloseTo(fit, 2)
      expect(offset(container, "earth")).toBeGreaterThan(80)

      fireEvent.doubleClick(screen.getByRole("button", { name: "Earth" }))
      clock.advance(320)
      expect(screen.queryByText("Earth and Moon · true size")).not.toBeInTheDocument()
      expect(factorOf()).toBeGreaterThan(fit)
      expect(factorOf()).toBeLessThan(close)
      clock.advance(400)
      expect(screen.getByText("Earth and Moon · true size")).toBeInTheDocument()
      expect(factorOf()).toBeCloseTo(close, 2)

      fireEvent.click(screen.getByRole("button", { name: "Earth" }))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 280))
      })
      clock.advance(700)
      expect(screen.queryByText("Earth and Moon · true size")).not.toBeInTheDocument()
      expect(factorOf()).toBeCloseTo(fit, 2)
      expect(offset(container, "earth")).toBeGreaterThan(80)
      expect(useSkyMotionStore.getState().rateIndex).toBe(0)
      expect(useSkyMotionStore.getState().viewWidthLog).toBe(3.5)
    } finally {
      clock.restore()
    }
  })

  it("keeps Jupiter smaller than the Sun, and opens moons or a globe instead of the Earth title", async () => {
    const clock = installFrames()
    const settleClick = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 280))
      })
      clock.advance(700)
    }
    try {
      const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
      const { container } = render(<MoonOrrery date={widget} />)
      const width = useSkyMotionStore.getState().viewWidthLog
      const rate = useSkyMotionStore.getState().rateIndex

      fireEvent.click(screen.getByRole("button", { name: "Earth" }))
      await settleClick()
      const sun = Number(container.querySelector(".home-sky-sun")?.getAttribute("r"))
      const jupiter = Number(container.querySelector('.home-sky-body[data-planet="jupiter"]')?.getAttribute("data-r"))
      expect(jupiter).toBeGreaterThan(0)
      expect(sun).toBeGreaterThan(jupiter)

      fireEvent.doubleClick(screen.getByRole("button", { name: "Venus" }))
      clock.advance(700)
      expect(screen.queryByText("Earth and Moon · true size")).not.toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Venus" })).toBeInTheDocument()
      expect(container.querySelector("[data-moons='venus']")).toBeTruthy()
      expect(container.querySelectorAll("[data-moons='venus'] .home-sky-moon-orbit")).toHaveLength(0)
      expect(screen.getByText(/runaway greenhouse of carbon dioxide/)).toBeInTheDocument()

      fireEvent.doubleClick(screen.getByRole("button", { name: "Jupiter" }))
      clock.advance(700)
      expect(screen.getByRole("heading", { name: "Jupiter" })).toBeInTheDocument()
      expect(container.querySelectorAll("[data-moons='jupiter'] .home-sky-moon-orbit")).toHaveLength(4)
      for (const name of ["Io", "Europa", "Ganymede", "Callisto"]) {
        expect(screen.getByText(name)).toBeInTheDocument()
      }
      expect(screen.getByText(/Europa hides an ocean under ice/)).toBeInTheDocument()

      const toggle = screen.getByRole("button", { name: "True sizes" })
      expect(toggle).toHaveAttribute("aria-pressed", "false")
      expect(toggle).toHaveAttribute(
        "title",
        "Orbits may still be the √r layout. Only the disks are true kilometres.",
      )
      fireEvent.click(screen.getByRole("button", { name: "Earth" }))
      await settleClick()
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByText("true size, marked")).toBeInTheDocument()
      const earthAt = container.querySelector('.home-sky-body[data-planet="earth"]')
      const venusAt = container.querySelector('.home-sky-body[data-planet="venus"]')
      const gap = Math.hypot(
        Number(earthAt?.getAttribute("data-x")) - Number(venusAt?.getAttribute("data-x")),
        Number(earthAt?.getAttribute("data-y")) - Number(venusAt?.getAttribute("data-y")),
      )
      const reach = Number(earthAt?.getAttribute("data-r")) + Number(venusAt?.getAttribute("data-r"))
      expect(gap).toBeGreaterThan(reach)

      fireEvent.click(screen.getByRole("button", { name: "Jupiter facts" }))
      clock.advance(700)
      expect(container.querySelector("[data-facts='jupiter']")).toBeTruthy()
      expect(Number(container.querySelector("[data-facts='jupiter']")?.getAttribute("data-globe"))).toBeGreaterThan(150)
      expect(
        screen.getByText(
          "Science. Europa hides an ocean under ice. That ocean is a candidate, and no life has been found.",
        ),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "System" }))
      clock.advance(700)
      expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true")
      expect(useSkyMotionStore.getState().viewWidthLog).toBe(width)
      expect(useSkyMotionStore.getState().rateIndex).toBe(rate)
    } finally {
      clock.restore()
    }
  })

  it("plays the epoch backward without changing the saved rate", () => {
    const clock = installFrames()
    try {
      const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
      useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION, rateIndex: 3 })
      const { container } = render(<MoonOrrery date={widget} />)
      const epoch = () => container.querySelector(".home-sky-epoch")?.textContent ?? ""
      expect(epoch()).toMatch(/3:30 pm/)
      expect(epoch()).toMatch(/1 day per second/)

      fireEvent.click(screen.getByRole("button", { name: "Reverse" }))
      expect(screen.getByRole("button", { name: "Reverse" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "false")
      clock.advance(500)
      expect(epoch()).toMatch(/reverse/)
      expect(epoch()).not.toMatch(/3:30 pm/)
      const when = epoch().split(" · ")[0] ?? ""

      fireEvent.click(screen.getByRole("button", { name: "Pause" }))
      clock.advance(500)
      expect(epoch().startsWith(when)).toBe(true)
      expect(epoch()).toMatch(/paused/)
      expect(useSkyMotionStore.getState().rateIndex).toBe(3)
      expect(useSkyMotionStore.getState().viewWidthLog).toBe(3.5)
    } finally {
      clock.restore()
    }
  })
})

function installFrames() {
  let now = 0
  const frames = new Map<number, FrameRequestCallback>()
  let id = 1
  const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now)
  const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const handle = id++
    frames.set(handle, cb)
    return handle
  })
  const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    frames.delete(handle)
  })
  return {
    advance(ms: number) {
      const steps = Math.max(1, Math.round(ms / 16))
      const dt = ms / steps
      act(() => {
        for (let i = 0; i < steps; i++) {
          now += dt
          const batch = [...frames]
          frames.clear()
          for (const [, cb] of batch) cb(now)
        }
      })
    },
    restore() {
      nowSpy.mockRestore()
      rafSpy.mockRestore()
      cancelSpy.mockRestore()
    },
  }
}

function offset(container: HTMLElement, id: string): number {
  const node = container.querySelector(`.home-sky-body[data-planet="${id}"]`)
  const x = Number(node?.getAttribute("data-x"))
  const y = Number(node?.getAttribute("data-y"))
  return Math.hypot(x - 260, y - 200)
}
