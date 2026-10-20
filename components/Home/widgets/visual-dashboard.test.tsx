import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { usePointsStore } from "@/lib/points-store"
import { HomeOverview } from "@/components/Home/home-overview"
import { useDashboardEditMode } from "@/components/Home/widgets/edit-mode"
import "@/components/Home/home-chrome.css"

vi.mock("@/components/Reviews/RitualWalkDialog", () => ({
  RitualWalkDialog: () => null,
}))

const currentDate = new Date("2026-09-21T12:00:00")

function copyOf(kind: string) {
  const copy = useDashboardStore.getState().copies.find((entry) => entry.kind === kind)
  if (!copy) throw new Error(`no ${kind} copy`)
  return copy
}

describe("Visual dashboard", () => {
  beforeEach(() => {
    resetAllStores()
    useDashboardEditMode.setState({ editing: false })
    usePointsStore.getState().addPoints("task-1", 42, "Test task", currentDate)
  })

  it("builds installed copies from the old strip on first render", () => {
    render(<HomeOverview currentDate={currentDate} />)
    const state = useDashboardStore.getState()
    expect(state.migrated).toBe(true)
    expect(state.copies.some((copy) => copy.kind === "moon")).toBe(true)
    expect(screen.getByTestId("home-overview")).toHaveAttribute("data-style", "milled")
    expect(document.querySelectorAll(".vd-cell").length).toBeGreaterThan(4)
  })

  it("opens a copy's own settings from the gear and saves to that copy alone", async () => {
    const user = userEvent.setup()
    render(<HomeOverview currentDate={currentDate} />)
    await user.click(screen.getByRole("button", { name: "Open Moon" }))
    // The Moon guide shows the first time a fresh copy opens; migrated copies skip it.
    await user.click(screen.getByRole("button", { name: /Settings for Moon/ }))
    const panel = screen.getByTestId("widget-copy-settings")
    await user.click(within(panel).getByLabelText("Percent lit"))
    expect(copyOf("moon").settings.readout).toBe("light")
    expect(screen.getByTestId("home-moon-tile")).toHaveTextContent(/\d+% lit/)
  })

  it("renames a face with the copy's title", async () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useDashboardStore.getState().updateCopy(copyOf("moon").id, { title: "Luna" }))
    expect(screen.getByTestId("home-moon-tile")).toHaveTextContent("Luna")
  })

  it("lets two Points copies show different periods", () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => {
      useDashboardStore.getState().updateCopySettings(copyOf("points").id, { period: "day" })
      useDashboardStore.getState().installCopy("points", { settings: { period: "all" } })
    })
    const tiles = screen.getAllByTestId("home-points-tile")
    expect(tiles).toHaveLength(2)
    expect(tiles[0]).toHaveTextContent(/PTS\s*Today/)
    expect(tiles[1]).toHaveTextContent(/PTS\s*All time/)
  })

  it("changes the Day lamp when it reads one bar", () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useDashboardStore.getState().installCopy("daylamp"))
    const before = screen.getByTestId("home-daylamp-tile").textContent
    act(() => useDashboardStore.getState().updateCopySettings(copyOf("daylamp").id, { bars: "habits" }))
    expect(screen.getByTestId("home-daylamp-tile")).toBeInTheDocument()
    // With no habits scheduled the habits-only lamp is Quiet.
    expect(screen.getByTestId("home-daylamp-tile")).toHaveTextContent("Quiet")
    expect(before).toBeTruthy()
  })

  it("hides the footer when Footer line is off", () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useDashboardStore.getState().updateCopy(copyOf("moon").id, { showFoot: false }))
    const cell = document.querySelector('.vd-cell[data-kind="moon"]')!
    expect(cell).toHaveAttribute("data-foot", "off")
  })

  it("dual-writes hide to the old strip", () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useDashboardStore.getState().hideCopy(copyOf("moon").id))
    expect(useHomeWidgetsStore.getState().hidden).toContain("moon")
    expect(screen.queryByTestId("home-moon-tile")).not.toBeInTheDocument()
  })

  it("follows an old caller that shows a hidden kind", () => {
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useHomeWidgetsStore.getState().showWidget("solar"))
    expect(copyOf("solar").hidden).toBe(false)
    expect(screen.getByTestId("home-solar-tile")).toBeInTheDocument()
  })

  it("does not open a detail while edit mode is on, and moves with the keyboard", async () => {
    const user = userEvent.setup()
    render(<HomeOverview currentDate={currentDate} />)
    act(() => useDashboardEditMode.setState({ editing: true }))
    expect(screen.getByTestId("dashboard-edit-banner")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open Moon" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const before = useDashboardStore.getState().milled.order
    const moonCell = document.querySelector('.vd-cell[data-kind="moon"]') as HTMLElement
    moonCell.focus()
    fireEvent.keyDown(moonCell, { key: "ArrowLeft" })
    const after = useDashboardStore.getState().milled.order
    expect(after.indexOf(copyOf("moon").id)).toBeLessThan(before.indexOf(copyOf("moon").id))
  })

  it("resizes with Shift and arrows in edit mode only", () => {
    render(<HomeOverview currentDate={currentDate} />)
    const petCell = () => document.querySelector('.vd-cell[data-kind="pet"]') as HTMLElement
    fireEvent.keyDown(petCell(), { key: "ArrowRight", shiftKey: true })
    expect(useDashboardStore.getState().milled.sizes[copyOf("pet").id]).toBeUndefined()
    act(() => useDashboardEditMode.setState({ editing: true }))
    fireEvent.keyDown(petCell(), { key: "ArrowRight", shiftKey: true })
    expect(useDashboardStore.getState().milled.sizes[copyOf("pet").id]).toBeDefined()
  })

  it("shows a first-run guide once for a newly installed copy", async () => {
    const user = userEvent.setup()
    render(<HomeOverview currentDate={currentDate} />)
    act(() => {
      useDashboardStore.getState().removeCopy(copyOf("moon").id)
      useDashboardStore.getState().installCopy("moon")
    })
    await user.click(screen.getByRole("button", { name: "Open Moon" }))
    expect(screen.getByTestId("widget-guide")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Skip" }))
    expect(copyOf("moon").guideSeen).toBe(true)
    expect(screen.queryByTestId("widget-guide")).not.toBeInTheDocument()
  })
})
