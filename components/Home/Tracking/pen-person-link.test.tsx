import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PenPersonLink } from "@/components/Home/Tracking/pen-person-link"
import { createListItem } from "@/lib/item-utils"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import { defaultIphoneTextsScope, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"

const PEN = { id: "iphone-text-1-555-123-4567", name: "+1 (555) 123-4567", color: "#000" }

describe("PenPersonLink", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.setState({
      tasks: [
        { ...createListItem("Ana", []), id: "ana", type: PERSON_TYPE_ID },
        { ...createListItem("Bo", []), id: "bo", type: PERSON_TYPE_ID, personProfile: { phones: ["555-123-4567"] } },
      ],
    })
    const scope = { ...defaultIphoneTextsScope(), pens: [PEN] }
    const rest = useTimeTrackingStore.getState().scopes.filter((s) => s.id !== scope.id)
    useTimeTrackingStore.setState({ scopes: [...rest, scope] })
  })

  const pen = () => useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-texts")!.pens[0]
  const profile = (id: string) => useTaskStore.getState().tasks.find((t) => t.id === id)?.personProfile

  it("links the number to a person found by search, moving it off anyone else", () => {
    render(<PenPersonLink scopeId="iphone-texts" penId={PEN.id} />)
    fireEvent.change(screen.getByLabelText("Search People I Know"), { target: { value: "an" } })
    fireEvent.click(screen.getByRole("option", { name: /Ana/ }))
    expect(profile("ana")?.phones).toEqual(["+15551234567"])
    expect(profile("bo")?.phones).toBeUndefined()
    expect(pen()).toMatchObject({ name: "Ana", personId: "ana", handle: "+15551234567" })
    expect(screen.getByText("Ana")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }))
    expect(profile("ana")?.phones).toBeUndefined()
    expect(pen().personId).toBeUndefined()
    expect(pen().name).toBe("+1 (555) 123-4567")
  })
})
