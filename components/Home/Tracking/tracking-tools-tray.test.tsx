import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ERASE, SCISSORS, PenPalette } from "./pen-palette"
import { resetTrackingPaintToolMemory } from "./tracking-tool-mode"
import "./tracking-chrome.css"

function paintTray() {
  return document.querySelector(".trk-tools-tray") as HTMLElement
}

function latchesWell() {
  return document.querySelector(".trk-latches-well") as HTMLElement
}

function paintKey(name: string | RegExp) {
  return within(paintTray()).getByRole("button", { name })
}

function latchKey(name: string | RegExp) {
  return within(latchesWell()).getByRole("button", { name })
}

function keyBox(el: HTMLElement) {
  const style = getComputedStyle(el)
  return {
    width: style.width,
    height: style.height,
    maxWidth: style.maxWidth,
    maxHeight: style.maxHeight,
    flexGrow: style.flexGrow,
  }
}

describe("Tracking tools tray", () => {
  beforeEach(() => {
    resetAllStores()
    resetTrackingPaintToolMemory()
  })

  it("defaults to Draw with the pen tray; tools rail is pinned right", () => {
    render(<PenPalette />)

    const row = document.querySelector(".trk-pen-tools-row")
    const pens = row?.querySelector(".trk-pen-tray")
    const rail = row?.querySelector(".trk-tools-rail")
    const tools = row?.querySelector(".trk-tools-tray")
    const detail = row?.querySelector(".trk-tool-detail")

    expect(row).toBeTruthy()
    expect(pens).toBeTruthy()
    expect(rail).toBeTruthy()
    expect(tools).toBeTruthy()
    expect(row?.lastElementChild).toBe(rail)
    expect(pens?.nextElementSibling).toBe(rail)
    expect(rail?.contains(tools)).toBe(true)
    expect(rail?.contains(detail as Node)).toBe(true)
    expect(getComputedStyle(rail as HTMLElement).marginLeft).toBe("auto")

    expect(within(pens as HTMLElement).getByLabelText("Search pens")).toBeInTheDocument()
    expect(pens?.querySelector(".trk-selected")).toBeTruthy()
    expect(pens?.querySelector(".trk-tools")).toBeNull()
    expect(pens?.querySelector(".trk-tool-detail")).toBeNull()

    const cluster = within(tools as HTMLElement)
    expect(cluster.getByRole("button", { name: /^Draw$/ })).toHaveAttribute("aria-pressed", "true")
    expect(cluster.getByRole("button", { name: /Erase/ })).toHaveAttribute("aria-pressed", "false")
    expect(cluster.getByRole("button", { name: /Scissors/ })).toHaveAttribute("aria-pressed", "false")
    expect(cluster.queryByRole("button", { name: /^View$/ })).not.toBeInTheDocument()
    expect(cluster.queryByRole("button", { name: /Hide/ })).not.toBeInTheDocument()
    expect(cluster.queryByRole("button", { name: /Tags/ })).not.toBeInTheDocument()
    expect(cluster.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(detail).toHaveTextContent("Draw")
    expect(detail).toHaveTextContent(/paint with the selected pen/i)
    expect(detail?.querySelector(".trk-jewel")).toBeTruthy()
    expect(tools?.contains(detail as Node)).toBe(true)
    expect(detail?.querySelector(".trk-selected-plate")).toBeNull()
    expect(tools?.querySelector("svg")).toBeNull()
    expect(tools?.querySelector("[class*='lucide']")).toBeNull()
    expect(getComputedStyle(detail as HTMLElement).width).not.toBe("176px")
    expect(getComputedStyle(detail as HTMLElement).minWidth).not.toBe("176px")
  })

  it("puts Hide, View, and Tags in a distinct top Look well next to SHOW AS", () => {
    render(<PenPalette />)

    const well = latchesWell()
    const toolbar = document.querySelector(".trk-toolbar-row")
    const sort = document.querySelector(".trk-module-sort")
    expect(well).toBeTruthy()
    expect(well).toHaveTextContent("Look")
    expect(well.closest(".trk-toolbar")).toBeTruthy()
    expect(toolbar?.contains(well)).toBe(true)
    expect(sort?.nextElementSibling).toBe(well)
    expect(paintTray().contains(well)).toBe(false)
    expect(document.querySelector(".trk-tools-rail")?.contains(well)).toBe(false)

    expect(latchKey(/Hide/)).toBeInTheDocument()
    expect(latchKey(/^View$/)).toBeInTheDocument()
    expect(latchKey(/Tags/)).toBeInTheDocument()
    expect(within(well).queryByRole("button", { name: /^Draw$/ })).not.toBeInTheDocument()
    expect(well.querySelector("svg")).toBeNull()
  })

  it("makes Draw, Erase, and Scissors exclusive radios and hides the pen tray unless Draw", () => {
    render(<PenPalette />)

    fireEvent.click(paintKey(/Erase/))
    expect(useTimeTrackingStore.getState().selectedPenId).toBe(ERASE)
    expect(paintKey(/^Draw$/)).toHaveAttribute("aria-pressed", "false")
    expect(paintKey(/Erase/)).toHaveAttribute("aria-pressed", "true")
    expect(paintKey(/Scissors/)).toHaveAttribute("aria-pressed", "false")
    expect(document.querySelector(".trk-pen-tray")).toBeNull()
    expect(document.querySelector(".trk-pen-well")).toBeNull()
    expect(screen.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(screen.queryByText("Click a minute to split that block")).not.toBeInTheDocument()
    expect(document.querySelector(".trk-pen-tools-row")?.lastElementChild).toHaveClass("trk-tools-rail")
    expect(getComputedStyle(document.querySelector(".trk-tools-rail") as HTMLElement).marginLeft).toBe("auto")
    const eraseDetail = document.querySelector(".trk-tool-detail")
    expect(eraseDetail).toBeTruthy()
    expect(eraseDetail?.closest(".trk-pen-tray")).toBeNull()
    expect(eraseDetail).toHaveTextContent("Erase")
    expect(eraseDetail).toHaveTextContent(/drag to clear minutes/i)

    fireEvent.click(paintKey(/Scissors/))
    expect(useTimeTrackingStore.getState().selectedPenId).toBe(SCISSORS)
    expect(paintKey(/^Draw$/)).toHaveAttribute("aria-pressed", "false")
    expect(paintKey(/Erase/)).toHaveAttribute("aria-pressed", "false")
    expect(paintKey(/Scissors/)).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector(".trk-pen-tray")).toBeNull()
    expect(paintKey(/Scissors/).textContent).not.toMatch(/Click a minute/)
    expect(document.querySelector(".trk-pen-tools-row")?.lastElementChild).toHaveClass("trk-tools-rail")
    const scissorsDetail = document.querySelector(".trk-tool-detail")
    expect(scissorsDetail).toHaveTextContent("Scissors")
    expect(scissorsDetail).toHaveTextContent(/click a minute to split/i)

    fireEvent.click(paintKey(/^Draw$/))
    expect(useTimeTrackingStore.getState().selectedPenId).not.toBe(ERASE)
    expect(useTimeTrackingStore.getState().selectedPenId).not.toBe(SCISSORS)
    expect(paintKey(/^Draw$/)).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector(".trk-pen-tray")).toBeTruthy()
    expect(screen.getByLabelText("Search pens")).toBeInTheDocument()
  })

  it("keeps Hide, View, and Tags independent of Draw and does not resize paint keys", () => {
    render(<PenPalette />)

    fireEvent.click(latchKey(/Hide/))
    expect(paintKey(/^Draw$/)).toHaveAttribute("aria-pressed", "true")
    expect(latchKey(/Hide/)).toHaveAttribute("aria-pressed", "true")
    expect(useTimeTrackingStore.getState().selectedPenId).not.toBe(ERASE)
    expect(document.querySelector(".trk-pen-tray")).toBeTruthy()

    fireEvent.click(latchKey(/Tags/))
    expect(paintKey(/^Draw$/)).toHaveAttribute("aria-pressed", "true")
    expect(latchKey(/Tags/)).toHaveAttribute("aria-pressed", "true")
    expect(latchKey(/Tags/)).toHaveTextContent("Tags")
    expect(latchKey(/Tags/)).not.toHaveTextContent("Done")

    const names = [/^Draw$/, /Erase/, /Scissors/]
    const idle = names.map((n) => keyBox(paintKey(n)))
    fireEvent.click(paintKey(/Scissors/))
    const pressed = names.map((n) => keyBox(paintKey(n)))
    expect(new Set(idle.map((b) => `${b.width}x${b.height}`)).size).toBe(1)
    expect(pressed).toEqual(idle)
    expect(idle[0]?.maxHeight).toBe("22px")
    expect(idle[0]?.maxWidth).toBe("96px")
    expect(idle[0]?.flexGrow).toBe("0")
    expect(keyBox(latchKey(/Hide/)).maxHeight).toBe("22px")
    expect(keyBox(latchKey(/Hide/)).maxWidth).toBe("96px")

    fireEvent.click(paintKey(/Erase/))
    expect(document.querySelector(".trk-tools-tray svg")).toBeNull()
    expect(document.querySelector(".trk-tool-detail")).toHaveTextContent(/drag to clear minutes/i)
    expect(document.querySelector(".trk-tool-detail .trk-jewel")).toBeTruthy()
  })
})
