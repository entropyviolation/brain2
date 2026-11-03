import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { periodWindowFromKey, windowDateKeys } from "@/lib/period-summary"
import { usePeriodSummaryStore } from "@/lib/period-summary-store"
import { PeriodSummaryFields } from "./period-summary-fields"
import { PlaylistPlate } from "./period-summary-plates"

const october = periodWindowFromKey("month:2026-10")!

describe("period summary fields", () => {
  beforeEach(() => usePeriodSummaryStore.setState({ byKey: {} }))

  it("pastes songs, keeps a note on one, and the plate reads it back", () => {
    render(<PeriodSummaryFields window={october} dateKeys={windowDateKeys(october)} />)
    expect(screen.getByPlaceholderText("October Songs")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/Paste songs/), {
      target: { value: "Linger — The Cranberries\nDreams - Fleetwood Mac" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add songs" }))
    fireEvent.change(screen.getByLabelText("Note on Linger"), { target: { value: "rainy walks" } })
    fireEvent.change(screen.getByPlaceholderText(/playlist link/), {
      target: { value: "https://open.spotify.com/playlist/abc123" },
    })

    const record = usePeriodSummaryStore.getState().byKey["month:2026-10"]
    expect(record.songs.map((s) => s.title)).toEqual(["Linger", "Dreams"])
    expect(record.songs[0].note).toBe("rainy walks")

    render(<PlaylistPlate record={record} window={october} />)
    expect(screen.getByTitle("October Songs")).toHaveAttribute("src", "https://open.spotify.com/embed/playlist/abc123")
    expect(screen.getByText("rainy walks", { selector: ".ps-song-note" })).toBeInTheDocument()
  })
})
