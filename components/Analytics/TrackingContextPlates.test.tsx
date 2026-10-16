import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { CompanyHeadcountPlate, LevelLadderPlate } from "./TrackingContextPlates"

const day = "2026-10-15"
const block = (over: Partial<TimeEntry>): TimeEntry => ({
  id: Math.random().toString(36).slice(2),
  date: day,
  scopeId: "location",
  penId: "ob",
  startMin: 600,
  endMin: 660,
  ...over,
})

describe("LevelLadderPlate", () => {
  const location: TrackScope = {
    id: "location",
    name: "Location",
    pens: [
      { id: "usa", name: "USA", color: "#111", levelId: "lvl-country" },
      { id: "sd", name: "San Diego", color: "#333", parentId: "usa", levelId: "lvl-city" },
      { id: "ob", name: "Ocean Beach", color: "#444", parentId: "sd", levelId: "lvl-neighborhood" },
    ],
  }
  it("reads a view by named level, with the missing rung honest", () => {
    render(<LevelLadderPlate scope={location} entries={[block({})]} />)
    const plate = screen.getByTestId("level-ladder")
    expect(within(plate).getByText("Country")).toBeInTheDocument()
    expect(within(plate).getByText("Neighborhood")).toBeInTheDocument()
    expect(within(plate).getByRole("button", { name: /San Diego/ })).toBeInTheDocument()
    expect(within(plate).getByRole("button", { name: /No state/ })).toBeInTheDocument()
  })

  it("stays out of the way when no pen sits on a level", () => {
    const { container } = render(
      <LevelLadderPlate scope={{ id: "mood", name: "Mood", pens: [{ id: "m", name: "Good", color: "#0f0" }] }} entries={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("CompanyHeadcountPlate", () => {
  it("splits time alone from time with people and lists who", () => {
    const scopes: TrackScope[] = [
      {
        id: "company",
        name: "Company",
        pens: [
          { id: "co-alone", name: "Alone", color: "#000" },
          { id: "eli", name: "Elijah", color: "#222" },
        ],
      },
      { id: "activity", name: "Activity", pens: [{ id: "read", name: "Reading", color: "#555" }] },
    ]
    render(
      <CompanyHeadcountPlate
        scopes={scopes}
        dateKeys={[day]}
        rangeLabel="this week"
        entries={[
          block({ scopeId: "company", penId: "co-alone", startMin: 0, endMin: 90 }),
          block({ scopeId: "company", penId: "eli", startMin: 90, endMin: 120 }),
          block({ scopeId: "activity", penId: "read", startMin: 0, endMin: 90 }),
        ]}
      />,
    )
    const plate = screen.getByTestId("company-headcount")
    expect(within(plate).getByText("75%")).toBeInTheDocument()
    expect(within(plate).getAllByText("With 1 person").length).toBeGreaterThan(0)
    expect(within(plate).getByText("Most time with")).toBeInTheDocument()
    expect(within(plate).getByText("Reading")).toBeInTheDocument()
  })
})
