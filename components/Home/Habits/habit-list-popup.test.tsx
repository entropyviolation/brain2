import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { isSentOnList } from "@/lib/list-sent"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { HabitListPopup } from "./habit-list-popup"

const LIST = "1791346611510"
const NAMES = ["Ruggles", "Rebecca", "Cammy", "An", "Shelby"] as const

function textItem(name: string): Task {
  return {
    id: `popup-${name}`,
    title: name,
    description: name,
    type: "item",
    stage: "list",
    lists: [LIST],
    createdAt: new Date("2026-10-01T12:00:00"),
    completed: false,
    tags: [],
    links: [],
  }
}

describe("HabitListPopup", () => {
  it("renders the texts list names and a target, not a plate", async () => {
    const user = userEvent.setup()
    const previous = { lists: useTaskStore.getState().lists, tasks: useTaskStore.getState().tasks }
    useTaskStore.setState({
      lists: [
        ...previous.lists.filter((list) => list.id !== LIST),
        {
          id: LIST,
          name: "TEXTS I NEED TO SEND",
          color: "#224466",
          createdAt: new Date("2026-10-01T12:00:00"),
        },
      ],
      tasks: [...previous.tasks.filter((item) => !(item.lists ?? []).includes(LIST)), ...NAMES.map(textItem)],
    })

    try {
    render(
      <HabitListPopup
        listId={LIST}
        link={{ listId: LIST, grace: 100 }}
        frequency="weekly"
        container={null}
        onClose={() => {}}
      />,
    )

    const popup = screen.getByTestId("habit-list-popup")
    for (const name of NAMES) expect(screen.getByText(name)).toBeInTheDocument()
    expect(popup.querySelector("img")).toBeNull()
    expect(screen.getByTestId("habit-list-target")).toHaveTextContent("Target 0 of 5")
    expect(screen.getByRole("button", { name: "Show sent" })).toHaveAttribute("aria-pressed", "false")

    await user.click(screen.getByRole("button", { name: "Sent Ruggles" }))
    expect(screen.queryByText("Ruggles")).not.toBeInTheDocument()
    expect(screen.getByText("Rebecca")).toBeInTheDocument()
    expect(screen.getByTestId("habit-list-target")).toHaveTextContent("Target 1 of 5")

    await user.click(screen.getByRole("button", { name: "Show sent" }))
    expect(screen.getByText("Ruggles")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sent Ruggles" })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: "Undone only" }))
    expect(screen.queryByText("Ruggles")).not.toBeInTheDocument()
    expect(screen.getByText("Cammy")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Undone only" }))
    await user.click(screen.getByRole("button", { name: "Sent Ruggles" }))
    expect(screen.getByTestId("habit-list-target")).toHaveTextContent("Target 0 of 5")
    const ruggles = useTaskStore.getState().tasks.find((item) => item.id === "popup-Ruggles")
    expect(ruggles && isSentOnList(ruggles, LIST)).toBe(false)
    } finally {
      useTaskStore.setState({ lists: previous.lists, tasks: previous.tasks })
    }
  })
})
