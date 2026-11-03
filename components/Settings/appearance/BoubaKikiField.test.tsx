import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChromePatina } from "@/app/chrome-patina"
import { DEFAULT_CORNER_RADII, cornerTokens } from "@/lib/corner-mix"
import { DRIFT_PRESET_MS } from "@/lib/drift-clock"
import { DEFAULT_CORNER_DRIFT, DEFAULT_WARMTH_DRIFT, useThemeStore } from "@/lib/theme-store"
import { BoubaKikiField } from "./BoubaKikiField"

function renderPanel() {
  return render(
    <div className="set95-dialog" data-testid="settings-panel">
      <BoubaKikiField />
      <ChromePatina />
    </div>,
  )
}

describe("BoubaKikiField", () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ ...DEFAULT_WARMTH_DRIFT, ...DEFAULT_CORNER_DRIFT, appearanceRev: 0 })
    vi.spyOn(Date, "now").mockReturnValue(0)
  })

  afterEach(() => {
    document.documentElement.removeAttribute("style")
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("starts on the default snapshot and paused", () => {
    render(<BoubaKikiField />)
    expect(screen.getByLabelText("Corners")).toHaveValue("50")
    expect(useThemeStore.getState().cornerPaused).toBe(true)
    expect(cornerTokens(useThemeStore.getState().cornerMix)).toEqual(DEFAULT_CORNER_RADII)
    expect(screen.getByRole("button", { name: "Resume corners drift" })).toBeTruthy()
  })

  it("Default restores mix 50 and pauses after a move", () => {
    render(<BoubaKikiField />)
    fireEvent.click(screen.getByRole("button", { name: "Resume corners drift" }))
    fireEvent.change(screen.getByLabelText("Corners"), { target: { value: "8" } })
    expect(useThemeStore.getState().cornerMix).toBe(8)
    fireEvent.click(screen.getByRole("button", { name: "Default" }))
    expect(useThemeStore.getState().cornerMix).toBe(50)
    expect(useThemeStore.getState().cornerPaused).toBe(true)
    expect(cornerTokens(50)["--r-2"]).toBe("2px")
    expect(cornerTokens(50)["--radius"]).toBe("0.75rem")
  })

  it("instant writes corner tokens on the root immediately", () => {
    vi.useFakeTimers()
    vi.spyOn(Date, "now").mockReturnValue(0)
    renderPanel()
    fireEvent.change(screen.getByLabelText("Corners"), { target: { value: "90" } })
    expect(useThemeStore.getState().cornerMix).toBe(90)
    expect(useThemeStore.getState().cornerTransition).toBeNull()
    expect(document.documentElement.style.getPropertyValue("--r-2")).toBe(cornerTokens(90)["--r-2"])
    expect(screen.getByTestId("settings-panel").style.getPropertyValue("--r-2")).toBe("")
  })

  it("previews a timed corner shift on the dialog and commits root tokens when the interval ends", async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(Date, "now").mockImplementation(() => now)
    useThemeStore.setState({ cornerPeriodMs: DRIFT_PRESET_MS["1w"] })
    renderPanel()
    const panel = screen.getByTestId("settings-panel")
    const rootRadius = () => document.documentElement.style.getPropertyValue("--r-2")
    const panelRadius = () => panel.style.getPropertyValue("--r-2")
    const held = cornerTokens(50)["--r-2"]

    fireEvent.click(screen.getByRole("radio", { name: "Timed" }))
    fireEvent.change(screen.getByLabelText("Corners"), { target: { value: "90" } })
    expect(useThemeStore.getState().cornerTransition).toBeNull()
    expect(useThemeStore.getState().cornerMix).toBeCloseTo(50, 4)

    fireEvent.click(screen.getByRole("button", { name: "Start corners shift" }))
    const started = useThemeStore.getState()
    expect(started.cornerPeriodMs).toBe(DRIFT_PRESET_MS["1w"])
    expect(started.cornerTransition?.to).toBe(90)
    expect(started.cornerTransition?.from).toBeCloseTo(50, 4)
    expect(rootRadius()).toBe(held)
    expect(panelRadius()).toBe(held)

    now = 15_000
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    const from = useThemeStore.getState().cornerTransition?.from ?? 50
    const midPos = from + (90 - from) * 0.5
    const mid = cornerTokens(midPos)["--r-2"]
    expect(mid).not.toBe(cornerTokens(from)["--r-2"])
    expect(panelRadius()).toBe(mid)
    expect(rootRadius()).toBe(cornerTokens(from)["--r-2"])
    expect(useThemeStore.getState().cornerMix).toBeCloseTo(50, 4)

    now = 30_000
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(useThemeStore.getState().cornerTransition).toBeNull()
    expect(useThemeStore.getState().cornerMix).toBe(90)
    expect(rootRadius()).toBe(cornerTokens(90)["--r-2"])
    expect(panelRadius()).toBe("")
  })

  it("reduced motion commits a timed corner shift to the whole app immediately", () => {
    vi.useFakeTimers()
    vi.spyOn(Date, "now").mockReturnValue(0)
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList)
    renderPanel()
    fireEvent.click(screen.getByRole("radio", { name: "Timed" }))
    fireEvent.change(screen.getByLabelText("Corners"), { target: { value: "90" } })
    fireEvent.click(screen.getByRole("button", { name: "Start corners shift" }))
    expect(useThemeStore.getState().cornerTransition).toBeNull()
    expect(useThemeStore.getState().cornerMix).toBe(90)
    expect(document.documentElement.style.getPropertyValue("--r-2")).toBe(cornerTokens(90)["--r-2"])
    expect(screen.getByTestId("settings-panel").style.getPropertyValue("--r-2")).toBe("")
  })
})
