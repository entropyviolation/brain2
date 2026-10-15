import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Task } from "@/lib/types"
import { EventPrereqPicker } from "./event-prereq-picker"

function item(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "clarified",
    createdAt: new Date("2026-10-01T12:00:00"),
    completed: false,
    lists: [],
    urgency: 3,
    importance: 3,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@general",
    entropy: 0.5,
    rewardValue: 1,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...extra,
  }
}

const many = Array.from({ length: 2000 }, (_, i) => item(`n-${i}`, `note ${i}`))
const candidates = [item("a", "big tall bookshelf"), item("b", "wall shelves"), item("c", "mirror"), ...many]

describe("EventPrereqPicker", () => {
  it("shows nothing until typed, then ranked matches with orbs", async () => {
    const user = userEvent.setup()
    const onAttach = vi.fn()
    render(
      <EventPrereqPicker linked={[]} candidates={candidates} onAttach={onAttach} onDetach={vi.fn()} onCreate={vi.fn()} />,
    )
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    await user.type(screen.getByLabelText("Search prerequisite items"), "shel")
    const options = screen.getAllByRole("option")
    expect(options[0]).toHaveTextContent("wall shelves")
    expect(options[1]).toHaveTextContent("big tall bookshelf")
    expect(options[0].querySelector("img")).not.toBeNull()
    await user.click(options[1])
    expect(onAttach).toHaveBeenCalledWith("a")
    expect(screen.getByLabelText("Search prerequisite items")).toHaveValue("")
  })

  it("caps results for huge lists and says how many more", async () => {
    const user = userEvent.setup()
    render(<EventPrereqPicker linked={[]} candidates={candidates} onAttach={vi.fn()} onDetach={vi.fn()} onCreate={vi.fn()} />)
    await user.type(screen.getByLabelText("Search prerequisite items"), "note")
    // 40 hits + the create row
    expect(screen.getAllByRole("option")).toHaveLength(41)
    expect(screen.getByText(/1960 more/)).toBeInTheDocument()
  })

  it("creates a new item from the typed name with Enter when nothing matches", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<EventPrereqPicker linked={[]} candidates={candidates} onAttach={vi.fn()} onDetach={vi.fn()} onCreate={onCreate} />)
    await user.type(screen.getByLabelText("Search prerequisite items"), "buy goose feed{Enter}")
    expect(onCreate).toHaveBeenCalledWith("buy goose feed")
  })

  it("does not offer to create an exact duplicate", async () => {
    const user = userEvent.setup()
    render(<EventPrereqPicker linked={[]} candidates={candidates} onAttach={vi.fn()} onDetach={vi.fn()} onCreate={vi.fn()} />)
    await user.type(screen.getByLabelText("Search prerequisite items"), "mirror")
    expect(screen.queryByText(/Create “mirror”/)).not.toBeInTheDocument()
  })

  it("lists linked items with a remove key", async () => {
    const user = userEvent.setup()
    const onDetach = vi.fn()
    render(
      <EventPrereqPicker
        linked={[item("x", "dresser", { completed: true })]}
        candidates={candidates}
        onAttach={vi.fn()}
        onDetach={onDetach}
        onCreate={vi.fn()}
      />,
    )
    expect(screen.getByText("1/1 done")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Remove dresser from checklist" }))
    expect(onDetach).toHaveBeenCalledWith("x")
  })
})
