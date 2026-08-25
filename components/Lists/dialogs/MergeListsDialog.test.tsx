import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { List } from "@/lib/types"
import { MergeListsDialog } from "./MergeListsDialog"

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#111",
  description: "",
  createdAt: new Date(),
})

describe("MergeListsDialog", () => {
  it("keeps all items by default and merges with the chosen title", () => {
    const onMerge = vi.fn()
    render(
      <MergeListsDialog
        open
        lists={[list("a", "Alpha"), list("b", "Beta")]}
        folders={[{ id: "f1", name: "folder1", createdAt: new Date(), listIds: ["a", "b"] }]}
        tasks={[]}
        onClose={vi.fn()}
        onMerge={onMerge}
      />,
    )
    expect(screen.getByRole("checkbox", { name: "Keep all items" })).toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }))
    fireEvent.click(screen.getByRole("button", { name: "Merge" }))
    expect(onMerge).toHaveBeenCalledWith(
      expect.objectContaining({
        survivorId: "a",
        discardedIds: ["b"],
        name: "Beta",
        keepAllItems: true,
        folderIds: ["f1"],
      }),
    )
  })
})
