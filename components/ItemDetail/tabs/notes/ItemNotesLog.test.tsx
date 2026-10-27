import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import type { ItemNoteEntry } from "@/lib/types"
import { ItemNotesLog } from "./ItemNotesLog"

function Harness({ initial = [] as ItemNoteEntry[] }) {
  const [entries, setEntries] = useState<ItemNoteEntry[] | undefined>(initial)
  const [standing, setStanding] = useState("")
  return (
    <>
      <ItemNotesLog entries={entries} standing={standing} onChangeEntries={setEntries} onChangeStanding={setStanding} />
      <output data-testid="count">{entries?.length ?? 0}</output>
    </>
  )
}

describe("ItemNotesLog", () => {
  it("adds dated entries, newest first, and removes them", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: "old", date: "2020-01-02", text: "first ever" }]} />)
    await user.type(screen.getByLabelText("New note"), "fresh thought")
    await user.click(screen.getByRole("button", { name: /add entry/i }))
    const rows = screen.getAllByTestId("note-entry")
    expect(rows[0]).toHaveTextContent("fresh thought")
    expect(rows[1]).toHaveTextContent("first ever")
    expect(screen.getByText("Today")).toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: "Delete note" })[1])
    expect(screen.getByTestId("count")).toHaveTextContent("1")
  })

  it("adds with Cmd+Enter on a chosen past day", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    fireEvent.change(screen.getByLabelText("Note day"), { target: { value: "2024-03-05" } })
    await user.type(screen.getByLabelText("New note"), "back then{Meta>}{Enter}{/Meta}")
    expect(screen.getByText("2024-03-05")).toBeInTheDocument()
    expect(screen.getByTestId("note-entry")).toHaveTextContent("back then")
  })

  it("keeps the old notes string as a pinned standing note", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: /pin a standing note/i }))
    expect(screen.getByLabelText("Standing note")).toBeInTheDocument()
  })
})
