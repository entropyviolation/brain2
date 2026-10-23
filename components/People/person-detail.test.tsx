import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PersonDetail } from "@/components/People/person-detail"
import { findGiftIdeasFolder, findGiftIdeasList } from "@/lib/gift-ideas"
import { createListItem } from "@/lib/item-utils"
import { PERSON_ATTR, PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { pickOption } from "@/tests/native-select"

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

  it("shows days until the birthday beside a pixel cake, edits the birthday, and leaves notes to the Notes tab", () => {
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

    // Standing and dated notes moved to the Notes tab (plan 3.3).
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Dated notes" })).not.toBeInTheDocument()
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

    pickOption(screen.getByLabelText("Address precision"), "neighborhood")
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "SoMa" } })
    expect(screen.getByLabelText("Address")).toHaveAttribute("placeholder", "Neighborhood")
    expect(screen.getByLabelText("Address")).toHaveValue("SoMa")
  })

  it("opens the Instagram report on the person's handle", () => {
    render(<Biography person={person({ personProfile: { instagram: "ada" } })} />)
    fireEvent.click(screen.getByTestId("person-view-instagram"))
    expect(window.sessionStorage.getItem("brain2-instagram-open")).toBe("ada")
  })

  it("hides the Instagram data key without a handle", () => {
    render(<Biography person={person()} />)
    expect(screen.queryByTestId("person-view-instagram")).toBeNull()
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

    expect(screen.getByText("Last seen 2 days ago.")).toBeInTheDocument()
    expect(screen.getByText("Called")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Interactions date"), { target: { value: "2026-10-10" } })
    fireEvent.change(screen.getByLabelText("Interaction"), { target: { value: "Texted" } })
    fireEvent.click(screen.getByRole("button", { name: "Add interaction" }))
    expect(screen.getByText("Texted")).toBeInTheDocument()
    expect(screen.getByText("Last seen 2 days ago.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("checkbox", { name: "Saw them Called" }))
    expect(screen.getByText("Last seen 1 day ago.")).toBeInTheDocument()

    // Gift notes moved into the Gift ideas popup (plan 3.4).
    fireEvent.click(screen.getByTestId("gift-ideas-key"))
    fireEvent.change(screen.getByLabelText("Gift note"), { target: { value: "Notebook" } })
    fireEvent.click(screen.getByRole("button", { name: "Add gift note" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Given Notebook" }))
    expect(screen.getByRole("checkbox", { name: "Given Notebook" })).toBeChecked()
  })

  it("keeps an optional relation, and Close creates a gift list that stays when Close is turned off", () => {
    render(<Biography person={person()} />)
    expect(screen.getByTestId("gift-ideas-key")).toHaveTextContent("Start gift ideas")

    fireEvent.change(screen.getByLabelText("Relation"), { target: { value: "sister" } })
    expect(screen.getByLabelText("Relation")).toHaveValue("sister")

    fireEvent.click(screen.getByLabelText("Close"))
    const list = findGiftIdeasList(useTaskStore.getState().lists, "ada")
    expect(list?.name).toBe("Gift ideas for Ada")
    expect(list?.giftIdeasPersonId).toBe("ada")
    expect(findGiftIdeasFolder(useTaskStore.getState().folders)?.listIds).toContain(list?.id)
    expect(screen.getByTestId("gift-ideas-key")).toHaveTextContent("Gift ideas for Ada · 0")

    fireEvent.click(screen.getByTestId("gift-ideas-key"))
    expect(screen.getByRole("region", { name: "Gift ideas" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Gift notes" })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Gift idea"), { target: { value: "Scarf" } })
    fireEvent.click(screen.getByRole("button", { name: "Add to gift ideas" }))
    expect(screen.getByTestId("gift-ideas-item")).toHaveTextContent("Scarf")
    expect(useTaskStore.getState().tasks.some((task) => task.title === "Scarf" && task.lists?.includes(list!.id))).toBe(
      true,
    )

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    fireEvent.click(screen.getByLabelText("Close"))
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")?.id).toBe(list?.id)
    expect(screen.getByTestId("gift-ideas-key")).toHaveTextContent("Gift ideas for Ada · 1")
  })

  it("starts a gift list from the key without turning Close on, renames it, and opens it", async () => {
    const user = userEvent.setup({ delay: null })
    const onNavigateToList = vi.fn()
    function Host() {
      const [p, setP] = useState(person())
      return (
        <PersonDetail
          person={p}
          today={TODAY}
          onChange={(patch) => setP((prev) => ({ ...prev, ...patch }))}
          onNavigateToList={onNavigateToList}
        />
      )
    }
    render(<Host />)
    await user.click(screen.getByTestId("gift-ideas-key"))
    const list = findGiftIdeasList(useTaskStore.getState().lists, "ada")
    expect(list?.name).toBe("Gift ideas for Ada")
    expect(screen.getByRole("switch", { name: "Close", hidden: true })).toHaveAttribute("aria-checked", "false")

    await user.click(screen.getByRole("button", { name: "Rename" }))
    const field = screen.getByLabelText("List name")
    await user.clear(field)
    await user.type(field, "Ada birthday{Enter}")
    expect(findGiftIdeasList(useTaskStore.getState().lists, "ada")?.name).toBe("Ada birthday")

    await user.click(screen.getByRole("button", { name: "Open list" }))
    expect(onNavigateToList).toHaveBeenCalledWith(list?.id)
    expect(screen.queryByRole("region", { name: "Gift notes" })).not.toBeInTheDocument()
  })

  it("reads as one biography: orb, birthday, readouts, fields, time, pens slot, interactions, gifts", () => {
    render(
      <PersonDetail person={person()} today={TODAY} onChange={vi.fn()} pipelines={<div data-testid="pens-slot" />} />,
    )
    const order = [
      screen.getByRole("button", { name: "Change orb" }),
      screen.getByLabelText("Birthday"),
      screen.getByRole("switch", { name: "Close" }),
      screen.getByLabelText("Full name"),
      screen.getByLabelText("Address"),
      screen.getByTestId("person-time"),
      screen.getByTestId("pens-slot"),
      screen.getByRole("region", { name: "Interactions" }),
      screen.getByTestId("gift-ideas-key"),
    ]
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it("adds nicknames with Enter or a comma and removes the last with Backspace", async () => {
    const user = userEvent.setup({ delay: null })
    render(<Biography person={person()} />)
    const field = screen.getByLabelText("Nickname")
    await user.type(field, "Ace{Enter}")
    await user.type(field, "Lady A,")
    expect(screen.getByText("Ace")).toBeInTheDocument()
    expect(screen.getByText("Lady A")).toBeInTheDocument()
    await user.type(field, "{Backspace}")
    expect(screen.queryByText("Lady A")).not.toBeInTheDocument()
    expect(screen.getByText("Ace")).toBeInTheDocument()
  })

  it("opens the orb picker from the orb well and writes the pick on the draft", async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    render(<PersonDetail person={person()} today={TODAY} onChange={onChange} />)
    const well = screen.getByRole("button", { name: "Change orb" })
    expect(well.querySelector("img")?.getAttribute("src")).toBeTruthy()
    await user.click(well)
    expect(await screen.findByText("Choose an Icon")).toBeInTheDocument()
    const orb = document.querySelector("[role=dialog] img") as HTMLElement
    await user.click(orb.closest("button") ?? orb)
    expect(onChange).toHaveBeenCalledWith({ icon: expect.any(String) })
  })

  it("types into a name without writing the draft per key, then commits once on blur", async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    const onLive = vi.fn()
    let draft: Task = person()
    render(
      <PersonDetail
        person={person()}
        today={TODAY}
        onChange={onChange}
        onLive={(patch) => {
          onLive(patch)
          draft = { ...draft, ...patch }
        }}
        readDraft={() => draft}
      />,
    )
    await user.type(screen.getByLabelText("Full name"), "Elijah ")
    expect(onLive).toHaveBeenCalledTimes(7)
    expect(onChange).not.toHaveBeenCalled()
    expect(draft.personProfile?.fullName).toBe("Elijah ")

    await user.type(screen.getByLabelText("Relation"), "friend")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].personProfile.fullName).toBe("Elijah")
    // The second field merged from the live draft, so the name kept.
    expect(draft.personProfile?.fullName).toBe("Elijah ")
    expect(draft.personProfile?.relation).toBe("friend")
  })
})
