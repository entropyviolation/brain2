/**
 * Cmd/Ctrl-Z pops action history except when a text field is focused.
 */
import { render } from "@testing-library/react"
import { useEffect } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { canUndo, undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { isNativeUndoTarget, isRedoChord, isUndoChord, useUndoHotkey } from "./useUndoHotkey"

function Host() {
  useUndoHotkey()
  useEffect(() => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-17", "activity", 540, 600, "act-work")
  }, [])
  return <input aria-label="notes" defaultValue="typed" />
}

beforeEach(() => {
  resetAllStores()
})

describe("undo hotkey", () => {
  it("undoes on Cmd+Z when focus is not in a field", () => {
    render(<Host />)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }))
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })

  it("redoes on Cmd+Shift+Z", () => {
    render(<Host />)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }))
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true, bubbles: true }),
    )
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
  })

  it("leaves a text field's Cmd+Z to the browser", () => {
    const { getByLabelText } = render(<Host />)
    const field = getByLabelText("notes")
    field.focus()
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }))
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(canUndo()).toBe(true)
  })
})

describe("chord helpers", () => {
  it("recognises undo and redo chords", () => {
    expect(isUndoChord(new KeyboardEvent("keydown", { key: "z", metaKey: true }))).toBe(true)
    expect(isUndoChord(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))).toBe(true)
    expect(isUndoChord(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true }))).toBe(false)
    expect(isRedoChord(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true }))).toBe(true)
    expect(isRedoChord(new KeyboardEvent("keydown", { key: "y", ctrlKey: true }))).toBe(true)
  })

  it("treats text inputs as native undo targets and buttons as ours", () => {
    const text = document.createElement("input")
    text.type = "text"
    expect(isNativeUndoTarget(text)).toBe(true)
    const time = document.createElement("input")
    time.type = "time"
    expect(isNativeUndoTarget(time)).toBe(true)
    const button = document.createElement("input")
    button.type = "button"
    expect(isNativeUndoTarget(button)).toBe(false)
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    expect(isNativeUndoTarget(checkbox)).toBe(false)
  })
})

describe("undoLastAction without the hook", () => {
  it("is the same stack the hotkey pops", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-17", "activity", 540, 600, "act-work")
    expect(undoLastAction()).toBe(true)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })
})
