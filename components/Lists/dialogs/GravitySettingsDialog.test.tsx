import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { GravitySettingsDialog } from "@/components/Lists/dialogs/GravitySettingsDialog"
import { DEFAULT_GRAVITY_FIELD_PARAMS } from "@/components/Lists/lib/list-icon-gravity"
import { useListsUiStore } from "@/lib/lists-ui-store"

describe("GravitySettingsDialog", () => {
  beforeEach(() => {
    useListsUiStore.getState().resetListIconsGravityField()
  })

  it("updates global G without flipping Gravity on/off", () => {
    useListsUiStore.setState({ listIconsGravity: { "list-1": true } })
    render(<GravitySettingsDialog open onOpenChange={vi.fn()} />)
    const slider = screen.getByLabelText("Global gravity (G)")
    fireEvent.change(slider, { target: { value: "1.5" } })
    expect(useListsUiStore.getState().listIconsGravityField.globalG).toBe(1.5)
    expect(useListsUiStore.getState().listIconsGravity["list-1"]).toBe(true)
  })

  it("updates a source gain and reset restores defaults", () => {
    render(<GravitySettingsDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Shared tags"), { target: { value: "1.2" } })
    expect(useListsUiStore.getState().listIconsGravityField.sources.tag).toBe(1.2)
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }))
    expect(useListsUiStore.getState().listIconsGravityField).toEqual({
      globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
      sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
      attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
    })
  })

  it("Done closes via onOpenChange", () => {
    const onOpenChange = vi.fn()
    render(<GravitySettingsDialog open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
