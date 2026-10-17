import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { PersonDetail } from "@/components/People/person-detail"
import { createListItem } from "@/lib/item-utils"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { pickOption } from "@/tests/native-select"

const search = vi.fn()
vi.mock("@/lib/geo-address", () => ({
  searchAddresses: (...args: unknown[]) => search(...args),
  withParts: async (s: unknown) => s,
}))

const SUGGESTION = {
  id: "p1",
  name: "1 Main St",
  label: "1 Main St, SoMa, San Francisco, USA",
  lat: 37.77,
  lng: -122.41,
  parts: { neighborhood: "SoMa", city: "San Francisco", country: "USA" },
  source: "photon" as const,
}

let saved: Task | null = null

function Host() {
  const [person, setPerson] = useState<Task>({ ...createListItem("Ada", []), id: "ada", type: PERSON_TYPE_ID })
  saved = person
  return (
    <PersonDetail
      person={person}
      today={new Date(2026, 9, 10)}
      onChange={(patch) => setPerson((prev) => ({ ...prev, ...patch }))}
    />
  )
}

async function typeAndWait(field: HTMLElement, text: string) {
  fireEvent.focus(field)
  fireEvent.change(field, { target: { value: text } })
  await act(async () => {
    vi.advanceTimersByTime(320)
  })
}

describe("AddressSuggestInput on a person", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers()
    search.mockReset()
    search.mockResolvedValue([SUGGESTION])
  })
  afterEach(() => vi.useRealTimers())

  it("waits for 3 characters, then shows suggestions", async () => {
    render(<Host />)
    const field = screen.getByLabelText("Address")
    await typeAndWait(field, "1 M")
    expect(search).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("option", { name: /1 Main St/ })).toBeInTheDocument()
    search.mockClear()
    await typeAndWait(field, "1 ")
    expect(search).not.toHaveBeenCalled()
  })

  it("stores the label and coordinates on a pick, and shows a map pin", async () => {
    render(<Host />)
    const field = screen.getByLabelText("Address")
    await typeAndWait(field, "1 Main")
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("option", { name: /1 Main St/ }))
    })
    expect(saved?.personProfile?.address).toEqual({
      precision: "mailing",
      text: SUGGESTION.label,
      lat: 37.77,
      lng: -122.41,
      parts: SUGGESTION.parts,
      source: "photon",
    })
    expect(field).toHaveValue(SUGGESTION.label)
    expect(screen.getByTestId("person-address-pin")).toHaveAttribute("href", expect.stringContaining("mlat=37.77"))
    // Blur after a pick does not overwrite it with typed text.
    fireEvent.blur(field)
    expect(saved?.personProfile?.address?.lat).toBe(37.77)
  })

  it("picks with the keyboard and keeps the neighborhood line at that precision", async () => {
    render(<Host />)
    pickOption(screen.getByLabelText("Address precision"), "neighborhood")
    const field = screen.getByLabelText("Address")
    await typeAndWait(field, "1 Main")
    fireEvent.keyDown(field, { key: "ArrowDown" })
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" })
    })
    expect(saved?.personProfile?.address).toMatchObject({ precision: "neighborhood", text: "SoMa, San Francisco", lat: 37.77 })
  })

  it("still saves plain text when the search finds nothing", async () => {
    search.mockResolvedValue([])
    render(<Host />)
    const field = screen.getByLabelText("Address")
    await typeAndWait(field, "Somewhere odd")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    fireEvent.blur(field)
    expect(saved?.personProfile?.address).toEqual({ precision: "mailing", text: "Somewhere odd" })
  })
})
