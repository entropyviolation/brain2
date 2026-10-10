import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { createListItem } from "@/lib/item-utils"
import { ensurePeopleIKnowList } from "@/lib/people-i-know"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"

describe("PersonPipelinesEditor", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("adds a company pen on the person", () => {
    const listId = ensurePeopleIKnowList()
    const person = { ...createListItem("Ada", [listId]), id: "ada", type: PERSON_TYPE_ID }
    const onChange = vi.fn()
    render(<PersonPipelinesEditor mode="person" person={person} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText("Company pen to attach"), { target: { value: "co-together" } })
    fireEvent.click(screen.getByRole("button", { name: "Add pen" }))

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ kind: "company-pen", penId: "co-together" })
  })

  it("creates a person joined to this company pen", () => {
    render(<PersonPipelinesEditor mode="pen" penId="co-alone" />)
    fireEvent.change(screen.getByLabelText("New person"), { target: { value: "Jonah" } })
    fireEvent.click(screen.getByRole("button", { name: "Add person" }))

    const people = useTaskStore.getState().tasks.filter((task) => task.type === PERSON_TYPE_ID)
    expect(people.map((task) => task.title)).toContain("Jonah")
    expect(people.find((task) => task.title === "Jonah")?.personPipelines?.[0]).toMatchObject({
      kind: "company-pen",
      penId: "co-alone",
    })
    expect(screen.getByText(/Jonah/)).toBeInTheDocument()
  })

  it("lists a timeblock pipeline in list settings", () => {
    const listId = ensurePeopleIKnowList()
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "block-1",
          date: "2026-10-09",
          scopeId: "company",
          penId: "co-alone",
          startMin: 600,
          endMin: 660,
        },
      ],
    })
    useTaskStore.getState().addTask({
      ...createListItem("Ada", [listId]),
      id: "ada",
      type: PERSON_TYPE_ID,
      personPipelines: [{ id: "row-1", kind: "company-timeblock", entryId: "block-1" }],
    })

    render(<PersonPipelinesEditor mode="list" />)
    expect(screen.getByTestId("person-pipeline-row")).toHaveTextContent("Ada")
    expect(screen.getByTestId("person-pipeline-row")).toHaveTextContent("2026-10-09")
  })

  it("shows company blocks from the joined pen, not from a per-block attach", () => {
    useTimeTrackingStore.setState({
      entries: [
        { id: "painted", date: "2026-10-09", scopeId: "company", penId: "co-together", startMin: 600, endMin: 660 },
        { id: "other", date: "2026-10-09", scopeId: "company", penId: "co-alone", startMin: 700, endMin: 760 },
      ],
    })
    const person = {
      ...createListItem("Ada", []),
      id: "ada",
      type: PERSON_TYPE_ID,
      personPipelines: [{ id: "pen", kind: "company-pen" as const, penId: "co-together" }],
    }
    render(<PersonPipelinesEditor mode="person" person={person} onChange={vi.fn()} />)

    const blocks = screen.getAllByTestId("person-company-block")
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toHaveTextContent("2026-10-09")
    expect(blocks[0]).toHaveTextContent("Together")
    expect(screen.queryByRole("button", { name: "Add timeblock" })).not.toBeInTheDocument()
  })

  it("shows the people whose pen color is on a company block", () => {
    const listId = ensurePeopleIKnowList()
    useTimeTrackingStore.setState({
      entries: [
        { id: "block-1", date: "2026-10-09", scopeId: "company", penId: "co-together", startMin: 600, endMin: 660 },
      ],
    })
    useTaskStore.getState().addTask({
      ...createListItem("Ada", [listId]),
      id: "ada",
      type: PERSON_TYPE_ID,
      personPipelines: [{ id: "pen", kind: "company-pen", penId: "co-together" }],
    })

    render(<PersonPipelinesEditor mode="entry" entryId="block-1" />)
    expect(screen.getByTestId("company-block-person")).toHaveTextContent("Ada")
    expect(screen.queryByLabelText("Person to attach")).not.toBeInTheDocument()
  })
})
