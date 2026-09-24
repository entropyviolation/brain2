import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CHROME_FACE, useThemeStore } from "@/lib/theme-store"
import { CHROME_DRIFT_PERIOD_MS } from "@/lib/chrome-patina"
import { ChromeFaceField } from "./ChromeFaceField"

describe("ChromeFaceField", () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.getState().resetChromeFace()
    vi.spyOn(Date, "now").mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("defaults to classic Win95 and writes the set-point", () => {
    render(<ChromeFaceField />)
    const slider = screen.getByLabelText("Face gray")
    expect(slider).toHaveValue(String(DEFAULT_CHROME_FACE))
    fireEvent.change(slider, { target: { value: "80" } })
    expect(useThemeStore.getState().chromeFace).toBe(80)
    expect(slider).toHaveValue("80")
  })

  it("shows a ghost tick off the thumb while the metal is drifting", () => {
    vi.spyOn(Date, "now").mockReturnValue(CHROME_DRIFT_PERIOD_MS / 4)
    useThemeStore.getState().setChromeFace(50)
    render(<ChromeFaceField />)
    const ghost = document.querySelector(".chrome-face-slider-ghost")
    expect(ghost).toBeTruthy()
    const live = Number(ghost?.getAttribute("data-live-percent"))
    expect(live).not.toBe(50)
    expect(live).toBeGreaterThan(55)
    expect(screen.getByLabelText("Face gray")).toHaveValue("50")
  })

  it("Classic restores the default set-point", () => {
    useThemeStore.getState().setChromeFace(12)
    render(<ChromeFaceField />)
    fireEvent.click(screen.getByRole("button", { name: /Classic/i }))
    expect(useThemeStore.getState().chromeFace).toBe(DEFAULT_CHROME_FACE)
  })
})
