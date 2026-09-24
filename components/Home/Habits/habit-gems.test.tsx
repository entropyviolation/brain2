import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HabitRowGem, HabitWeekSparkline } from "./habit-gems"

describe("HabitWeekSparkline", () => {
  it("draws a green phosphor trace and a last-point crosshair", () => {
    const { container } = render(
      <HabitWeekSparkline values={[10, 40, 20, 80]} label="week percents 10, 40, 20, 80" />,
    )
    const svg = container.querySelector("svg.hab-sparkline")
    expect(svg).toBeTruthy()
    const strokes = [...container.querySelectorAll("polyline")].map((el) => el.getAttribute("stroke"))
    expect(strokes).toContain("#5cff9a")
    expect(strokes).not.toContain("#1d4f8a")
    expect(container.querySelector(".hab-spark-crosshair")).toBeTruthy()
  })
})

describe("HabitRowGem", () => {
  it("lazy-decodes catalog photos so the grid can paint first", () => {
    const { container } = render(
      <HabitRowGem task={{ gem: "/gems-removebackground/gem.png" }} />,
    )
    const img = container.querySelector("img.habit-gem") as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute("loading")).toBe("lazy")
    expect(img.getAttribute("decoding")).toBe("async")
    expect(img.getAttribute("width")).toBe("18")
  })
})
