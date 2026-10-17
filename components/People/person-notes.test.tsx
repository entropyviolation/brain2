import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PersonNotes } from "@/components/People/person-notes"
import { PERSON_ATTR, PERSON_TYPE_ID } from "@/lib/person-types"
import type { Task } from "@/lib/types"

function Harness({ initial, onState }: { initial: Task; onState: (t: Task) => void }) {
  const [person, setPerson] = useState(initial)
  return (
    <PersonNotes
      person={person}
      onChange={(patch) =>
        setPerson((prev) => {
          const next = { ...prev, ...patch }
          onState(next)
          return next
        })
      }
    />
  )
}

function ada(extra: Partial<Task>): Task {
  return { id: "ada", title: "Ada", type: PERSON_TYPE_ID, ...extra } as Task
}

describe("PersonNotes", () => {
  it("shows old dated notes and the standing attribute, and folds on the first edit", async () => {
    const user = userEvent.setup()
    let state: Task | null = null
    render(
      <Harness
        initial={ada({
          attributes: { [PERSON_ATTR.notes]: "Brings soup" },
          personProfile: { relation: "friend", noteLog: [{ id: "p1", date: "2026-01-10", text: "Met at the lab" }] },
        })}
        onState={(t) => (state = t)}
      />,
    )
    expect(screen.getByText("Met at the lab")).toBeInTheDocument()
    expect(screen.getByLabelText("Standing note")).toHaveValue("Brings soup")
    expect(state).toBeNull()

    await user.type(screen.getByLabelText("New note"), "Moved to Leeds")
    await user.click(screen.getByRole("button", { name: /add entry/i }))
    expect(state!.noteLog?.map((e) => e.text).sort()).toEqual(["Met at the lab", "Moved to Leeds"])
    expect(state!.personProfile).toEqual({ relation: "friend" })
  })

  it("writes the standing note to the notes attribute", () => {
    let state: Task | null = null
    render(<Harness initial={ada({ attributes: { [PERSON_ATTR.notes]: "Brings soup" } })} onState={(t) => (state = t)} />)
    const field = screen.getByLabelText("Standing note")
    fireEvent.change(field, { target: { value: "Brings soup on Sundays" } })
    fireEvent.blur(field)
    expect(state!.attributes?.[PERSON_ATTR.notes]).toBe("Brings soup on Sundays")
    expect(state!.notes).toBeUndefined()
  })

  it("moves captured task notes into the standing note without losing either", async () => {
    const user = userEvent.setup()
    let state: Task | null = null
    render(
      <Harness
        initial={ada({ notes: "From the inbox", attributes: { [PERSON_ATTR.notes]: "Brings soup" } })}
        onState={(t) => (state = t)}
      />,
    )
    expect(screen.getByText("From the inbox")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Move into standing note" }))
    expect(state!.attributes?.[PERSON_ATTR.notes]).toBe("Brings soup\n\nFrom the inbox")
    expect(state!.notes).toBeUndefined()
    expect(screen.queryByText("Captured")).not.toBeInTheDocument()
  })
})
