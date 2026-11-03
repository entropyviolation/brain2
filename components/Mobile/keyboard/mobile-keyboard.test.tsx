/**
 * components/Mobile/keyboard/mobile-keyboard.test.tsx — The deck types into the field.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { MobileKeyboard } from "./mobile-keyboard"

function Note() {
  const [value, setValue] = useState("")
  return (
    <>
      <label>
        Note
        <input aria-label="Note" autoCapitalize="none" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <MobileKeyboard />
    </>
  )
}

function press(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name }))
}

describe("MobileKeyboard", () => {
  it("types a capital, deletes it, and hides the system keyboard", () => {
    render(<Note />)
    const note = screen.getByLabelText("Note")
    act(() => note.focus())
    expect(screen.getByRole("group", { name: "Keyboard" })).toBeInTheDocument()
    expect(note).toHaveAttribute("inputmode", "none")
    press("n")
    expect(note).toHaveValue("n")
    press("shift")
    press("n")
    expect(note).toHaveValue("nN")
    press("delete")
    expect(note).toHaveValue("n")
    press("numbers")
    press("1")
    expect(note).toHaveValue("n1")
  })

  it("hides when the field blurs", async () => {
    render(<Note />)
    const note = screen.getByLabelText("Note")
    act(() => note.focus())
    press("hide keyboard")
    await waitFor(() => {
      expect(screen.queryByRole("group", { name: "Keyboard" })).toBeNull()
    })
    expect(note).not.toHaveAttribute("inputmode")
  })

  it("gives a tap between caps to a key instead of dropping it", () => {
    render(<Note />)
    const note = screen.getByLabelText("Note")
    act(() => note.focus())
    const row = screen.getByRole("button", { name: "q" }).parentElement as HTMLElement
    fireEvent.pointerDown(row)
    expect(note).toHaveValue("q")
  })

  it("keeps the deck up through a blur nobody asked for, and a key brings the field back", async () => {
    render(<Note />)
    const note = screen.getByLabelText("Note")
    act(() => note.focus())
    act(() => note.blur())
    await act(() => new Promise((done) => setTimeout(done, 20)))
    expect(screen.getByRole("group", { name: "Keyboard" })).toBeInTheDocument()
    press("n")
    expect(note).toHaveFocus()
    expect(note).toHaveValue("n")
  })

  it("keeps deck taps away from document listeners, so a popup does not read them as outside taps", () => {
    render(<Note />)
    act(() => screen.getByLabelText("Note").focus())
    const heard = vi.fn()
    document.addEventListener("pointerdown", heard)
    fireEvent.pointerDown(screen.getByRole("button", { name: "q" }))
    document.removeEventListener("pointerdown", heard)
    expect(heard).not.toHaveBeenCalled()
  })

  it("closes after the grace moment when the user taps away from the field", async () => {
    render(<Note />)
    const note = screen.getByLabelText("Note")
    act(() => note.focus())
    fireEvent.pointerDown(document.body)
    act(() => note.blur())
    await waitFor(() => {
      expect(screen.queryByRole("group", { name: "Keyboard" })).toBeNull()
    })
  })
})
