import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { PercentLed } from "./percent-led"

describe("PercentLed", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("maps the same rounded percent the old bars used", () => {
    render(<PercentLed value={46.4} label="row" />)
    const meter = screen.getByRole("meter", { name: "row 46%" })
    expect(meter).toHaveAttribute("aria-valuenow", "46")
    expect(meter).toHaveStyle({ "--hab-led-tint": "#7e14ff" })
  })

  it("uses the stored tint", () => {
    useHabitsStore.getState().setPercentLedTint("#ff8800")
    render(<PercentLed value={100} />)
    expect(screen.getByRole("meter")).toHaveStyle({ "--hab-led-tint": "#ff8800" })
  })
})
