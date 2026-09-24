import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { cellPaintClass, trackingProbeText, TrkChromeStack, TrkLatchesWell, TrkPenToolsRow, TrkPlotBezel, TrkRibbon } from "./trk-instrument"
import "./tracking-chrome.css"

describe("tracking instrument chrome", () => {
  it("formats a CRT probe from occupancy facts", () => {
    expect(
      trackingProbeText({
        minute: 9 * 60,
        step: 15,
        name: "Computer Work",
        leafName: "Email",
        assumed: true,
        secondaries: ["Home"],
      }),
    ).toBe("9:00 AM–9:15 AM · Computer Work · Email · assumed · also Home")
  })

  it("marks painted cells with optional spark", () => {
    expect(cellPaintClass({ painted: true, quarter: true, spark: true })).toContain("trk-cell-painted")
    expect(cellPaintClass({ painted: true, quarter: true, spark: true })).toContain("trk-cell-spark")
    expect(cellPaintClass({ painted: false })).toBe("trk-cell")
  })

  it("draws painted cells with a left hairline, not a four-side inset", () => {
    const wrap = document.createElement("div")
    wrap.className = "trk95"
    wrap.innerHTML = `
      <div class="trk-cell"></div>
      <div class="trk-cell trk-cell-painted"></div>
      <div class="trk-cell trk-cell-painted trk-cell-quarter"></div>
    `
    document.body.appendChild(wrap)
    const [empty, painted, quarter] = [...wrap.children] as HTMLElement[]
    const emptyShadow = getComputedStyle(empty).boxShadow
    const paintedShadow = getComputedStyle(painted).boxShadow
    const quarterShadow = getComputedStyle(quarter).boxShadow
    expect(emptyShadow).toMatch(/inset 1px 0(?:px)? 0(?:px)?/)
    expect(paintedShadow).toMatch(/inset 1px 0(?:px)? 0(?:px)?/)
    expect(paintedShadow).not.toMatch(/inset 0(?:px)? 0(?:px)? 0(?:px)? 1px/)
    expect(quarterShadow).toMatch(/inset 1px 0(?:px)? 0(?:px)?/)
    expect(quarterShadow).not.toMatch(/inset 0(?:px)? 0(?:px)? 0(?:px)? 1px/)
    const alpha = (s: string) =>
      Number(/\/\s*([0-9.]+)\)/.exec(s)?.[1] ?? /rgba?\([^)]+,\s*([0-9.]+)\)/.exec(s)?.[1] ?? 1)
    expect(alpha(paintedShadow)).toBeLessThan(alpha(emptyShadow))
    wrap.remove()
  })

  it("places a Look well for view latches, separate from the paint rail", () => {
    render(
      <div className="trk95">
        <div className="trk-toolbar-row">
          <TrkLatchesWell>
            <button type="button" className="trk-tool-key">
              Hide
            </button>
          </TrkLatchesWell>
        </div>
        <TrkPenToolsRow
          pens={<span>pens</span>}
          tools={<div className="trk-tools-tray">tools</div>}
        />
      </div>,
    )
    const well = document.querySelector(".trk-latches-well")
    const rail = document.querySelector(".trk-tools-rail")
    expect(well).toHaveTextContent("Look")
    expect(well).toHaveTextContent("Hide")
    expect(well?.closest(".trk-toolbar-row")).toBeTruthy()
    expect(rail?.contains(well)).toBe(false)
    expect(document.querySelector(".trk-tools-tray")?.contains(well as Node)).toBe(false)
  })

  it("places the tools rail as the next sibling of the pen tray", () => {
    render(
      <div className="trk95">
        <TrkPenToolsRow
          pens={<span>pens</span>}
          tools={<div className="trk-tools-tray">tools</div>}
        />
      </div>,
    )
    const row = document.querySelector(".trk-pen-tools-row")
    const tray = document.querySelector(".trk-pen-tray")
    const rail = document.querySelector(".trk-tools-rail")
    const tools = document.querySelector(".trk-tools-tray")
    expect(row?.lastElementChild).toBe(rail)
    expect(tray?.nextElementSibling).toBe(rail)
    expect(rail?.contains(tools)).toBe(true)
    expect(getComputedStyle(rail as HTMLElement).marginLeft).toBe("auto")
    expect(tray).toHaveTextContent("pens")
    expect(tools).toHaveTextContent("tools")
  })

  it("stacks pens, then view modes, then the plot", () => {
    render(
      <div className="trk95">
        <TrkChromeStack
          pens={<div className="trk-pen-tools-row">pens</div>}
          modeBar={<div className="trk-mode-bar" role="toolbar" aria-label="Tracking view modes">modes</div>}
        >
          <div className="trk-desktop">plot</div>
        </TrkChromeStack>
      </div>,
    )
    const stack = document.querySelector(".trk-chrome-stack")
    const tray = stack?.querySelector(".trk-pen-tools-row")
    const mode = stack?.querySelector(".trk-mode-bar")
    const plot = stack?.querySelector(".trk-desktop")
    expect(stack?.firstElementChild).toBe(tray)
    expect(tray?.nextElementSibling).toBe(mode)
    expect(mode?.nextElementSibling).toBe(plot)
    expect(stack?.querySelector(".trk-grid-rail")).toBeNull()
  })

  it("sits Log activity on the grid rail with view modes, above the plot", () => {
    render(
      <div className="trk95">
        <TrkChromeStack
          pens={<div className="trk-pen-tools-row">pens</div>}
          modeBar={<div className="trk-mode-bar" role="toolbar" aria-label="Tracking view modes">modes</div>}
          gridAction={
            <button type="button" className="trk-latch trk-latch-log">
              Log activity
            </button>
          }
        >
          <div className="trk-desktop">plot</div>
        </TrkChromeStack>
      </div>,
    )
    const stack = document.querySelector(".trk-chrome-stack")
    const tray = stack?.querySelector(".trk-pen-tools-row")
    const rail = stack?.querySelector(".trk-grid-rail")
    const mode = stack?.querySelector(".trk-mode-bar")
    const log = screen.getByRole("button", { name: /Log activity/ })
    const plot = stack?.querySelector(".trk-desktop")
    expect(tray?.nextElementSibling).toBe(rail)
    expect(rail).toContainElement(mode as HTMLElement)
    expect(rail).toContainElement(log)
    expect(log.closest(".trk-mode-bar")).toBeNull()
    expect(rail?.nextElementSibling).toBe(plot)
  })

  it("omits the pen tray when showPens is false and still pins the tools rail right", () => {
    render(
      <div className="trk95">
        <TrkPenToolsRow
          showPens={false}
          pens={<span>pens</span>}
          tools={<div className="trk-tools-tray">tools</div>}
        />
      </div>,
    )
    const row = document.querySelector(".trk-pen-tools-row")
    const spacer = document.querySelector(".trk-pen-tools-spacer")
    const rail = document.querySelector(".trk-tools-rail")
    const tools = document.querySelector(".trk-tools-tray")
    expect(document.querySelector(".trk-pen-tray")).toBeNull()
    expect(spacer).toBeTruthy()
    expect(row?.lastElementChild).toBe(rail)
    expect(spacer?.nextElementSibling).toBe(rail)
    expect(rail?.contains(tools)).toBe(true)
    expect(getComputedStyle(rail as HTMLElement).marginLeft).toBe("auto")
    expect(tools).toHaveTextContent("tools")
  })

  it("renders a day ribbon from the same pen totals", () => {
    render(
      <div className="trk95">
        <TrkRibbon
          pens={[{ id: "w", name: "Work", color: "#36c", minutes: 120, percentOfTracked: 50, percentOfPeriod: 8 }]}
          untracked={1320}
          coverage={8}
        />
      </div>,
    )
    expect(screen.getByText("Work:")).toBeInTheDocument()
    expect(screen.getByText("2h")).toBeInTheDocument()
    expect(screen.getByText(/untracked:/i)).toBeInTheDocument()
    expect(document.querySelector(".trk-occ-pct")?.textContent).toBe("8%")
    expect(document.querySelector(".trk-ribbon-void")).toBeTruthy()
  })

  it("wraps the plot strip and a growing region", () => {
    render(
      <div className="trk95">
        <TrkPlotBezel strip={<span data-testid="strip-well">TIME</span>}>
          <div className="trk-grid trk-grid-full-day">paper</div>
        </TrkPlotBezel>
      </div>,
    )
    const bezel = document.querySelector(".trk-plot-bezel") as HTMLElement
    const strip = document.querySelector(".trk-plot-strip") as HTMLElement
    const region = document.querySelector(".trk-plot-region") as HTMLElement
    expect(strip).toHaveTextContent("TIME")
    expect(region).toHaveTextContent("paper")
    expect(bezel.firstElementChild).toBe(strip)
    expect(getComputedStyle(region).flexGrow).toBe("1")
    expect(getComputedStyle(region).minWidth).toBe("0px")
  })
})
