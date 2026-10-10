import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PersonDetail } from "@/components/People/person-detail"
import { findGiftIdeasFolder, findGiftIdeasList } from "@/lib/gift-ideas"
import { createListItem } from "@/lib/item-utils"
import { PERSON_ATTR, PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

const TODAY = new Date(2026, 9, 10)

function Biography({ person: initial }: { person: Task }) {
  const [person, setPerson] = useState(initial)
  return (
    <PersonDetail
      person={person}
      today={TODAY}
      onChange={(patch) => setPerson((prev) => ({ ...prev, ...patch }))}
    />
  )
}

function person(extra: Partial<Task> = {}): Task {
  return { ...createListItem("Ada", []), id: "ada", type: PERSON_TYPE_ID, ...extra }
}

describe("PersonDetail", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("shows days until the birthday beside a pixel cake, and edits birthday and standing notes once", () => {
    render(
      <Biography
        person={person({
          attributes: { [PERSON_ATTR.birthday]: "1990-10-12", [PERSON_ATTR.notes]: "Brings soup" },
        })}
      />,
    )

    expect(screen.getByText("2 days until next birthday.")).toBeInTheDocument()
    const cake = document.querySelector(".person-birthday .person-cake")
    expect(cake?.tagName.toLowerCase()).toBe("svg")
    expect(cake?.innerHTML).toContain("#7dffc4")
    expect(document.querySelector(".person-birthday img")).toBeNull()

    fireEvent.change(screen.getByLabelText("Birthday"), { target: { value: "1990-10-10" } })
    expect(screen.getByText("Birthday today.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Brings soup on Sundays" } })
    expect(screen.getByLabelText("Notes")).toHaveValue("Brings soup on Sundays")
  })

  it("keeps a name, an estimated date met, an Instagram handle, and an address at the chosen precision", () => {
    render(<Biography person={person()} />)

    expect(screen.getByText("Known for Date met is not set.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } })
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Lovelace")

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "A.L." } })
    fireEvent.click(screen.getByRole("button", { name: "Add nickname" }))
    expect(screen.getByText("A.L.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Date met"), { target: { value: "2020-01-15" } })
    fireEvent.click(screen.getByLabelText("Date met is estimated"))
    expect(screen.getByText("Known for About 6 years, 8 months, 25 days.")).toBeInTheDocument()

    const instagram = screen.getByLabelText("Instagram")
    fireEvent.change(instagram, { target: { value: "https://instagram.com/ada/?hl=en" } })
    fireEvent.blur(instagram)
    expect(instagram).toHaveValue("ada")

    fireEvent.change(screen.getByLabelText("Address precision"), { target: { value: "neighborhood" } })
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "SoMa" } })
    expect(screen.getByLabelText("Address")).toHaveAttribute("placeholder", "Neighborhood")
    expect(screen.getByLabelText("Address")).toHaveValue("SoMa")
  })

  it("counts a saw and joined Company time, and keeps a call that was not seen out of last saw", () => {
    useTimeTrackingStore.setState({
      entries: [
        { id: "elsewhere", date: "2026-10-09", scopeId: "activity", penId: "co-together", startMin: 600, endMin: 660 },
        { id: "painted", date: "2026-09-02", scopeId: "company", penId: "co-together", startMin: 600, endMin: 660 },
        { id: "block-1", date: "2026-10-08", scopeId: "company", penId: "co-alone", startMin: 600, endMin: 660 },
      ],
    })
    render(
      <Biography
        person={person({
          personPipelines: [
            { id: "pen", kind: "company-pen", penId: "co-together" },
            { id: "block", kind: "company-timeblock", entryId: "block-1" },
          ],
          personProfile: {
            interactions: [{ id: "call", date: "2026-10-09", text: "Called" }],
          },
        })}
      />,
    )

    expect(screen.getByText("Last saw 2 days ago.")).toBeInTheDocument()
    expect(screen.getByText("Called")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Interactions date"), { target: { value: "2026-10-10" } })
    fireEvent.change(screen.getByLabelText("Interaction"), { target: { value: "Texted" } })
    fireEvent.click(screen.getByRole("button", { name: "Add interaction" }))
    expect(screen.getByText("Texted")).toBeInTheDocument()
    expect(screen.getByText("Last saw 2 days ago.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("checkbox", { name: "Saw them Called" }))
    expect(screen.getByText("Last saw 1 day ago.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Dated notes date"), { target: { value: "2026-10-01" } })
    fireEvent.change(screen.getByLabelText("Dated note"), { target: { value: "Brought soup" } })
    fireEvent.click(screen.getByRole("button", { name: "Add note" }))
    expect(screen.getByText("Brought soup")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Gift note"), { target: { value: "Notebook" } })
    fireEvent.click(screen.getByRole("button", { name: "Add gift note" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Given Notebook" }))
    expect(screen.getByRole("checkbox", { name: "Given Notebook" })).toBeChecked()
  })

  it("keeps an optional relation, and Close creates a gift list that stays when Close is turned off", () => {
    render(<Biography person={person()} />)
    expect(screen.queryByRole("region", { name: "Gift ideas" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Relation"), { target: { value: "sister" } })
    expect(screen.getByLabelText("Relation")).toHaveValue("sister")

    fireEvent.click(screen.getByLabelText("Close"))
    const list = findGiftIdeasList(useTaskStore.getState().lists, "ada")
    expect(list?.name).toBe("Gift ideas for Ada")
    expect(list?.giftIdeasPersonId).toBe("ada")
    expect(findGiftIdeasFolder(useTaskStore.getState().folders)?.listIds).toContain(list?.id)
    expect(screen.getByRole("region", { name: "Gift ideas" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Gift notes" })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Gift idea"), { target: { value: "Scarf" } })
    fireEvent.click(screen.getByRole("button", { name: "Add to gift ideas" }))
    expect(screen.getByTestId("gift-ideas-item")).toHaveTextContent("Scarf")
    expect(useTaskStore.getState().tasks.some((task) => task.title === "Scarf" && task.lists?.includes(list!.id))).toBe(
      true,
    )

    fireEvent.click(screen.getByLabelText("Close"))
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")?.id).toBe(list?.id)
    expect(screen.getByRole("region", { name: "Gift ideas" })).toBeInTheDocument()
  })
})
