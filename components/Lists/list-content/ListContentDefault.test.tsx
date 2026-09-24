import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { List, Task } from "@/lib/types"
import { BUILTIN_DEFAULT_VIEW_SHOW } from "@/lib/default-view-prefs"
import { ListContentDefault } from "./ListContentDefault"

vi.mock("@/lib/item-type-store", () => ({
  useItemTypeStore: (sel: (s: { types: unknown[] }) => unknown) => sel({ types: [] }),
}))

const books = (extra: Partial<List> = {}): List => ({
  id: "books",
  name: "Books",
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  itemAttributes: [{ id: "author", name: "Author", type: "string" }],
  ...extra,
})

const item = (extra: Partial<Task> = {}): Task => ({
  id: "dune",
  description: "Dune",
  lists: ["books"],
  stage: "list",
  completed: false,
  createdAt: new Date("2026-01-01"),
  urgency: 2,
  importance: 4,
  scheduledDate: new Date("2026-04-01"),
  attributes: { author: "Herbert" },
  ...extra,
})

function renderDefault(overrides: Partial<ComponentProps<typeof ListContentDefault>> = {}) {
  const category = overrides.openCategory ?? books()
  return render(
    <ListContentDefault
      tasks={[item()]}
      openCategory={category}
      categories={[category]}
      onTaskSelect={vi.fn()}
      onCompleteTask={vi.fn()}
      onTaskDragStart={vi.fn()}
      onDragEnd={vi.fn()}
      {...overrides}
    />,
  )
}

describe("ListContentDefault chrome", () => {
  it("unset prefs keep the current Default look and have no complete checkboxes", () => {
    renderDefault()
    const row = screen.getByTestId("list-default-read")
    expect(row).toHaveAttribute("data-density", "comfortable")
    expect(row.querySelector(".fm-read-pip")).toBeTruthy()
    expect(row.querySelector(".fm-read-orb")).toBeTruthy()
    expect(row.querySelector(".fm-read-name")?.textContent).toBe("Dune")
    expect(row.querySelector(".fm-read-type")?.textContent).toBe("Item")
    expect(row.querySelector(".fm-read-when")?.textContent).toBe(new Date("2026-04-01").toLocaleDateString())
    expect(row.querySelector(".fm-read-bit")?.textContent).toMatch(/^U2|I4$/)
    expect(row.querySelector(".fm-attr-chip")?.textContent).toBe("Herbert")
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
  })

  it("custom hide type/date actually hides those bits", () => {
    renderDefault({
      openCategory: books({
        defaultView: { custom: true, show: { ...BUILTIN_DEFAULT_VIEW_SHOW, type: false, date: false } },
      }),
    })
    expect(document.querySelector(".fm-read-pip")).toBeTruthy()
    expect(document.querySelector(".fm-read-orb")).toBeTruthy()
    expect(document.querySelector(".fm-read-type")).toBeNull()
    expect(document.querySelector(".fm-read-when")).toBeNull()
    expect(document.querySelector(".fm-read-name")?.textContent).toBe("Dune")
  })

  it("Select mode still gets selection ticks and no complete checkboxes", () => {
    const onToggleTaskSelect = vi.fn()
    const onTaskSelect = vi.fn()
    renderDefault({
      selectMode: true,
      selectedTaskIds: ["dune"],
      onToggleTaskSelect,
      onTaskSelect,
    })
    expect(screen.getByRole("checkbox", { name: "Select Dune" })).toBeChecked()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Dune"))
    expect(onToggleTaskSelect).toHaveBeenCalledWith("dune")
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it("completed items stay reading rows, not checklist ticks", () => {
    renderDefault({ tasks: [item({ completed: true })] })
    expect(document.querySelector(".fm-read-row.done")).toBeTruthy()
    expect(document.querySelector(".fm-read-pip")?.getAttribute("data-pip")).toBe("done")
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("custom extra attributes show as compact meta", () => {
    renderDefault({
      openCategory: books({
        defaultView: { custom: true, extraAttributeIds: ["author"] },
      }),
    })
    expect(document.querySelector('[data-attr-id="author"]')?.textContent).toBe("Herbert")
  })

  it("compact density marks the reading list", () => {
    renderDefault({
      openCategory: books({ defaultView: { custom: true, density: "compact" } }),
    })
    expect(screen.getByTestId("list-default-read")).toHaveAttribute("data-density", "compact")
    expect(screen.getByTestId("list-default-read").className).toMatch(/compact/)
  })
})
