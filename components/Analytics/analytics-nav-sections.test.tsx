import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AnalyticsNav } from "./AnalyticsNav"
import { useTextsNavStore } from "@/lib/texts-report-nav"

describe("AnalyticsNav texts sections", () => {
  it("lists the report's sections under Views and jumps on click", () => {
    const goto = vi.fn()
    useTextsNavStore.setState({ sections: [{ id: "volume", label: "Volume" }, { id: "calls", label: "Calls" }], active: "calls", goto })
    render(<AnalyticsNav tab="texts-report" onTabChange={() => {}} />)
    const calls = screen.getByRole("button", { name: "Calls" })
    expect(calls.getAttribute("aria-current")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Volume" }))
    expect(goto).toHaveBeenCalledWith("volume")
  })

  it("shows no sections on other views", () => {
    useTextsNavStore.setState({ sections: [{ id: "volume", label: "Volume" }], active: null, goto: vi.fn() })
    render(<AnalyticsNav tab="habits" onTabChange={() => {}} />)
    expect(screen.queryByRole("navigation", { name: "Texts report sections" })).toBeNull()
  })
})
