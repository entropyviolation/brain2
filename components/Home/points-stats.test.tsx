import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import { PointsStats } from "./points-stats"

describe("PointsStats", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
    usePointsStore.getState().addPoints("task-1", 42, "Test task", currentDate)
  })

  it("renders all four points summary cards", () => {
    render(<PointsStats currentDate={currentDate} />)
    expect(screen.getByText("All Time Points")).toBeInTheDocument()
    expect(screen.getByText("Today's Points")).toBeInTheDocument()
    expect(screen.getByText("This Week")).toBeInTheDocument()
    expect(screen.getByText("This Month")).toBeInTheDocument()
  })

  it("shows earned points after mount", async () => {
    render(<PointsStats currentDate={currentDate} />)
    const values = await screen.findAllByText("42")
    expect(values).toHaveLength(4)
  })

  it("packs four equal wells on the Habits instrument", async () => {
    const { container } = render(<PointsStats currentDate={currentDate} instrument />)
    expect(container.querySelector(".hab-score-quad")).toBeTruthy()
    expect(container.querySelectorAll(".hab-score-well")).toHaveLength(4)
    expect(container.querySelector(".hab-score-well.is-today")).toBeTruthy()
    expect(container.querySelector(".hab-score-well.is-alltime")).toBeTruthy()
    expect(await screen.findAllByText("42")).toHaveLength(4)
    expect(screen.getByText("Total earned")).toBeInTheDocument()
    for (const node of container.querySelectorAll(".hab-score-readout")) {
      expect(node).toHaveAttribute("data-centered", "true")
    }
  })
})

describe("PointsPeriodsDetail", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
    window.localStorage.removeItem("brain2-home-points-detail-mode")
    usePointsStore.getState().addPoints("task-1", 42, "Test task", currentDate)
    usePointsStore.getState().addPoints("task-0", 8, "Earlier", new Date("2026-06-19T12:00:00"))
  })

  it("draws every period with a New / Cumulative toggle and keeps the possible meter", async () => {
    const { PointsPeriodsDetail } = await import("./points-detail")
    const { container } = render(
      <PointsPeriodsDetail currentDate={currentDate} meters={{ day: { score: "42", sub: "+3 possible", fill: 93 } }} />,
    )
    const periods = [...container.querySelectorAll(".home-points-period")].map((n) => n.getAttribute("data-period"))
    expect(periods).toEqual(["day", "week", "month", "year", "all"])
    expect(screen.getByText("+3 possible")).toBeInTheDocument()

    const day = container.querySelector('[data-period="day"]') as HTMLElement
    expect(day.querySelector(".home-points-quote strong")?.textContent).toBe("42")
    const cumulative = day.querySelector('button[aria-pressed="false"]') as HTMLButtonElement
    expect(cumulative.textContent).toBe("Cumulative")
    cumulative.click()
    await screen.findAllByText("50")
    expect(day.querySelector(".home-points-line")).toBeTruthy()
    expect(window.localStorage.getItem("brain2-home-points-detail-mode")).toContain("cumulative")
  })
})
