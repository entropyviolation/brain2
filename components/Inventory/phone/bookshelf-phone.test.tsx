/**
 * Phone bookshelf — covers, finished items, and the shelf list.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BOOK_ATTR, BOOK_TYPE_ID } from "@/lib/book-types"
import { OPEN_ITEM_POPUP_EVENT } from "@/lib/points-ledger-nav"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"
import { BookshelfPhone } from "./bookshelf-phone"

const COVER = "data:image/png;base64,cover"

describe("BookshelfPhone", () => {
  beforeEach(() => {
    resetAllStores()
    useItemTypeStore.getState().seedBookType()
    useTaskStore.setState({
      lists: [{ id: "novels", name: "Novels", color: "#888888", createdAt: new Date() }],
      folders: [],
      tasks: [
        {
          id: "mid",
          title: "Middlemarch",
          description: "Middlemarch",
          lists: ["novels"],
          type: BOOK_TYPE_ID,
          attributes: { [BOOK_ATTR.cover]: COVER },
        },
        {
          id: "done",
          title: "Finished Tale",
          description: "Finished Tale",
          lists: ["novels"],
          type: BOOK_TYPE_ID,
          completed: true,
          attributes: { [BOOK_ATTR.cover]: "data:image/png;base64,done" },
        },
        {
          id: "other",
          title: "Outline",
          description: "Outline",
          lists: ["essays"],
        },
      ] as never,
    })
  })

  it("stays quiet until a list is chosen, then shows covers including finished items", async () => {
    const user = userEvent.setup()
    const onListId = vi.fn()
    const view = render(<BookshelfPhone listId={null} onListId={onListId} />)
    expect(screen.getByTestId("bookshelf-phone")).toHaveTextContent("No list")
    expect(screen.getByText("A list names the books on this shelf.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Novels" }))
    expect(onListId).toHaveBeenCalledWith("novels")

    view.rerender(<BookshelfPhone listId="novels" onListId={onListId} />)
    expect(screen.getByRole("button", { name: "Middlemarch" }).querySelector("img")).toHaveAttribute("src", COVER)
    expect(screen.getByRole("button", { name: "Finished Tale" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Outline" })).not.toBeInTheDocument()
  })

  it("marks a title match without selecting a cover or opening detail", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(window, "dispatchEvent")
    render(<BookshelfPhone listId="novels" onListId={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Middlemarch" }))
    await user.type(screen.getByRole("searchbox", { name: "Search titles" }), "tale")
    const covers = screen.getByRole("button", { name: "Finished Tale" }).parentElement
    expect(covers).toHaveAttribute("data-searching", "true")
    expect(screen.getByRole("button", { name: "Finished Tale" })).toHaveAttribute("data-match", "true")
    expect(screen.getByRole("button", { name: "Finished Tale" })).toHaveAttribute("data-selected", "false")
    expect(screen.getByRole("button", { name: "Middlemarch" })).toHaveAttribute("data-match", "false")
    expect(screen.getByRole("button", { name: "Middlemarch" })).toHaveAttribute("data-selected", "true")
    expect(popupEvents(spy)).toEqual([])
  })

  it("eases a cover forward on the first tap and opens detail on the second", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(window, "dispatchEvent")
    render(<BookshelfPhone listId="novels" onListId={() => {}} />)

    const mid = screen.getByRole("button", { name: "Middlemarch" })
    const done = screen.getByRole("button", { name: "Finished Tale" })
    await user.click(mid)
    expect(mid).toHaveAttribute("data-selected", "true")
    expect(mid).toHaveAttribute("aria-pressed", "true")
    expect(mid).toHaveStyle({ transform: "translateY(-8px) scale(1.04)" })
    expect(done).toHaveAttribute("data-selected", "false")
    expect(popupEvents(spy)).toEqual([])

    await user.click(done)
    expect(done).toHaveAttribute("data-selected", "true")
    expect(mid).toHaveAttribute("data-selected", "false")
    expect(popupEvents(spy)).toEqual([])

    await user.click(done)
    const events = popupEvents(spy)
    expect(events).toHaveLength(1)
    expect(events[0].detail).toEqual({ id: "done" })

    fireEvent.click(done.parentElement!)
    expect(done).toHaveAttribute("data-selected", "false")
    expect(mid).toHaveAttribute("data-selected", "false")
    expect(popupEvents(spy)).toHaveLength(1)
  })
})

function popupEvents(spy: ReturnType<typeof vi.spyOn>): CustomEvent[] {
  return spy.mock.calls
    .map((call) => call[0])
    .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === OPEN_ITEM_POPUP_EVENT)
}
