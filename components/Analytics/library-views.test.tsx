/**
 * Library views — plates added in the Library redesign render from store data.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { getBuiltinItemTypes } from "@/lib/item-types"
import type { Task } from "@/lib/types"
import { StagesView, TagsView, WeightView } from "./LibraryCuts"
import { ListsAreasView } from "./ListsAreasView"

function task(id: string, extra: Partial<Task>): Task {
  return { id, description: id, stage: "list", createdAt: new Date(), completed: false, lists: [], ...extra } as Task
}

describe("Library views", () => {
  beforeEach(() => {
    resetLocalStorage()
    useItemTypeStore.setState({ types: getBuiltinItemTypes() })
    useTaskStore.setState({
      tasks: [
        task("a", { tags: ["x", "y"], stage: "inbox", importance: 5, cognitiveLoad: 1, lists: ["kitchen"] }),
        task("b", { tags: ["x", "y"], stage: "clarified", importance: 4, cognitiveLoad: 1, lists: ["home"] }),
        task("c", { tags: ["z"], stage: "completed", completed: true, importance: 1, cognitiveLoad: 3, lists: ["work"] }),
      ],
      lists: [
        { id: "home", name: "Home", color: "#335577", createdAt: new Date() },
        { id: "kitchen", name: "Kitchen", color: "#aa7733", createdAt: new Date(), parentListId: "home" },
        { id: "work", name: "Work", color: "#227744", createdAt: new Date() },
      ],
      folders: [],
    })
  })

  it("tags: pairs table and search filter", async () => {
    const user = userEvent.setup()
    render(<TagsView />)
    expect(screen.getByRole("table", { name: "Tag pairs" })).toHaveTextContent("x + y")
    await user.type(screen.getByRole("searchbox", { name: "Search tags" }), "z")
    expect(screen.getByText("1 of 3 tags shown")).toBeInTheDocument()
  })

  it("stages: step heights in lifecycle order", () => {
    render(<StagesView />)
    const steps = screen.getAllByRole("listitem").filter((el) => el.classList.contains("lib-step"))
    expect(steps.map((el) => el.textContent?.replace(/\d+/g, "").split(" ·")[0])).toEqual([
      "Inbox",
      "Clarified",
      "Scheduled",
      "Completed",
    ])
  })

  it("weight: quadrant names quick wins", () => {
    render(<WeightView />)
    expect(screen.getByRole("grid", { name: "Importance by Cognitive load" })).toBeInTheDocument()
    expect(screen.getByText("Quick wins").parentElement).toHaveTextContent("Quick wins · 2")
  })

  it("lists: areas roll sublists up and ledger lists every list", async () => {
    const user = userEvent.setup()
    render(<ListsAreasView />)
    expect(screen.getByRole("table", { name: "Lists" })).toHaveTextContent("Kitchen")
    await user.click(screen.getByRole("button", { name: "Areas" }))
    expect(screen.getByRole("button", { name: "Kitchen: 1 items" })).toBeInTheDocument()
  })
})
