import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingFind } from "./tracking-find"

describe("TrackingFind", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("lists a block by its title and jumps when that row is chosen", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-20", "activity", 13 * 60, 14 * 60, "act-exercise", undefined, undefined, undefined, {
      title: "walk to the beach",
    })
    const onJump = vi.fn()
    render(<TrackingFind onJump={onJump} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Find blocks" }), { target: { value: "beach" } })
    fireEvent.click(screen.getByRole("option", { name: /walk to the beach/ }))
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-09-20", label: "walk to the beach" }))
    expect(screen.queryByRole("listbox", { name: "Matching blocks" })).not.toBeInTheDocument()
  })
})
