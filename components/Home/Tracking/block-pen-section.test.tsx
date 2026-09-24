import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TrackPen } from "@/lib/time-tracking-store"
import { BlockPenSection } from "./block-pen-section"

const pens: TrackPen[] = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "rest", name: "Rest", color: "#10b981" },
  { id: "chores", name: "Chores", color: "#8b5cf6" },
]

function renderSection(
  props: Partial<{
    primaryId: string
    secondaryPenIds: string[]
    onPrimary: (id: string) => void
    onSecondaries: (ids: string[]) => void
    onCreate: (name: string, color: string) => void
  }> = {},
) {
  const onPrimary = props.onPrimary ?? vi.fn()
  const onSecondaries = props.onSecondaries ?? vi.fn()
  const onCreate = props.onCreate ?? vi.fn()
  render(
    <BlockPenSection
      pens={pens}
      primaryId={props.primaryId ?? "work"}
      secondaryPenIds={props.secondaryPenIds ?? []}
      onPrimary={onPrimary}
      onSecondaries={onSecondaries}
      onCreate={onCreate}
    />,
  )
  return { onPrimary, onSecondaries, onCreate }
}

describe("BlockPenSection", () => {
  it("defaults to associated pens only — not the full library", () => {
    renderSection({ secondaryPenIds: ["chores"] })

    const onBlock = screen.getByRole("group", { name: "Pens on this block" })
    expect(onBlock).toHaveTextContent("Work")
    expect(onBlock).toHaveTextContent("Chores")
    expect(screen.queryByRole("button", { name: "Rest" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add a secondary pen")).not.toBeInTheDocument()
  })

  it("reveals search, new pen, and every color after add pen color", () => {
    renderSection()

    fireEvent.click(screen.getByRole("button", { name: "add pen color" }))

    expect(screen.getByRole("button", { name: "add pen color" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Search pens")).toBeInTheDocument()
    expect(screen.getByLabelText("New pen name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rest" })).toBeInTheDocument()
    expect(screen.getByLabelText("Add a secondary pen")).toBeInTheDocument()
  })

  it("attaches another pen from the library as a secondary", () => {
    const { onSecondaries } = renderSection()

    fireEvent.click(screen.getByRole("button", { name: "add pen color" }))
    fireEvent.change(screen.getByLabelText("Add a secondary pen"), { target: { value: "chores" } })
    const chores = screen.getAllByRole("button", { name: "Chores" })
    fireEvent.click(chores[chores.length - 1])

    expect(onSecondaries).toHaveBeenCalledWith(["chores"])
  })
})
