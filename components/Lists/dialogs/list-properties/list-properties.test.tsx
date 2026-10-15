/**
 * List Settings furniture — panel switch, merged column table, safety cover.
 * Each writes the same fields the old single-column dialog wrote.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { DetailPanelSwitches, SafetyCover, panelState, setPanelState } from "./ListPropertiesParts"
import { ListColumnsMatrix } from "./ListColumnsMatrix"

const books: List = {
  id: "books",
  name: "Books",
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  itemAttributes: [
    { id: "author", name: "Author", type: "string" },
    { id: "pages", name: "Pages", type: "number" },
  ],
}

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["books"],
  ...partial,
})

describe("item-detail panel switch", () => {
  it("maps Type / Show / Hide onto detailPanels and hiddenDetailPanels", () => {
    const shown = setPanelState(books, "analysis", "show")
    expect(shown.detailPanels).toEqual(["analysis"])
    expect(shown.hiddenDetailPanels).toBeUndefined()
    const hidden = setPanelState(shown, "analysis", "hide")
    expect(hidden.detailPanels).toBeUndefined()
    expect(hidden.hiddenDetailPanels).toEqual(["analysis"])
    const back = setPanelState(hidden, "analysis", "type")
    expect(back.detailPanels).toBeUndefined()
    expect(back.hiddenDetailPanels).toBeUndefined()
  })

  it("reads hidden as winning when old data lists a panel in both", () => {
    expect(panelState({ ...books, detailPanels: ["time"], hiddenDetailPanels: ["time"] }, "time")).toBe("hide")
  })

  it("never hides Details, and keeps other panels' settings when one changes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const list = { ...books, detailPanels: ["subtasks" as const], hiddenDetailPanels: ["scheduling" as const] }
    render(<DetailPanelSwitches list={list} onChange={onChange} />)
    const detailsGroup = screen.getByRole("radiogroup", { name: "details panel" })
    expect(detailsGroup.querySelector('[aria-checked="true"]')).toHaveTextContent("Type")
    expect(screen.getAllByRole("radio", { name: "Hide" })[0]).toBeDisabled()
    await user.click(screen.getAllByRole("radio", { name: "Show" })[0])
    const next = onChange.mock.calls[0][0] as List
    expect(next.detailPanels).toEqual(["subtasks", "details"])
    expect(next.hiddenDetailPanels).toEqual(["scheduling"])
  })
})

describe("ListColumnsMatrix", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([books])
    useTaskStore.getState().setTasks([task({ id: "b1", description: "Dune", attributes: { author: "Herbert" } })])
  })

  it("writes Details to detailsColumns and Spreadsheet to sheetConfig, separately", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ListColumnsMatrix list={books} onChange={onChange} focus="table" />)

    const sheetBox = screen.getByRole("checkbox", { name: "Pages in Spreadsheet" })
    await user.click(sheetBox)
    const afterSheet = onChange.mock.calls.at(-1)?.[0] as List
    expect(afterSheet.detailsColumns).toBe(books.detailsColumns)
    expect(afterSheet.sheetConfig?.columnIds).toEqual(expect.any(Array))

    const detailsBox = screen.getByRole("checkbox", { name: "Author in Details" })
    const wasOn = (detailsBox as HTMLInputElement).checked
    await user.click(detailsBox)
    const afterDetails = onChange.mock.calls.at(-1)?.[0] as List
    expect(afterDetails.sheetConfig).toBe(books.sheetConfig)
    expect(afterDetails.detailsColumns?.includes("author")).toBe(!wasOn)
  })

  it("keeps vault attributes folded until opened or searched", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setLists([
      books,
      { ...books, id: "films", name: "Films", itemAttributes: [{ id: "year", name: "Year", type: "number" }] },
    ])
    render(<ListColumnsMatrix list={books} onChange={vi.fn()} focus="spreadsheet" />)
    expect(screen.queryByRole("checkbox", { name: "Year in Spreadsheet" })).not.toBeInTheDocument()
    await user.type(screen.getByRole("textbox", { name: "Search spreadsheet columns" }), "year")
    expect(screen.getByRole("checkbox", { name: "Year in Spreadsheet" })).toBeInTheDocument()
  })
})

describe("SafetyCover", () => {
  it("keeps the action out of the tab order until the cover is lifted", async () => {
    const user = userEvent.setup()
    render(
      <SafetyCover label="Delete">
        {(armed) => (
          <button type="button" tabIndex={armed ? 0 : -1}>
            Delete
          </button>
        )}
      </SafetyCover>,
    )
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("tabindex", "-1")
    await user.click(screen.getByRole("button", { name: "Lift cover for Delete" }))
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("tabindex", "0")
  })
})
