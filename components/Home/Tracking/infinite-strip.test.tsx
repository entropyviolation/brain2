import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { InfiniteStrip } from "./infinite-strip"

const WED = new Date(2026, 8, 16, 12, 0, 0)

describe("InfiniteStrip", () => {
  beforeEach(() => {
    resetAllStores()
    useTimeTrackingStore.getState().setSelectedPen("act-work")
  })

  it("keeps the date window when you pick a day — origin does not jump", () => {
    const onDateChange = vi.fn()
    const { rerender } = render(
      <InfiniteStrip centerDate={WED} onDateChange={onDateChange} mode="day" />,
    )
    const first = document.querySelector("[data-day-row]")?.getAttribute("data-day-row")
    expect(first).toBeTruthy()

    const gutters = screen.getAllByRole("button").filter((el) => /Sep/.test(el.textContent ?? ""))
    const later = gutters[Math.min(3, gutters.length - 1)]
    fireEvent.click(later)
    expect(onDateChange).toHaveBeenCalled()

    const nextDate = onDateChange.mock.calls[0][0] as Date
    rerender(<InfiniteStrip centerDate={nextDate} onDateChange={onDateChange} mode="day" />)
    expect(document.querySelector("[data-day-row]")?.getAttribute("data-day-row")).toBe(first)
  })

  it("renders week bands without depending on View settings", () => {
    render(<InfiniteStrip centerDate={WED} onDateChange={vi.fn()} mode="week" />)
    expect(document.querySelector("[data-infinite='week']")).toBeTruthy()
    expect(document.querySelector(".trk-week-band-label")).toBeTruthy()
  })

  it("single-clicks a day tile only to highlight — does not open the paged day", () => {
    const onDateChange = vi.fn()
    const onOpenDay = vi.fn()
    render(
      <InfiniteStrip
        centerDate={WED}
        onDateChange={onDateChange}
        onOpenDay={onOpenDay}
        mode="week"
      />,
    )
    const gutter = screen.getAllByRole("button").find((el) => /Sep/.test(el.textContent ?? ""))
    expect(gutter).toBeTruthy()
    fireEvent.click(gutter!)
    expect(onDateChange).toHaveBeenCalledTimes(1)
    expect(onOpenDay).not.toHaveBeenCalled()
  })

  it("double-clicks a day tile to open that paged day", () => {
    const onOpenDay = vi.fn()
    render(
      <InfiniteStrip centerDate={WED} onDateChange={vi.fn()} onOpenDay={onOpenDay} mode="week" />,
    )
    const row = document.querySelector("[data-day-row]") as HTMLElement
    fireEvent.doubleClick(row.querySelector(".trk-day-gutter")!)
    expect(onOpenDay).toHaveBeenCalledTimes(1)
    const opened = onOpenDay.mock.calls[0][0] as Date
    expect(formatLocalDateKey(opened)).toBe(row.getAttribute("data-day-row"))
  })

  it("double-clicks a week band to open that paged week", () => {
    const onOpenWeek = vi.fn()
    render(
      <InfiniteStrip centerDate={WED} onDateChange={vi.fn()} onOpenWeek={onOpenWeek} mode="week" />,
    )
    const band = document.querySelector("[data-week-band]") as HTMLElement
    expect(band).toBeTruthy()
    fireEvent.doubleClick(band)
    expect(onOpenWeek).toHaveBeenCalledTimes(1)
    const opened = onOpenWeek.mock.calls[0][0] as Date
    expect(opened.getDay()).toBe(1)
    expect(formatLocalDateKey(opened)).toBe(band.getAttribute("data-week-band"))
  })

  it("labels sunrise from each row's date, not a single today stamp", () => {
    render(<InfiniteStrip centerDate={WED} onDateChange={vi.fn()} mode="week" />)
    const sep14 = document.querySelector('[data-day-row="2026-09-14"] .trk-marker-sunrise .trk-marker-label')
    const sep21 = document.querySelector('[data-day-row="2026-09-21"] .trk-marker-sunrise .trk-marker-label')
    expect(sep14?.textContent).toMatch(/Sunrise/)
    expect(sep21?.textContent).toMatch(/Sunrise/)
    if (sep14?.textContent === sep21?.textContent) {
      expect(sep14?.closest("[data-day-row]")?.getAttribute("data-day-row")).toBe("2026-09-14")
      expect(sep21?.closest("[data-day-row]")?.getAttribute("data-day-row")).toBe("2026-09-21")
    } else {
      expect(sep14?.textContent).not.toBe(sep21?.textContent)
    }
  })
})
