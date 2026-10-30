/**
 * components/Mobile/keyboard/mobile-keyboard.test.tsx — The deck types into the field.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
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
})
