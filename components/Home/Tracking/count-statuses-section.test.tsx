import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useCountStatusesStore } from "@/lib/count-statuses"
import { CountStatusesSection } from "./count-statuses-section"

describe("CountStatusesSection", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("adds joints, increments once, and deletes the count", () => {
    render(<CountStatusesSection />)
    fireEvent.change(screen.getByLabelText("Count name"), { target: { value: "joints" } })
    fireEvent.click(screen.getByRole("button", { name: "Add count" }))
    expect(screen.getByLabelText("joints total")).toHaveTextContent("0")
    fireEvent.click(screen.getByRole("button", { name: "Increment joints" }))
    expect(screen.getByLabelText("joints total")).toHaveTextContent("1")
    const tick = useCountStatusesStore.getState().counts[0]?.ticks[0]
    expect(tick?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(tick?.startMin).toEqual(expect.any(Number))
    fireEvent.click(screen.getByRole("button", { name: "Delete joints" }))
    expect(screen.queryByLabelText("Rename joints")).not.toBeInTheDocument()
    expect(useCountStatusesStore.getState().counts).toEqual([])
  })
})
