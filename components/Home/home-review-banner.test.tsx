import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import * as rituals from "@/lib/rituals"
import { HomeReviewBanner } from "./home-review-banner"

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

  it("shows rituals banner and opens the first available end ritual", async () => {
    const user = userEvent.setup()
    const onStartReview = vi.fn()
    vi.spyOn(rituals, "countAvailableRituals").mockReturnValue(1)
    vi.spyOn(rituals, "listAvailableRituals").mockReturnValue([
      {
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
      },
    ])
    render(<HomeReviewBanner currentDate={currentDate} onStartReview={onStartReview} />)

    expect(screen.getByText("Rituals due")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open ritual" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open ritual" }))
    expect(onStartReview).toHaveBeenCalledWith("day", "2026-06-20")
  })

  it("hides the banner when dismissed", async () => {
    const user = userEvent.setup()
    render(<HomeReviewBanner currentDate={currentDate} />)

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Rituals due")).not.toBeInTheDocument()
  })
})
