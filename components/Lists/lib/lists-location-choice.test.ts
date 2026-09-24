import { describe, expect, it, vi } from "vitest"
import { chooseListsLocation } from "./lists-location-choice"

describe("chooseListsLocation", () => {
  it("clears search before navigating so results never trap the new folder", () => {
    const order: string[] = []
    const navigate = vi.fn((loc: string) => {
      order.push(`nav:${loc}`)
    })
    const clearSearch = vi.fn(() => {
      order.push("clear")
    })
    chooseListsLocation("folder-next-actions", navigate, clearSearch)
    expect(clearSearch).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith("folder-next-actions")
    expect(order).toEqual(["clear", "nav:folder-next-actions"])
  })

  it("still clears when the chosen location is the one already open", () => {
    const navigate = vi.fn()
    const clearSearch = vi.fn()
    chooseListsLocation("home", navigate, clearSearch)
    expect(clearSearch).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith("home")
  })
})
