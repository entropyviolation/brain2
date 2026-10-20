import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  DEFAULT_DAYS_UNTIL_ID,
  sanitizeHomeDaysUntilItems,
  useHomeDaysUntilStore,
} from "@/lib/home-days-until-store"

describe("home-days-until-store", () => {
  beforeEach(() => {
    resetLocalStorage()
    useHomeDaysUntilStore.setState({
      items: sanitizeHomeDaysUntilItems(undefined),
    })
  })

  it("migrates a v2 flat countdown into one auto item", () => {
    const items = sanitizeHomeDaysUntilItems({
      label: "Elijah Comes Home",
      date: "2026-09-28",
      time: "",
      format: "unit",
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: DEFAULT_DAYS_UNTIL_ID,
      label: "Elijah Comes Home",
      date: "2026-09-28",
      mode: "auto",
      scheduleAllDay: false,
    })
  })

  it("adds and updates many countdowns", () => {
    useHomeDaysUntilStore.getState().setCountdown({
      label: "Launch",
      date: "2027-06-01",
      mode: "countdown",
    })
    const second = useHomeDaysUntilStore.getState().addCountdown({
      label: "Since trip",
      date: "2026-01-01",
      mode: "countup",
    })
    expect(useHomeDaysUntilStore.getState().items).toHaveLength(2)
    useHomeDaysUntilStore.getState().updateCountdown(second, { scheduleAllDay: true })
    expect(useHomeDaysUntilStore.getState().items.find((item) => item.id === second)?.scheduleAllDay).toBe(
      true,
    )
  })

  it("removes the last countdown, and a saved empty list stays empty", () => {
    const id = useHomeDaysUntilStore.getState().items[0]!.id
    useHomeDaysUntilStore.getState().removeCountdown(id)
    expect(useHomeDaysUntilStore.getState().items).toHaveLength(0)
    expect(sanitizeHomeDaysUntilItems({ items: [] })).toEqual([])
    expect(sanitizeHomeDaysUntilItems(undefined)).toHaveLength(1)
  })

  it("keeps the Countdown fields and reads unknown formats as units", () => {
    const [item] = sanitizeHomeDaysUntilItems({
      items: [{ id: "a", date: "2026-12-25", format: "sleeps", repeat: "yearly", start: "2026-12-01", milestones: true, whenPassed: "hide" }],
    })
    expect(item).toMatchObject({ format: "sleeps", repeat: "yearly", start: "2026-12-01", milestones: true, whenPassed: "hide" })
    expect(sanitizeHomeDaysUntilItems({ items: [{ id: "b", format: "fortnights" }] })[0]!.format).toBe("unit")
  })
})
