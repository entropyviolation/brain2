/**
 * GlobalSearch — palette keyboard, empty states, and result rows.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { GlobalSearch } from "./GlobalSearch"

function addItem(partial: Partial<Task> & { id: string; description: string }) {
  useTaskStore.getState().addTask({
    stage: "list",
    createdAt: new Date(2024, 4, 2),
    completed: false,
    lists: [],
    ...partial,
  } as Task)
}

describe("GlobalSearch", () => {
  const onOpenChange = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    onOpenChange.mockClear()
    onSelect.mockClear()
    useItemTypeStore.getState().resetTypes()
    useTaskStore.getState().clearAllData()
    Element.prototype.scrollIntoView = vi.fn()
  })

  function renderSearch() {
    return render(<GlobalSearch open onOpenChange={onOpenChange} onSelect={onSelect} />)
  }

  it("asks for a query until there is one", () => {
    renderSearch()
    expect(screen.getByRole("dialog", { name: "Search" })).toHaveClass("b2-search")
    expect(screen.getByRole("status")).toHaveTextContent("Type to search folders, lists, and items.")
    expect(screen.getByRole("combobox", { name: "Search items" })).toBeInTheDocument()
  })

  it("opens the clicked row and the Enter row", async () => {
    const user = userEvent.setup()
    addItem({ id: "blue", description: "alpha blue bird", type: "task" })
    addItem({ id: "red", description: "alpha red barn", type: "task" })
    renderSearch()

    const box = screen.getByRole("combobox", { name: "Search items" })
    await user.type(box, "alpha")

    const options = screen.getAllByRole("option")
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(box).toHaveAttribute("aria-activedescendant", options[0].id)

    await user.keyboard("{ArrowDown}")
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")

    await user.click(screen.getByRole("option", { name: /alpha red barn/i }))
    expect(onSelect).toHaveBeenCalledWith({ id: "red", kind: "item" })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("returns the highlight to the first hit when the query changes", async () => {
    const user = userEvent.setup()
    addItem({ id: "blue", description: "alpha blue bird", type: "task" })
    addItem({ id: "red", description: "alpha red barn", type: "task" })
    renderSearch()

    await user.type(screen.getByRole("combobox", { name: "Search items" }), "alpha")
    await user.keyboard("{ArrowDown}")
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")

    await user.type(screen.getByRole("combobox", { name: "Search items" }), " b")
    const options = screen.getAllByRole("option")
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(options[1]).toHaveAttribute("aria-selected", "false")

    await user.keyboard("{Enter}")
    const first = options[0].textContent ?? ""
    const id = first.includes("blue") ? "blue" : "red"
    expect(onSelect).toHaveBeenCalledWith({ id, kind: "item" })
  })

  it("still moves the highlight when focus is on Advanced", async () => {
    const user = userEvent.setup()
    addItem({ id: "blue", description: "alpha blue bird", type: "task" })
    addItem({ id: "red", description: "alpha red barn", type: "task" })
    renderSearch()

    await user.type(screen.getByRole("combobox", { name: "Search items" }), "alpha")
    await user.click(screen.getByRole("button", { name: "Advanced" }))
    await user.keyboard("{ArrowDown}")
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{Enter}")
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("shows type, list, and the date already on the record", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setLists([
      {
        id: "seeds",
        name: "Seeds",
        color: "#336699",
        createdAt: new Date(2024, 4, 1),
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "garden",
        name: "Garden",
        createdAt: new Date(2024, 4, 1),
        listIds: ["seeds"],
      },
    ])
    addItem({
      id: "sow",
      description: "Sow basil",
      type: "task",
      lists: ["seeds"],
      scheduledDate: new Date(2024, 4, 16),
    })
    renderSearch()

    await user.type(screen.getByRole("combobox", { name: "Search items" }), "basil")
    const row = screen.getByRole("option", { name: /Sow basil/i })
    expect(row).toHaveTextContent("Task")
    expect(row).toHaveTextContent("Seeds")
    expect(row).toHaveTextContent("sched Thu 5/16")
    expect(row).toHaveClass("is-active")

    await user.clear(screen.getByRole("combobox", { name: "Search items" }))
    await user.type(screen.getByRole("combobox", { name: "Search items" }), "seeds")
    const list = screen.getByRole("option", { name: /Seeds/i })
    expect(list).toHaveTextContent("List")
    expect(list).toHaveTextContent("Garden")
    await user.click(list)
    expect(onSelect).toHaveBeenCalledWith({ id: "seeds", kind: "list" })
  })

  it("says when the only matches are hidden", async () => {
    const user = userEvent.setup()
    addItem({ id: "done", description: "secret ledger", completed: true, type: "task" })
    renderSearch()

    await user.type(screen.getByRole("combobox", { name: "Search items" }), "ledger")
    expect(screen.getByRole("status")).toHaveTextContent("No results. Completed and hidden items are off.")
    expect(screen.queryByRole("option")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Advanced" }))
    await user.click(screen.getByRole("checkbox", { name: "Include hidden items" }))
    expect(screen.getByRole("option", { name: /secret ledger/i })).toBeInTheDocument()
  })

  it("says when nothing matches", async () => {
    const user = userEvent.setup()
    addItem({ id: "milk", description: "Buy milk", type: "task" })
    renderSearch()
    await user.type(screen.getByRole("combobox", { name: "Search items" }), "zzzz")
    expect(screen.getByRole("status")).toHaveTextContent("No results.")
    expect(screen.getByText("0 shown")).toBeInTheDocument()
  })

  it("answers a house question with triples and stays on node lookup otherwise", async () => {
    const user = userEvent.setup()
    addItem({ id: "milk", description: "Buy milk", type: "task" })
    renderSearch()
    const box = screen.getByRole("combobox", { name: "Search items" })

    await user.type(box, "where from belief strength")
    const answer = screen.getByTestId("pattern-answer")
    expect(answer).toHaveTextContent("Belief strength is derived from")
    expect(answer).toHaveTextContent("derived")
    expect(screen.queryByRole("option", { name: /Buy milk/i })).not.toBeInTheDocument()

    await user.clear(box)
    await user.type(box, "milk")
    expect(screen.queryByTestId("pattern-answer")).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Buy milk/i })).toBeInTheDocument()
  })

  it("says when no triple supports a pattern", async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(screen.getByRole("combobox", { name: "Search items" }), "places with one person")
    expect(screen.getByTestId("pattern-answer")).toHaveTextContent("No triple supports an answer.")
  })

  it("fits the phone sheet inside the visual viewport and leaves the desktop palette", () => {
    const css = readFileSync(join(process.cwd(), "components/Search/search-chrome.css"), "utf8")
    const phoneAt = css.indexOf("@media (max-width: 767px)")
    expect(phoneAt).toBeGreaterThan(0)
    const desktop = css.slice(0, phoneAt)
    const phone = css.slice(phoneAt)

    expect(desktop).toContain("font-size: 14px")
    expect(desktop).toContain("min(36rem, calc(100vw - 1.5rem))")
    expect(desktop).toMatch(/\.b2-search \.b2-search-field \{[^}]*font-size: 14px !important/)

    expect(phone).toContain("max-width: min(100%, 100vw)")
    expect(phone).toContain("min-width: 0")
    expect(phone).toContain("transform: none")
    expect(phone).toContain("100dvh")
    expect(phone).toContain("safe-area-inset-top")
    expect(phone).toContain("safe-area-inset-bottom")
    expect(phone).toMatch(/\.b2-search \.b2-search-field \{[^}]*font-size: 16px !important/)
    expect(phone).toContain("min-height: 44px")
    expect(phone).toContain("overflow-wrap: anywhere")
    expect(phone).not.toContain("user-scalable")
    expect(phone).not.toContain("maximum-scale")
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
