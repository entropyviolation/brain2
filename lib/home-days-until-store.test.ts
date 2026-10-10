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

  it("keeps one empty item when the last countdown is removed", () => {
    const id = useHomeDaysUntilStore.getState().items[0]!.id
    useHomeDaysUntilStore.getState().removeCountdown(id)
    expect(useHomeDaysUntilStore.getState().items).toHaveLength(1)
    expect(useHomeDaysUntilStore.getState().items[0]?.label).toBe("")
  })
})
