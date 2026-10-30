/**
 * components/Mobile/moon/mobile-moon-sheet.test.tsx
 *
 * The phone sheet closes from Close and from the scrim. Without the
 * mobile shell, the Moon tile still opens the desktop sky dialog.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MoonTile } from "@/components/Home/home-moon-tile"
import { MobileMoonSheet } from "@/components/Mobile/moon/mobile-moon-sheet"
import type { MoonGlance } from "@/lib/lunar"

const face = {
  phase: "waning-gibbous",
  label: "Waning gibbous",
  cycle: 0.6,
  illumination: 0.9,
  waxing: false,
  untilKind: "new",
  untilDays: 11,
  untilPhrase: "11 days until new moon",
  daysUntilFull: 18,
  daysUntilNew: 11,
  illuminationLine: "Illumination: ~90% visible",
  previousMajor: { kind: "full", label: "Full Moon", at: new Date("2026-10-25T21:17:00") },
  nextMajor: { kind: "third", label: "Third Quarter", at: new Date("2026-11-01T12:29:00") },
} satisfies MoonGlance

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

describe("mobile moon sheet", () => {
  it("closes from Close and from the scrim", () => {
    const onClose = vi.fn()
    render(<MobileMoonSheet open face={face} onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    const scrim = document.querySelector(".mobile-moon-scrim")
    expect(scrim).toBeTruthy()
    fireEvent.click(scrim!)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("mobile-moon-sheet")).toBeInTheDocument()
    expect(document.querySelector(".home-sky-chart")).toBeNull()
  })
})

describe("Moon tile shell gate", () => {
  it("opens the desktop sky dialog when the mobile shell is absent", () => {
    render(<MoonTile currentDate={new Date(2026, 9, 28, 12)} onHide={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Open Moon" }))
    const dialog = document.querySelector(".home-widget-dialog.is-sky")
    expect(dialog).toBeTruthy()
    expect(screen.queryByTestId("mobile-moon-sheet")).toBeNull()
  })

  it("opens the phone sheet inside the mobile shell", () => {
    const shell = document.createElement("div")
    shell.className = "cogs-mobile-app"
    document.body.appendChild(shell)
    render(<MoonTile currentDate={new Date(2026, 9, 28, 12)} onHide={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Open Moon" }))
    expect(screen.getByTestId("mobile-moon-sheet")).toBeInTheDocument()
    expect(document.querySelector(".home-widget-dialog.is-sky")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByTestId("mobile-moon-sheet")).toBeNull()
  })
})
