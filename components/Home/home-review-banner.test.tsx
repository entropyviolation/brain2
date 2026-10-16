import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import * as rituals from "@/lib/rituals"
import * as starLord from "@/lib/star-lord"
import type { RitualSlot } from "@/lib/rituals"
import type { RitualTodoPlacement } from "@/lib/ritual-todo"
import { HomeReviewBanner } from "./home-review-banner"

vi.mock("@/components/Reviews/RitualWalkDialog", () => ({
  RitualWalkDialog: ({ placement, onClose }: { placement: RitualTodoPlacement | null; onClose: () => void }) =>
    placement ? (
      <div role="dialog" aria-label="Rite" data-walk={JSON.stringify(placement.walk)}>
        <button type="button" onClick={onClose}>
          Close rite
        </button>
      </div>
    ) : null,
}))

const night: RitualSlot = {
  id: "day-night:2026-06-20",
  kind: "day-night",
  period: "day",
  phase: "end",
  dayRole: "night",
  periodKey: "2026-06-20",
  title: "Night",
  periodTitle: "Saturday, June 20",
  status: "none",
  telegramCommand: "gn",
  appPath: "Header → Rituals → Day → moon",
}

const weekStart: RitualSlot = {
  id: "week-start:2026-06-15",
  kind: "period-start",
  period: "week",
  phase: "start",
  periodKey: "2026-06-15_2026-06-21",
  title: "Start",
  periodTitle: "Week of June 15",
  status: "none",
  telegramCommand: "ritual start week",
  appPath: "Header → Rituals → Week → Start",
}

async function riteWalk() {
  const rite = await screen.findByRole("dialog", { name: "Rite" })
  return JSON.parse(rite.getAttribute("data-walk") ?? "null")
}

describe("HomeReviewBanner", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders nothing when no rituals are available", () => {
    vi.spyOn(rituals, "countAvailableRituals").mockReturnValue(0)
    vi.spyOn(rituals, "listAvailableRituals").mockReturnValue([])

    render(<HomeReviewBanner currentDate={currentDate} />)
    expect(screen.queryByText("Rituals due")).not.toBeInTheDocument()
  })

  it("Open ritual opens the first rite itself, not the header door", async () => {
    const user = userEvent.setup()
    const onStartReview = vi.fn()
    const door = document.createElement("button")
    door.setAttribute("data-rituals-entry", "")
    const doorClick = vi.fn()
    door.addEventListener("click", doorClick)
    document.body.appendChild(door)
    vi.spyOn(rituals, "countAvailableRituals").mockReturnValue(1)
    vi.spyOn(rituals, "listAvailableRituals").mockReturnValue([night])
    render(<HomeReviewBanner currentDate={currentDate} onStartReview={onStartReview} />)

    expect(screen.getByText("Rituals due")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open ritual" }))

    expect(await riteWalk()).toEqual({ type: "end", period: "day", periodKey: "2026-06-20" })
    expect(doorClick).not.toHaveBeenCalled()
    expect(onStartReview).not.toHaveBeenCalled()
    door.remove()
  })

  it("Open in the detail view closes the detail and opens that row's rite", async () => {
    const user = userEvent.setup()
    vi.spyOn(rituals, "countAvailableRituals").mockReturnValue(2)
    vi.spyOn(rituals, "listAvailableRituals").mockReturnValue([night, weekStart])
    render(<HomeReviewBanner currentDate={currentDate} tile />)

    await user.click(screen.getByRole("button", { name: "Open Rituals" }))
    const detail = await screen.findByRole("dialog", { name: "Rituals" })
    const opens = detail.querySelectorAll("button.home-review-key")
    expect(opens).toHaveLength(2)
    await user.click(opens[1] as HTMLButtonElement)

    expect(await riteWalk()).toEqual({ type: "start", period: "week", periodKey: "2026-06-15_2026-06-21" })
    expect(screen.queryByRole("dialog", { name: "Rituals" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close rite" }))
    expect(screen.queryByRole("dialog", { name: "Rite" })).not.toBeInTheDocument()
  })

  it("Open on a Star Lord row opens the Star Lord rite", async () => {
    const user = userEvent.setup()
    vi.spyOn(rituals, "countAvailableRituals").mockReturnValue(0)
    vi.spyOn(rituals, "listAvailableRituals").mockReturnValue([])
    vi.spyOn(starLord, "listAvailableStarLordSlots").mockReturnValue([
      {
        id: "star-lord:full:2026-06-20",
        kind: "full",
        dateKey: "2026-06-20",
        title: "Star Lord Report",
        periodTitle: "Full moon",
        status: "none",
        telegramCommand: "rituals",
        appPath: "Header → Rituals → Star Lord",
      },
    ])
    render(<HomeReviewBanner currentDate={currentDate} tile />)

    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(await riteWalk()).toEqual({ type: "star-lord", occasion: "full", dateKey: "2026-06-20" })
  })

  it("hides the banner when dismissed", async () => {
    const user = userEvent.setup()
    render(<HomeReviewBanner currentDate={currentDate} />)

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Rituals due")).not.toBeInTheDocument()
  })
})
