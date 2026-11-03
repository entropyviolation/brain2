/**
 * components/Home/Tracking/tracking-log/tracking-log-week.test.tsx
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { useKitchenStore } from "@/lib/kitchen-store"
import { OPEN_ITEM_POPUP_EVENT } from "@/lib/points-ledger-nav"
import { trackingItemId } from "@/lib/tracking-lists"
import { submitTrackingLog } from "../tracking-log-model"
import { TrackingLogWeek } from "./tracking-log-week"

function openedIdsDuring(run: () => void): string[] {
  const opened: string[] = []
  const onOpen = (event: Event) => {
    opened.push((event as CustomEvent<{ id: string }>).detail.id)
  }
  window.addEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)
  run()
  window.removeEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)
  return opened
}

describe("TrackingLogWeek", () => {
  const currentDate = new Date(2026, 5, 17, 12, 0, 0) // Wednesday
  const weekDates = getWeekDates(getWeekStartDate(currentDate))

  beforeEach(() => {
    resetAllStores()
  })

  it("renders seven day columns for the week of the selected date", () => {
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByTestId("tracking-log-week")).toBeInTheDocument()
    for (const date of weekDates) {
      expect(screen.getByRole("button", { name: `Open ${format(date, "EEEE, MMM d")}` })).toBeInTheDocument()
    }
  })

  it("calls onOpenDay when a day heading is activated", () => {
    const onOpenDay = vi.fn()
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={onOpenDay}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole("button", { name: `Open ${format(weekDates[2], "EEEE, MMM d")}` }))
    expect(onOpenDay).toHaveBeenCalledTimes(1)
    expect(formatLocalDateKey(onOpenDay.mock.calls[0]![0])).toBe(formatLocalDateKey(weekDates[2]!))
  })

  it("places log rows on the correct day column", () => {
    const monday = weekDates[0]!
    const tuesday = weekDates[1]!
    submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "oatmeal",
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute: 8 * 60,
    })
    submitTrackingLog({
      date: formatLocalDateKey(tuesday),
      title: "left room",
      mode: "event",
      clock: "exact",
      minute: 10 * 60,
    })

    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    const mondayCol = screen.getByLabelText(`Log for ${format(monday, "EEEE, MMM d")}`)
    const tuesdayCol = screen.getByLabelText(`Log for ${format(tuesday, "EEEE, MMM d")}`)
    expect(within(mondayCol).getByText("oatmeal")).toBeInTheDocument()
    expect(within(mondayCol).getByText("Food")).toBeInTheDocument()
    expect(within(tuesdayCol).getByText("left room")).toBeInTheDocument()
    expect(within(tuesdayCol).getByText("Event")).toBeInTheDocument()
    expect(within(mondayCol).queryByText("left room")).not.toBeInTheDocument()
  })

  it("marks the today column from the wall clock", () => {
    const today = new Date()
    const weekOfToday = getWeekDates(getWeekStartDate(today))
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={today}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    const todayKey = formatLocalDateKey(today)
    const todayHead = screen.getByRole("button", {
      name: `Open ${format(
        weekOfToday.find((d) => formatLocalDateKey(d) === todayKey) ?? today,
        "EEEE, MMM d",
      )}`,
    })
    expect(todayHead).toHaveAttribute("data-today", "true")
  })

  it("opens the log item when a known-clock row is clicked", () => {
    const monday = weekDates[0]!
    const id = submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "coffee",
      mode: "intake",
      intakeClass: "drink",
      clock: "exact",
      minute: 9 * 60,
    })

    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    const opened = openedIdsDuring(() => {
      fireEvent.click(screen.getByRole("button", { name: /coffee/ }))
    })
    expect(opened).toEqual([trackingItemId(id!)])
  })

  it("shows texts to BIM in their day column, even a link that made no tracking row", () => {
    useTelegramFeedStore.setState({
      rows: [
        {
          id: "tg:99:1",
          at: new Date(2026, 5, 17, 9, 5, 0).toISOString(),
          chatId: "99",
          text: "https://www.instagram.com/reel/abc/",
          outcome: { kind: "link", status: "applied", summary: "Saved link" },
          recordedAt: new Date(2026, 5, 17, 9, 5, 0).toISOString(),
          origin: "live",
        },
        {
          id: "tg:99:2",
          at: new Date(2026, 5, 20, 22, 0, 0).toISOString(),
          chatId: "99",
          text: "Saturday thought",
          recordedAt: new Date(2026, 5, 20, 22, 0, 0).toISOString(),
          origin: "live",
        },
      ],
    })
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )
    const wed = screen.getByLabelText("Log for Wednesday, Jun 17")
    expect(within(wed).getByText("https://www.instagram.com/reel/abc/")).toBeInTheDocument()
    expect(within(wed).getByText("→ Inbox link")).toBeInTheDocument()
    const sat = screen.getByLabelText("Log for Saturday, Jun 20")
    expect(within(sat).getByText("Saturday thought")).toBeInTheDocument()
  })

  it("shows accepted-plate calories and opens the log item from a food row", () => {
    const monday = weekDates[0]!
    const onOpenFood = vi.fn()
    const id = submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "oatmeal",
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute: 8 * 60,
    })
    useKitchenStore.getState().savePlate({
      entryId: id!,
      accepted: true,
      slot: "meal",
      mode: "single",
      lines: [{ foodId: "cat_banana", grams: 100 }],
      fromKitchen: false,
      where: "home",
    })
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
          onOpenFood={onOpenFood}
        />
      </div>,
    )
    expect(screen.getByText("89 kcal · Home")).toBeInTheDocument()
    const opened = openedIdsDuring(() => {
      fireEvent.click(screen.getByRole("button", { name: /oatmeal/ }))
    })
    expect(opened).toEqual([trackingItemId(id!)])
    expect(onOpenFood).not.toHaveBeenCalled()
  })

  it("keeps Open food on an unknown-clock food row", () => {
    const monday = weekDates[0]!
    const onOpenFood = vi.fn()
    submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "late snack",
      mode: "intake",
      intakeClass: "food",
      clock: "unknown",
      minute: 0,
    })
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onRemoveEntry={vi.fn()}
          onOpenFood={onOpenFood}
        />
      </div>,
    )
    const opened = openedIdsDuring(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open food" }))
    })
    expect(onOpenFood).toHaveBeenCalledTimes(1)
    expect(opened).toEqual([])
  })
})
