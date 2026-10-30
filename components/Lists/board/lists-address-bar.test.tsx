import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ListsAddressBar } from "./lists-address-bar"

describe("ListsAddressBar", () => {
  it("keeps Address a label when the folder toggle is off", () => {
    render(<ListsAddressBar breadcrumb="Home" />)
    expect(screen.getByText("Address").tagName).toBe("SPAN")
    expect(screen.queryByRole("button", { name: "Address" })).toBeNull()
  })

  it("uses the Address label to toggle the folder tree", () => {
    const onToggleFolders = vi.fn()
    render(<ListsAddressBar breadcrumb="Home \\ Work" foldersOpen onToggleFolders={onToggleFolders} />)
    const address = screen.getByRole("button", { name: "Address" })
    expect(address).toHaveAttribute("aria-expanded", "true")
    expect(address).toHaveAttribute("aria-controls", "fm-folder-tree")
    address.click()
    expect(onToggleFolders).toHaveBeenCalledTimes(1)
  })
})
