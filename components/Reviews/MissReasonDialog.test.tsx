import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { MENU_LAYER_Z } from "@/components/ui/menu-layer"
import type { StoredBlockedReason } from "@/lib/types"
import { MissReasonDialog } from "./MissReasonDialog"
import { WhyBlockedControl } from "./WhyBlockedControl"

describe("MissReasonDialog", () => {
  it("skips without a reason", () => {
    const onResolve = vi.fn()
    render(<MissReasonDialog open subject="Slides" onResolve={onResolve} />)
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(onResolve).toHaveBeenCalledWith(undefined)
  })

  it("saves a preset and a note", () => {
    const onResolve = vi.fn()
    render(<MissReasonDialog open subject="Slides" onResolve={onResolve} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Why blocked? Slides" }))
    fireEvent.click(screen.getByRole("option", { name: "No time" }))
    fireEvent.change(screen.getByLabelText("Note for Slides"), { target: { value: "the rain" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onResolve).toHaveBeenCalledWith({ reason: "no-time", note: "the rain" })
  })

  it("saves typed words with no preset as Other", () => {
    const onResolve = vi.fn()
    render(<MissReasonDialog open subject="Slides" onResolve={onResolve} />)
    fireEvent.change(screen.getByLabelText("Note for Slides"), { target: { value: "the rain" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onResolve).toHaveBeenCalledWith({ reason: "other", note: "the rain" })
  })

  it("uses a multiline note and paints the reason menu above the dialog", () => {
    render(<MissReasonDialog open subject="Slides" onResolve={vi.fn()} />)
    const note = screen.getByLabelText("Note for Slides")
    expect(note.tagName).toBe("TEXTAREA")
    expect(note).toHaveAttribute("rows", "6")
    expect(note.className).toContain("min-h-[7.5rem]")
    expect(note.className).toContain("max-h-40")
    expect(note.className).toContain("overflow-y-auto")

    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toContain("z-[120]")
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]")
    expect(dialog.className).toContain("overflow-y-auto")

    fireEvent.click(screen.getByRole("combobox", { name: "Why blocked? Slides" }))
    const listbox = screen.getByRole("listbox")
    expect(dialog.contains(listbox)).toBe(false)
    expect(listbox.className).toContain(`z-[${MENU_LAYER_Z}]`)
    expect(listbox.className).toContain("pointer-events-auto")
    expect(listbox).toHaveStyle({ zIndex: String(MENU_LAYER_Z) })
    const wrapper = listbox.closest("[data-radix-popper-content-wrapper]")
    expect(wrapper).toHaveStyle({ zIndex: String(MENU_LAYER_Z) })
  })

  it("keeps a space in the note while typing, and trims it on save", async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    render(<MissReasonDialog open subject="Slides" onResolve={onResolve} />)
    const note = screen.getByLabelText("Note for Slides")
    await user.type(note, "the ")
    expect(note).toHaveValue("the ")
    await user.type(note, "rain ")
    expect(note).toHaveValue("the rain ")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onResolve).toHaveBeenCalledWith({ reason: "other", note: "the rain" })
  })
})

function RitualOtherHarness() {
  const [value, setValue] = useState<StoredBlockedReason | undefined>("other")
  return <WhyBlockedControl taskTitle="Slides" value={value} onChange={setValue} />
}

describe("WhyBlockedControl note field", () => {
  it("keeps a space in the ritual Other field", async () => {
    const user = userEvent.setup()
    render(<RitualOtherHarness />)
    const field = screen.getByLabelText("Other reason for Slides")
    await user.type(field, "the rain")
    expect(field).toHaveValue("the rain")
  })
})
