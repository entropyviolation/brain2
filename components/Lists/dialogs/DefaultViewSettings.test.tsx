import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { BUILTIN_DEFAULT_VIEW_SHOW } from "@/lib/default-view-prefs"
import { DefaultViewSettings } from "./DefaultViewSettings"

const books: List = {
  id: "books",
  name: "Books",
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  itemAttributes: [
    { id: "author", name: "Author", type: "string" },
    { id: "pages", name: "Pages", type: "number" },
  ],
}

const films: List = {
  id: "films",
  name: "Films",
  color: "#ef4444",
  createdAt: new Date("2026-01-01"),
  itemAttributes: [{ id: "year", name: "Year", type: "number" }],
}

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["books"],
  ...partial,
})

describe("DefaultViewSettings", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([books, films])
    useTaskStore.getState().setTasks([
      task({ id: "b1", description: "Dune", attributes: { author: "Herbert" } }),
      task({ id: "f1", description: "Heat", lists: ["films"], attributes: { year: 1995 } }),
    ])
  })

  it("starts on Use default layout and hides custom chrome until chosen", () => {
    render(<DefaultViewSettings list={books} onChange={vi.fn()} />)
    expect(screen.getByText("Default view mode settings")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Use default layout" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Customize this list" })).not.toBeChecked()
    expect(screen.queryByRole("checkbox", { name: "Item type" })).not.toBeInTheDocument()
  })

  it("customizing seeds the built-in chrome so the row does not jump", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DefaultViewSettings list={books} onChange={onChange} />)
    await user.click(screen.getByRole("radio", { name: "Customize this list" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].defaultView).toMatchObject({
      custom: true,
      show: BUILTIN_DEFAULT_VIEW_SHOW,
    })
  })

  it("hiding type and date persists on List.defaultView", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DefaultViewSettings
        list={{ ...books, defaultView: { custom: true, show: { ...BUILTIN_DEFAULT_VIEW_SHOW } } }}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("checkbox", { name: "Item type" }))
    expect(onChange.mock.calls[0][0].defaultView.show.type).toBe(false)
    onChange.mockClear()
    await user.click(screen.getByRole("checkbox", { name: "Date" }))
    expect(onChange.mock.calls[0][0].defaultView.show.date).toBe(false)
  })

  it("offers extra attributes searchable and on-this-list first", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DefaultViewSettings
        list={{ ...books, defaultView: { custom: true, show: { ...BUILTIN_DEFAULT_VIEW_SHOW } } }}
        onChange={onChange}
      />,
    )
    const author = screen.getByRole("checkbox", { name: "Author meta" })
    const year = screen.getByRole("checkbox", { name: "Year meta" })
    expect(author.compareDocumentPosition(year) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole("checkbox", { name: "On this list" }))
    expect(screen.getByRole("checkbox", { name: "Author meta" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Year meta" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "On this list" }))
    await user.type(screen.getByLabelText("Search default-view attributes"), "year")
    expect(screen.getByRole("checkbox", { name: "Year meta" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Author meta" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Year meta" }))
    expect(onChange.mock.calls.at(-1)?.[0].defaultView.extraAttributeIds).toEqual(["year"])
  })
})
