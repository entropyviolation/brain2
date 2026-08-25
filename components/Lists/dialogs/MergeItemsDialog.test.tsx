import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { List, Task } from "@/lib/types"
import { MergeItemsDialog } from "./MergeItemsDialog"

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#111",
  description: "",
  createdAt: new Date(),
})

const task = (id: string, description: string, lists: string[]): Task => ({
  id,
  description,
  lists,
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
})

describe("MergeItemsDialog", () => {
  it("keeps all details by default and merges with the chosen title", () => {
    const onMerge = vi.fn()
    render(
      <MergeItemsDialog
        open
        items={[task("a", "Alpha", ["work"]), task("b", "Beta", ["home"])]}
        lists={[list("work", "Work"), list("home", "Home")]}
        onClose={vi.fn()}
        onMerge={onMerge}
      />,
    )
    expect(screen.getByRole("checkbox", { name: "Keep all details" })).toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }))
    fireEvent.click(screen.getByRole("button", { name: "Merge" }))
    expect(onMerge).toHaveBeenCalledWith(
      expect.objectContaining({
        survivorId: "a",
        discardedIds: ["b"],
        description: "Beta",
        keepAllDetails: true,
        listIds: expect.arrayContaining(["work", "home"]),
      }),
    )
  })
})
