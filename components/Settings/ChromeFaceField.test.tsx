import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChromePatina } from "@/app/chrome-patina"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { appDriftPosition, DEFAULT_DRIFT_PERIOD_MS, DRIFT_PRESET_MS, phaseForPosition } from "@/lib/drift-clock"
import { chromePatinaTokens } from "@/lib/chrome-patina"
import { DEFAULT_CHROME_FACE, DEFAULT_CORNER_DRIFT, DEFAULT_WARMTH_DRIFT, useThemeStore } from "@/lib/theme-store"
import { ChromeFaceField } from "./ChromeFaceField"

function renderPanel() {
  return render(
    <div className="set95-dialog" data-testid="settings-panel">
      <ChromeFaceField />
      <ChromePatina />
    </div>,
  )
}

describe("ChromeFaceField", () => {
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

  it("defaults to classic warmth and writes the slider instantly", () => {
    render(<ChromeFaceField />)
    const slider = screen.getByLabelText("Warmth")
    expect(slider).toHaveValue(String(DEFAULT_CHROME_FACE))
    fireEvent.change(slider, { target: { value: "80" } })
    expect(useThemeStore.getState().chromeFace).toBe(80)
    expect(slider).toHaveValue("80")
    expect(useThemeStore.getState().chromePeriodMs).toBe(DEFAULT_DRIFT_PERIOD_MS)
  })

  it("shows the drifted warmth when the clock has been running", () => {
    const period = DEFAULT_DRIFT_PERIOD_MS
    vi.spyOn(Date, "now").mockReturnValue(period / 4)
    useThemeStore.setState({
      chromeFace: 50,
      chromePhase: phaseForPosition(50, "towardHigh"),
      chromeEpochMs: 1,
      chromePaused: false,
      chromeTransition: null,
    })
    render(<ChromeFaceField />)
    expect(screen.getByText("now 100")).toBeTruthy()
    expect(screen.getByLabelText("Warmth")).toHaveValue("100")
  })

  it("Default restores the stored classic warmth and pauses", () => {
    useThemeStore.getState().setChromeFace(12)
    render(<ChromeFaceField />)
    fireEvent.click(screen.getByRole("button", { name: "Default" }))
    expect(useThemeStore.getState().chromeFace).toBe(DEFAULT_CHROME_FACE)
    expect(useThemeStore.getState().chromePaused).toBe(true)
  })

  it("pauses drift and can set a 30 second cycle without touching a manual shift", () => {
    render(<ChromeFaceField />)
    fireEvent.click(screen.getByRole("button", { name: "Pause warmth drift" }))
    expect(useThemeStore.getState().chromePaused).toBe(true)
    fireEvent.change(screen.getByLabelText("Warmth drift speed"), { target: { value: "30s" } })
    expect(useThemeStore.getState().chromePeriodMs).toBe(DRIFT_PRESET_MS["30s"])
    expect(useThemeStore.getState().chromeTransition).toBeNull()
  })

  it("instant writes root tokens immediately and does not preview on the dialog", () => {
    vi.useFakeTimers()
    vi.spyOn(Date, "now").mockReturnValue(0)
    renderPanel()
    fireEvent.change(screen.getByLabelText("Warmth"), { target: { value: "80" } })
    expect(useThemeStore.getState().chromeFace).toBe(80)
    expect(useThemeStore.getState().chromeTransition).toBeNull()
    expect(document.documentElement.style.getPropertyValue("--chrome-face")).toBe(chromePatinaTokens(80)["--chrome-face"])
    expect(screen.getByTestId("settings-panel").style.getPropertyValue("--chrome-face")).toBe("")
  })

  it("previews a timed shift on the dialog and commits root tokens when the interval ends", async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(Date, "now").mockImplementation(() => now)
    useThemeStore.setState({ chromePeriodMs: DRIFT_PRESET_MS["1d"], chromePaused: true })
    renderPanel()
    const panel = screen.getByTestId("settings-panel")
    const rootFace = () => document.documentElement.style.getPropertyValue("--chrome-face")
    const panelFace = () => panel.style.getPropertyValue("--chrome-face")
    const held = chromePatinaTokens(50)["--chrome-face"]

    fireEvent.click(screen.getByRole("radio", { name: "Timed" }))
    fireEvent.change(screen.getByLabelText("Warmth"), { target: { value: "80" } })
    expect(useThemeStore.getState().chromeTransition).toBeNull()
    expect(useThemeStore.getState().chromeFace).toBe(50)
    expect(rootFace()).toBe(held)

    fireEvent.click(screen.getByRole("button", { name: "Start warmth shift" }))
    const started = useThemeStore.getState()
    expect(started.chromePeriodMs).toBe(DRIFT_PRESET_MS["1d"])
    expect(started.chromeTransition?.to).toBe(80)
    expect(started.chromeTransition?.from).toBeCloseTo(50, 4)
    expect(started.chromeTransition?.durationMs).toBe(DRIFT_PRESET_MS["30s"])
    expect(rootFace()).toBe(held)
    expect(panelFace()).toBe(held)
    expect(screen.getByText("now 50")).toBeTruthy()

    now = 15_000
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    const from = useThemeStore.getState().chromeTransition?.from ?? 50
    const midPos = from + (80 - from) * 0.5
    const mid = chromePatinaTokens(midPos)["--chrome-face"]
    expect(mid).not.toBe(chromePatinaTokens(from)["--chrome-face"])
    expect(panelFace()).toBe(mid)
    expect(rootFace()).toBe(chromePatinaTokens(from)["--chrome-face"])
    expect(screen.getByText(`now ${Math.round(midPos)}`)).toBeTruthy()
    expect(useThemeStore.getState().chromeFace).toBeCloseTo(50, 4)

    now = 30_000
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(useThemeStore.getState().chromeTransition).toBeNull()
    expect(useThemeStore.getState().chromeFace).toBe(80)
    expect(rootFace()).toBe(chromePatinaTokens(80)["--chrome-face"])
    expect(panelFace()).toBe("")
  })

  it("reduced motion commits a timed shift to the whole app immediately", () => {
    vi.useFakeTimers()
    vi.spyOn(Date, "now").mockReturnValue(0)
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList)
    renderPanel()
    fireEvent.click(screen.getByRole("radio", { name: "Timed" }))
    fireEvent.change(screen.getByLabelText("Warmth"), { target: { value: "70" } })
    fireEvent.click(screen.getByRole("button", { name: "Start warmth shift" }))
    expect(useThemeStore.getState().chromeTransition).toBeNull()
    expect(useThemeStore.getState().chromeFace).toBe(70)
    expect(document.documentElement.style.getPropertyValue("--chrome-face")).toBe(chromePatinaTokens(70)["--chrome-face"])
    expect(screen.getByTestId("settings-panel").style.getPropertyValue("--chrome-face")).toBe("")
  })

  it("mounting another popup leaves drift speed, pause, and the painted face alone", async () => {
    vi.useFakeTimers()
    let now = 1_000
    vi.spyOn(Date, "now").mockImplementation(() => now)
    const period = DRIFT_PRESET_MS["1d"]
    useThemeStore.setState({
      chromeFace: 50,
      chromePhase: phaseForPosition(50, "towardHigh"),
      chromeEpochMs: 1_000,
      chromePeriodMs: period,
      chromePaused: false,
      chromeTransition: null,
    })
    render(
      <div>
        <div className="set95-dialog" data-testid="settings-panel">
          <ChromeFaceField />
          <ChromePatina />
        </div>
        <div className="set95-dialog" role="dialog" data-testid="other-popup" />
      </div>,
    )
    const before = appDriftPosition(
      {
        anchor: 50,
        phase: phaseForPosition(50, "towardHigh"),
        epochMs: 1_000,
        periodMs: period,
        paused: false,
        transition: null,
      },
      now,
    )
    now = 1_000 + 5_000
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    const state = useThemeStore.getState()
    expect(state.chromePeriodMs).toBe(period)
    expect(state.chromePaused).toBe(false)
    expect(state.chromeTransition).toBeNull()
    expect(appDriftPosition(
      {
        anchor: state.chromeFace,
        phase: state.chromePhase,
        epochMs: state.chromeEpochMs,
        periodMs: state.chromePeriodMs,
        paused: state.chromePaused,
        transition: state.chromeTransition,
      },
      now,
    )).toBeCloseTo(before, 1)
    const other = screen.getByTestId("other-popup")
    expect(other.style.getPropertyValue("--chrome-face")).toBe("")
    expect(other.classList.contains("set95-drift-preview")).toBe(false)

    fireEvent.click(screen.getByRole("radio", { name: "Timed" }))
    fireEvent.change(screen.getByLabelText("Warmth"), { target: { value: "80" } })
    fireEvent.click(screen.getByRole("button", { name: "Start warmth shift" }))
    expect(useThemeStore.getState().chromePeriodMs).toBe(period)
    expect(screen.getByTestId("settings-panel").classList.contains("set95-drift-preview")).toBe(true)
    expect(other.classList.contains("set95-drift-preview")).toBe(false)
    expect(other.style.getPropertyValue("--chrome-face")).toBe("")
  })
})

describe("dialog chrome motion", () => {
  it("turns off color transitions on dialogs so a popup cannot fade the face", () => {
    const css = readFileSync(resolve(process.cwd(), "app/win95.css"), "utf8")
    expect(css).toMatch(
      /body\.win95-app :is\(\[role="dialog"\], \[role="alertdialog"\]\) \{\s*transition-property: none;/,
    )
    expect(css).toContain(".set95-dialog.set95-drift-preview")
  })
})
