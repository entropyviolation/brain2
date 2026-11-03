import { describe, expect, it, beforeEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ItemPenLinksField, ItemTrackedTime } from "./ItemPenTime"

beforeEach(() => {
  useTimeTrackingStore.setState({
    scopes: [
      {
        id: "activity",
        name: "Activity",
        pens: [
          { id: "cd", name: "CD design", color: "#336" },
          { id: "walk", name: "Walk", color: "#363" },
        ],
      },
    ],
    entries: [
      { id: "e1", date: "2026-10-10", scopeId: "activity", penId: "cd", startMin: 600, endMin: 690, taskId: "t1" },
      { id: "e2", date: "2026-10-11", scopeId: "activity", penId: "walk", startMin: 60, endMin: 90, taskId: "t1" },
      { id: "e3", date: "2026-10-11", scopeId: "activity", penId: "walk", startMin: 100, endMin: 200 },
    ],
  } as never)
})

describe("ItemPenLinksField", () => {
  it("links a pen from the search and unlinks it", () => {
    const onChange = vi.fn()
    const { rerender } = render(<ItemPenLinksField penLinks={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /link pen/i }))
    fireEvent.change(screen.getByLabelText("Find a pen"), { target: { value: "cd" } })
    fireEvent.click(screen.getByRole("option", { name: /CD design/ }))
    expect(onChange).toHaveBeenLastCalledWith([{ scopeId: "activity", penId: "cd" }])

    rerender(<ItemPenLinksField penLinks={[{ scopeId: "activity", penId: "cd" }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Unlink CD design" }))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it("hides edit controls when read-only", () => {
    render(<ItemPenLinksField penLinks={[{ scopeId: "activity", penId: "cd" }]} onChange={() => {}} readOnly />)
    expect(screen.queryByRole("button", { name: /link pen/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /unlink/i })).toBeNull()
  })
})

describe("ItemTrackedTime", () => {
  it("totals linked-pen and clocked blocks against the estimate", () => {
    render(
      <ItemTrackedTime
        task={{ id: "t1", penLinks: [{ scopeId: "activity", penId: "cd" }], estimatedDuration: 300, timeLogs: [] }}
      />,
    )
    // 90 by pen + 30 on the clock; the unlinked walk block is not counted.
    expect(screen.getByText(/tracked/).textContent).toMatch(/2h.*tracked · 3h est left/)
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("120")
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("shows est · parts · spent when the item has steps", () => {
    render(
      <ItemTrackedTime
        task={{
          id: "t1",
          penLinks: [{ scopeId: "activity", penId: "cd" }],
          estimatedDuration: 120,
          timeLogs: [],
          subtasks: [
            { id: "a", description: "a", completed: false, estimatedDuration: 100 },
            { id: "b", description: "b", completed: false, estimatedDuration: 45 },
          ],
        }}
      />,
    )
    expect(screen.getByLabelText("Estimate, parts and time spent").textContent).toBe("2h · est 120 · parts 145")
  })
})
