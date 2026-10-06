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

  it("keeps every note while Keep all details is on, and offers None only when it is off", () => {
    render(
      <MergeItemsDialog
        open
        items={[
          { ...task("a", "Alpha", ["work"]), notes: "note A" },
          { ...task("b", "Beta", ["home"]), notes: "note B" },
        ]}
        lists={[list("work", "Work"), list("home", "Home")]}
        onClose={vi.fn()}
        onMerge={vi.fn()}
      />,
    )
    expect(screen.getByText("Every note is kept. The selected one is placed first.")).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "None" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep all details" }))
    expect(screen.getByRole("radio", { name: "None" })).toBeInTheDocument()
  })
})
