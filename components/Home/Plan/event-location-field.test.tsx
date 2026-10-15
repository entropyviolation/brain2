import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { searchPlaces } from "@/lib/places-search"
import { EventLocationField, type EventPlace } from "./event-location-field"

vi.mock("@/lib/places-search", () => ({ searchPlaces: vi.fn() }))
const searchPlacesMock = vi.mocked(searchPlaces)

function Harness({ onValue }: { onValue: (v: EventPlace) => void }) {
  const [value, setValue] = useState<EventPlace>({ location: "" })
  return (
    <EventLocationField
      id="loc"
      value={value}
      onChange={(next) => {
        setValue(next)
        onValue(next)
      }}
    />
  )
}

describe("EventLocationField", () => {
  beforeEach(() => {
    resetAllStores()
    searchPlacesMock.mockReset()
    searchPlacesMock.mockResolvedValue([
      {
        id: "p1",
        name: "Petco",
        label: "Petco — 123 Main St",
        address: "123 Main St, San Diego",
        lat: 32.7,
        lng: -117.1,
        source: "photon",
      },
    ])
  })

  it("searches the map as you type and stores the pin on pick", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    await user.type(screen.getByRole("combobox"), "petc")
    const row = await screen.findByRole("option", { name: /Petco/ })
    await user.click(row)
    expect(onValue).toHaveBeenLastCalledWith({
      location: "Petco",
      locationAddress: "123 Main St, San Diego",
      locationLat: 32.7,
      locationLng: -117.1,
    })
    expect(screen.getByTestId("event-location-pinned")).toHaveTextContent("123 Main St")
  })

  it("typing over a picked place keeps free text and drops the pin", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    await user.type(screen.getByRole("combobox"), "petc")
    await user.click(await screen.findByRole("option", { name: /Petco/ }))
    await user.type(screen.getByRole("combobox"), "!")
    expect(onValue).toHaveBeenLastCalledWith({
      location: "Petco!",
      locationAddress: undefined,
      locationLat: undefined,
      locationLng: undefined,
    })
    await waitFor(() => expect(screen.queryByTestId("event-location-pinned")).not.toBeInTheDocument())
  })
})
