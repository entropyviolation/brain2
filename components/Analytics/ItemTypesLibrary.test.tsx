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
    expect(screen.getByRole("combobox", { name: "Sort item types" })).toHaveTextContent("By count")
    expect(screen.getAllByText(/Task/).length).toBeGreaterThan(0)

    await user.click(screen.getByTitle("Task: 1 items"))
    expect(screen.getByText("Write brief")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open 1 item\(s\) in Lists/ })).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Sort item types" }))
    await user.click(screen.getByRole("option", { name: "By name" }))
    expect(screen.getByRole("combobox", { name: "Sort item types" })).toHaveTextContent("By name")

    await user.click(screen.getByRole("button", { name: "Catalog" }))
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute("aria-pressed", "true")
  })

  it("shows the Relations tab with usage and origin", async () => {
    const user = userEvent.setup()
    render(<ItemTypesLibrary />)
    await user.click(screen.getByRole("tab", { name: "Relations" }))
    expect(screen.getByTestId("relations-library")).toBeInTheDocument()
    expect(screen.getByTestId("relation-row-blocks")).toHaveTextContent("built-in")
    expect(screen.getByTestId("relation-row-born-in")).toHaveTextContent("seed")
    await user.click(screen.getByRole("button", { name: "Tree" }))
    expect(screen.getByRole("list", { name: "Relation tree" })).toBeInTheDocument()
  })
})
