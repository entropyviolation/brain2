import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingTagsPanel } from "./tracking-tags-panel"
import { TagSettingsHost } from "./tag-settings-host"
import { openTagSettings } from "./open-tag-settings"

beforeEach(() => {
  resetAllStores()
})

function renderWell() {
  return render(
    <div className="trk95">
      <TagSettingsHost />
      <TrackingTagsPanel />
    </div>,
  )
}

describe("TrackingTagsPanel", () => {
  it("lists seeded tags on a steel well with beads, not pastel fills", () => {
    renderWell()

    const well = screen.getByRole("region", { name: "Tag library" })
    expect(well).toHaveClass("trk-tags-well")
    expect(well.querySelector(".trk-silk")).toHaveTextContent("Tags")

    const keys = well.querySelectorAll(".trk-tag-key")
    expect(keys.length).toBe(useTimeTrackingStore.getState().tags.length)
    expect(well.querySelectorAll(".trk-tag-bead").length).toBe(keys.length)
    expect(screen.getAllByRole("listitem")).toHaveLength(keys.length)

    expect(well).toHaveTextContent("Work")
    expect(well).toHaveTextContent("Rest")
    expect(well).toHaveTextContent(/1 pen/)
    expect(screen.getByRole("button", { name: "Edit tag Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete tag Work" })).toBeInTheDocument()
  })

  it("adds a tag from the inset New tag field", () => {
    renderWell()

    const field = screen.getByLabelText("New tag name")
    expect(field.closest(".trk-tag-add")).toBeTruthy()
    fireEvent.change(field, { target: { value: "Cooking" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))

    expect(useTimeTrackingStore.getState().tags.some((t) => t.name === "Cooking")).toBe(true)
    expect(screen.getByText("Cooking")).toBeInTheDocument()
    expect(screen.getByLabelText("New tag name")).toHaveValue("")
  })

  it("opens tag settings from Edit and renames there", async () => {
    renderWell()
    fireEvent.click(screen.getByRole("button", { name: "Edit tag Sleep" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Tag name")).toHaveValue("Sleep")
    })
    fireEvent.change(screen.getByLabelText("Tag name"), { target: { value: "Night" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => {
      expect(useTimeTrackingStore.getState().tags.some((t) => t.name === "Night")).toBe(true)
    })
    expect(screen.getByText("Night")).toBeInTheDocument()
  })

  it("opens tag settings when openTagSettings is called for a key", async () => {
    renderWell()
    const sleep = useTimeTrackingStore.getState().tags.find((t) => t.name === "Sleep")!
    openTagSettings(sleep.id)
    await waitFor(() => {
      expect(screen.getByLabelText("Tag name")).toHaveValue("Sleep")
    })
  })

  it("deletes a tag after confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    renderWell()
    fireEvent.click(screen.getByRole("button", { name: "Delete tag Rest" }))
    expect(useTimeTrackingStore.getState().tags.some((t) => t.name === "Rest")).toBe(false)
    expect(screen.queryByText("Rest")).not.toBeInTheDocument()
  })
})
