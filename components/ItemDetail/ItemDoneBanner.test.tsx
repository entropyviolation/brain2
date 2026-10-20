import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ItemDoneBanner } from "@/components/ItemDetail/ItemDoneBanner"
import { withCompleted } from "@/lib/completion-status"
import type { Task } from "@/lib/types"

const base = { id: "t", type: "task", description: "T", completed: true, status: "done", notes: "keep", subtasks: [{ id: "s", description: "S", completed: true }] } as unknown as Task

describe("ItemDoneBanner", () => {
  it("only shows on a completed task and offers Mark incomplete", async () => {
    const onReopen = vi.fn()
    const { rerender } = render(<ItemDoneBanner task={{ ...base, completed: false }} onReopen={onReopen} />)
    expect(screen.queryByTestId("item-done-banner")).toBeNull()
    rerender(<ItemDoneBanner task={base} onReopen={onReopen} />)
    await userEvent.setup().click(screen.getByRole("button", { name: /mark incomplete/i }))
    expect(onReopen).toHaveBeenCalled()
  })

  it("reopening keeps notes and steps", () => {
    const next = withCompleted(base, false)
    expect(next.completed).toBe(false)
    expect(next.notes).toBe("keep")
    expect(next.subtasks).toEqual(base.subtasks)
  })
})
