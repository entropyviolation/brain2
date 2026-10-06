import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { HabitHeatmap, heatmapCellFill, heatmapColumnBand } from "./habit-heatmap"

describe("heatmapCellFill", () => {
  it("stays in one mint family and leaves empty quiet", () => {
    expect(heatmapCellFill(0)).toBe("transparent")
    expect(heatmapCellFill(1)).toBe("#6f9e98")
    expect(heatmapCellFill(0.5)).toBe("#afc7c4")
    expect(heatmapCellFill(0.2)).toBe("#d7e6e4")
    expect(heatmapCellFill(1)).not.toMatch(/linear-gradient|#8b7ecc|#571833/i)
  })
})

describe("heatmapColumnBand", () => {
  it("keeps every column that intersects the scrollport, including the left edge", () => {
    const cell = 20
    const gap = 6
    const label = 160
    const pitch = cell + gap
    const origin = label + gap
    const samples = [
      [0, 200, 42],
      [306, 946, 42],
      [400, 200, 98],
      [728, 946, 70],
      [1034, 946, 70],
      [1500, 946, 120],
      [2000, 800, 200],
    ] as const
    for (const [scrollLeft, clientWidth, count] of samples) {
      const band = heatmapColumnBand(scrollLeft, clientWidth, count, { cell, gap, label })
      let first = count
      let last = -1
      for (let i = 0; i < count; i++) {
        const left = origin + i * pitch
        const right = left + cell
        if (right > scrollLeft && left < scrollLeft + clientWidth) {
          first = Math.min(first, i)
          last = Math.max(last, i)
        }
      }
      expect(band.start).toBeGreaterThanOrEqual(0)
      expect(band.end).toBeLessThanOrEqual(count)
      if (last < 0) continue
      expect(band.start).toBeLessThanOrEqual(first)
      expect(band.end).toBeGreaterThan(last)
    }
  })

  it("paints the whole span when the scroller has no width", () => {
    expect(heatmapColumnBand(1200, 0, 80)).toEqual({ start: 0, end: 80 })
  })
})

describe("HabitHeatmap", () => {
  it("renders a named row of completion squares", () => {
    const date = new Date(2026, 8, 16)
    render(
      <HabitHeatmap
        tasks={[{ id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, frequency: "daily" }]}
        data={{ [formatLocalDateKey(date)]: { stretch: { completed: true } } }}
        asOf={date}
        frequency="daily"
        onEditTask={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /Stretch/ })).toBeInTheDocument()
    const heat = screen.getByLabelText("Habit heatmap")
    expect(heat).toBeInTheDocument()
    expect(heat.className).toContain("habit-heat")
    expect(heat.querySelector(".habit-heat-cell")).toBeTruthy()
    expect(heat.querySelector(".habit-heat-cell.is-full")).toBeTruthy()
    const grid = heat.querySelector(".habit-heat-grid") as HTMLElement
    expect(grid.style.gridTemplateColumns).toMatch(/10rem/)
    expect(grid.style.gridTemplateColumns).toMatch(/14px/)
  })

  it("updates the column window once per frame and still grows history at the left edge", async () => {
    const queued: { id: number; cb: FrameRequestCallback }[] = []
    let seq = 0
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = ++seq
      queued.push({ id, cb })
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      const index = queued.findIndex((frame) => frame.id === id)
      if (index >= 0) queued.splice(index, 1)
    })
    const date = new Date(2026, 8, 16)
    render(
      <HabitHeatmap
        tasks={[{ id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, frequency: "daily" }]}
        data={{}}
        asOf={date}
        frequency="daily"
        onEditTask={() => {}}
      />,
    )
    const scroller = document.querySelector(".habit-heat-scroll") as HTMLDivElement
    const grid = () => document.querySelector(".habit-heat-grid") as HTMLElement
    const columnsOf = () => Number(grid().style.gridTemplateColumns.match(/repeat\((\d+)/)?.[1] ?? 0)
    expect(columnsOf()).toBe(42)

    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 })
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 2000 })
    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)
    fireEvent.scroll(scroller)
    expect(queued).toHaveLength(1)

    await act(async () => {
      queued.shift()?.cb(0)
    })
    expect(columnsOf()).toBe(70)
    expect(scroller.scrollLeft).toBe(0)

    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)
    await act(async () => {
      queued.shift()?.cb(0)
    })
    expect(columnsOf()).toBe(98)
    const spanned = () =>
      [...document.querySelectorAll(".habit-heat-grid > div")].map((el) => (el as HTMLElement).style.gridColumn)
    const rested = heatmapColumnBand(0, 200, 98)
    expect(rested.start).toBe(0)
    expect(spanned()).toContain(`span ${98 - rested.end}`)

    scroller.scrollLeft = 400
    fireEvent.scroll(scroller)
    await act(async () => {
      queued.shift()?.cb(0)
    })
    expect(columnsOf()).toBe(98)
    const moved = heatmapColumnBand(400, 200, 98)
    expect(moved.start).toBeGreaterThan(0)
    expect(document.querySelectorAll(".habit-heat-head")).toHaveLength(moved.end - moved.start)
    expect(spanned()).toContain(`span ${moved.start}`)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
