import { render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { MorningReviewDialog } from "./MorningReview"

/** Thursday 17 September 2026. */
const TODAY = new Date(2026, 8, 17, 9, 0, 0)
const MORNING = "2026-09-17"
const EVENING = "2026-09-16"

const bedtimeField = () => screen.getByLabelText("Fell asleep") as HTMLInputElement
const wakeField = () => screen.getByLabelText("Wake time") as HTMLInputElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  resetAllStores()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("MorningReviewDialog", () => {
  it("shows the night already logged elsewhere", () => {
    useSleepStore.setState({ nights: { [MORNING]: { date: MORNING, sleptMin: -45, wokeMin: 420 } } })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("23:15")
    expect(wakeField().value).toBe("07:00")
  })

  it("picks up a night logged after it was mounted", () => {
    // The dialog is mounted closed at app load, so reading the store once at
    // construction would leave it permanently blank.
    const { rerender } = render(<MorningReviewDialog open={false} onClose={() => {}} date={TODAY} />)
    useSleepStore.setState({ nights: { [MORNING]: { date: MORNING, sleptMin: -45, wokeMin: 420 } } })
    rerender(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("23:15")
  })

  it("opens pre-filled from sleep painted on the grid", () => {
    useTimeTrackingStore.setState({
      entries: [
        { id: "e1", date: EVENING, scopeId: "activity", penId: "act-sleep", startMin: 1350, endMin: 1440 },
        { id: "e2", date: MORNING, scopeId: "activity", penId: "act-sleep", startMin: 0, endMin: 435 },
      ],
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    expect(bedtimeField().value).toBe("22:30")
    expect(wakeField().value).toBe("07:15")
  })

  it("writes the night through to the sleep log on save", () => {
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    fireEvent.change(bedtimeField(), { target: { value: "23:30" } })
    fireEvent.change(wakeField(), { target: { value: "07:00" } })
    fireEvent.click(screen.getByRole("button", { name: /Save Morning Review/ }))

    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
  })

  it("lets a stated time override what the grid shows", () => {
    useTimeTrackingStore.setState({
      entries: [{ id: "e1", date: EVENING, scopeId: "activity", penId: "act-sleep", startMin: 1350, endMin: 1440 }],
    })
    render(<MorningReviewDialog open onClose={() => {}} date={TODAY} />)

    fireEvent.change(bedtimeField(), { target: { value: "00:30" } })
    fireEvent.change(wakeField(), { target: { value: "07:00" } })
    fireEvent.click(screen.getByRole("button", { name: /Save Morning Review/ }))

    expect(useSleepStore.getState().nights[MORNING]?.sleptMin).toBe(30)
  })
})
