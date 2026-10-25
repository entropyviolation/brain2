import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { AttributeValueField } from "./AttributeValueField"

const def = { id: "todo", name: "To do", type: "multistring" as const }
const value = ["write script", "film"]

describe("AttributeValueField text list", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.removeItem("brain2-text-list-view")
  })

  it("switches to lines and remembers the view", async () => {
    const user = userEvent.setup()
    render(<AttributeValueField def={def} value={value} onChange={vi.fn()} />)

    expect(screen.getByRole("button", { name: "Bubbles" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Lines" }))

    expect(screen.getByText("write script")).toBeInTheDocument()
    expect(screen.getByText("film")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "To do" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove write script" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove film" })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("brain2-text-list-view") || "{}").todo).toBe("lines")
  })

  it("edits a bubble on Cmd/Ctrl+Enter", () => {
    const onChange = vi.fn()
    render(<AttributeValueField def={def} value={value} onChange={onChange} />)

    fireEvent.doubleClick(screen.getByText("film"))
    const input = screen.getByDisplayValue("film")
    fireEvent.change(input, { target: { value: "film edit" } })
    fireEvent.keyDown(input, { key: "Enter", metaKey: true })

    expect(onChange).toHaveBeenCalledWith(["write script", "film edit"])
  })

  it("makes a Brain2 list, then shows that list's items", async () => {
    const user = userEvent.setup()
    const onBind = vi.fn()
    const onOpen = vi.fn()
    const { rerender } = render(
      <AttributeValueField
        def={def}
        value={value}
        onChange={vi.fn()}
        textListBinding={{ onBind, onOpen }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Make Brain2 List" }))

    const list = useTaskStore.getState().lists.find((l) => l.name === "To do")
    expect(list).toBeTruthy()
    const titles = useTaskStore
      .getState()
      .tasks.filter((t) => t.lists?.includes(list!.id))
      .map((t) => t.title)
      .sort()
    expect(titles).toEqual(["film", "write script"])
    expect(onBind).toHaveBeenCalledWith(list!.id)

    rerender(
      <AttributeValueField
        def={{ ...def, type: "list" }}
        value={list!.id}
        onChange={vi.fn()}
        onOpenList={onOpen}
      />,
    )

    expect(screen.getByRole("button", { name: "write script" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "film" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Make Brain2 List" })).not.toBeInTheDocument()
    await user.dblClick(screen.getByRole("button", { name: "To do" }))
    expect(onOpen).toHaveBeenCalledWith(list!.id)
  })
})
