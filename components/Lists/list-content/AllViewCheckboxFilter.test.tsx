import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AllViewCheckboxFilter } from "./AllViewCheckboxFilter"

describe("AllViewCheckboxFilter", () => {
  const items = [
    { id: "list-1", name: "list 1" },
    { id: "list-2", name: "list 2" },
  ]

  it("selects every list and Uncategorized", () => {
    const onSetHiddenIds = vi.fn()
    const onUncategorizedChange = vi.fn()
    render(
      <AllViewCheckboxFilter
        items={items}
        hiddenIds={["list-1"]}
        onHiddenChange={vi.fn()}
        onSetHiddenIds={onSetHiddenIds}
        ariaLabel="Filter lists"
        uncategorizedChecked={false}
        onUncategorizedChange={onUncategorizedChange}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Select all" }))
    expect(onSetHiddenIds).toHaveBeenCalledWith([])
    expect(onUncategorizedChange).toHaveBeenCalledWith(true)
  })

  it("deselects every list and Uncategorized", () => {
    const onSetHiddenIds = vi.fn()
    const onUncategorizedChange = vi.fn()
    render(
      <AllViewCheckboxFilter
        items={items}
        hiddenIds={[]}
        onHiddenChange={vi.fn()}
        onSetHiddenIds={onSetHiddenIds}
        ariaLabel="Filter lists"
        uncategorizedChecked
        onUncategorizedChange={onUncategorizedChange}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }))
    expect(onSetHiddenIds).toHaveBeenCalledWith(["list-1", "list-2"])
    expect(onUncategorizedChange).toHaveBeenCalledWith(false)
  })

  it("disables Select all when everything is already selected", () => {
    render(
      <AllViewCheckboxFilter
        items={items}
        hiddenIds={[]}
        onHiddenChange={vi.fn()}
        ariaLabel="Filter lists"
        uncategorizedChecked
        onUncategorizedChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: "Select all" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeEnabled()
  })
})
