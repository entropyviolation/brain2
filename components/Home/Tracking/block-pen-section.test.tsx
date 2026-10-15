import { render, screen, fireEvent, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { TrackPen } from "@/lib/time-tracking-store"
import { BlockPenSection } from "./block-pen-section"

const pens: TrackPen[] = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "rest", name: "Rest", color: "#10b981" },
  { id: "chores", name: "Chores", color: "#8b5cf6" },
]

/** Stateful harness so chips follow what the section reports back. */
function Harness({
  primary = "work",
  extras = [] as string[],
  list = pens,
  onCreate = vi.fn(() => ""),
  onNameGroup,
  onOpenPen,
}: {
  primary?: string
  extras?: string[]
  list?: TrackPen[]
  onCreate?: (name: string, color: string) => string | void
  onNameGroup?: (name: string, color: string, memberIds: string[]) => void
  onOpenPen?: (id: string) => void
}) {
  const [primaryId, setPrimary] = useState(primary)
  const [secondaryPenIds, setSecondaries] = useState(extras)
  const [all, setAll] = useState(list)
  return (
    <>
      <BlockPenSection
        pens={all}
        primaryId={primaryId}
        secondaryPenIds={secondaryPenIds}
        onPrimary={setPrimary}
        onSecondaries={setSecondaries}
        onCreate={(name, color) => {
          const id = onCreate(name, color)
          if (id) setAll((current) => [...current, { id, name, color }])
          return id
        }}
        onNameGroup={onNameGroup}
        onOpenPen={onOpenPen}
      />
      <output data-testid="state">{[primaryId, ...secondaryPenIds].join(",")}</output>
    </>
  )
}

const state = () => screen.getByTestId("state").textContent
const chips = () => screen.getByRole("group", { name: "Pens on this block" })
const search = () => screen.getByLabelText("Add a pen")

describe("BlockPenSection", () => {
  it("shows the pens on the block as chips, primary first, without any 'also' labels", () => {
    render(<Harness extras={["chores"]} />)
    expect(chips()).toHaveTextContent("Work")
    expect(chips()).toHaveTextContent("Primary")
    expect(chips()).toHaveTextContent("Chores")
    expect(chips()).not.toHaveTextContent(/also/i)
    expect(screen.getByRole("button", { name: "Work is primary" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "add pen color" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add a secondary pen")).not.toBeInTheDocument()
    // The catalog is not dumped until you go to add one.
    expect(screen.queryByRole("list", { name: "Pen results" })).not.toBeInTheDocument()
  })

  it("adds a searched pen as an extra from the one field", () => {
    render(<Harness />)
    fireEvent.change(search(), { target: { value: "cho" } })
    fireEvent.click(screen.getByRole("button", { name: "Add Chores" }))
    expect(state()).toBe("work,chores")
    expect(search()).toHaveValue("")
  })

  it("adds a searched pen as primary, keeping the old primary as an extra", () => {
    render(<Harness />)
    fireEvent.change(search(), { target: { value: "rest" } })
    fireEvent.click(screen.getByRole("button", { name: "Use Rest as primary" }))
    expect(state()).toBe("rest,work")
  })

  it("Enter adds the top match as an extra", () => {
    render(<Harness />)
    fireEvent.change(search(), { target: { value: "Chor" } })
    fireEvent.keyDown(search(), { key: "Enter" })
    expect(state()).toBe("work,chores")
  })

  it("switches the primary from a chip star and removes with ×", () => {
    render(<Harness extras={["chores", "rest"]} />)
    fireEvent.click(screen.getByRole("button", { name: "Make Chores primary" }))
    expect(state()).toBe("chores,work,rest")
    fireEvent.click(screen.getByRole("button", { name: "Remove Rest" }))
    expect(state()).toBe("chores,work")
    // Removing the primary promotes the next pen.
    fireEvent.click(screen.getByRole("button", { name: "Remove Chores" }))
    expect(state()).toBe("work")
    // The last pen cannot be removed.
    expect(screen.queryByRole("button", { name: "Remove Work" })).not.toBeInTheDocument()
  })

  it("creates a missing pen as an extra or as primary", () => {
    let n = 0
    const onCreate = vi.fn(() => `new-${++n}`)
    render(<Harness onCreate={onCreate} />)
    fireEvent.change(search(), { target: { value: "Pottery" } })
    const create = screen.getByText("Create “Pottery”").closest("li") as HTMLElement
    fireEvent.click(within(create).getByRole("button", { name: "+ Add" }))
    expect(onCreate).toHaveBeenCalledWith("Pottery", expect.any(String))
    expect(state()).toBe("work,new-1")

    fireEvent.change(search(), { target: { value: "Kiln" } })
    fireEvent.click(within(screen.getByText("Create “Kiln”").closest("li") as HTMLElement).getByRole("button", { name: "★ Primary" }))
    expect(state()).toBe("new-2,work,new-1")
  })

  it("lists recent pens when the empty field is focused", () => {
    render(<Harness />)
    fireEvent.focus(search())
    const list = screen.getByRole("list", { name: "Pen results" })
    expect(within(list).getByText("Rest")).toBeInTheDocument()
    expect(within(list).getByText("Chores")).toBeInTheDocument()
    expect(within(list).queryByText("Work")).not.toBeInTheDocument()
  })

  it("opens pen settings on a double-click of a chip", () => {
    const onOpenPen = vi.fn()
    render(<Harness onOpenPen={onOpenPen} />)
    fireEvent.doubleClick(chips().querySelector('[data-block-pen="primary"]') as HTMLElement)
    expect(onOpenPen).toHaveBeenCalledWith("work")
  })

  it("offers Name this group only with two or more pens and a group handler", () => {
    const onNameGroup = vi.fn()
    const { unmount } = render(<Harness onNameGroup={onNameGroup} />)
    expect(screen.queryByRole("button", { name: "Name this group…" })).not.toBeInTheDocument()
    unmount()

    render(<Harness extras={["chores"]} onNameGroup={onNameGroup} />)
    fireEvent.click(screen.getByRole("button", { name: "Name this group…" }))
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Band" } })
    fireEvent.click(screen.getByRole("button", { name: "Save group" }))
    expect(onNameGroup).toHaveBeenCalledWith("Band", expect.any(String), ["work", "chores"])
  })
})
