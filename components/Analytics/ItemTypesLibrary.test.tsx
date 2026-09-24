/**
 * Item Types library — browse, sort, counts, Lists jump.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { ItemTypesLibrary } from "./ItemTypesLibrary"

describe("ItemTypesLibrary", () => {
  beforeEach(() => {
    resetLocalStorage()
    useItemTypeStore.setState({ types: getBuiltinItemTypes() })
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
  })

  it("lists created types with counts and sort", async () => {
    const user = userEvent.setup()
    useTaskStore.setState({
      tasks: [
        {
          id: "t1",
          description: "Write brief",
          type: "task",
          stage: "list",
          createdAt: new Date(),
          completed: false,
          lists: [],
        },
        {
          id: "b1",
          description: "The Left Hand of Darkness",
          type: "book",
          stage: "list",
          createdAt: new Date(),
          completed: false,
          lists: [],
        },
      ],
      lists: [],
      folders: [],
    })

    render(<ItemTypesLibrary />)

    expect(screen.getByTestId("item-types-library")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Sort item types" })).toHaveValue("count")
    expect(screen.getAllByText(/Task/).length).toBeGreaterThan(0)

    await user.click(screen.getByTitle("Task: 1 items"))
    expect(screen.getByText("Write brief")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open 1 item\(s\) in Lists/ })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort item types" }), "name")
    expect(screen.getByRole("combobox", { name: "Sort item types" })).toHaveValue("name")

    await user.click(screen.getByRole("button", { name: "Catalog" }))
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute("aria-pressed", "true")
  })
})
