/**
 * Cmd/Ctrl-Z pops Tracking action history except when a text field is focused.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { useEffect, type ReactNode } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { canUndo, peekUndoLabel, resetActionHistory } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { handleTrackingUndoKey, TRACKING_ACTION_LABELS, useTrackingUndoHotkey } from "./tracking-undo"

const DAY = "2026-09-17"

function paintWork(start = 540, end = 600) {
  useTimeTrackingStore.getState().paintMinutes(DAY, "activity", start, end, "act-work")
}

function Host({ children }: { children?: ReactNode }) {
  useTrackingUndoHotkey()
  useEffect(() => {
    paintWork()
  }, [])
  return (
    <>
      <div tabIndex={0} data-testid="timegrid">
        grid
      </div>
      <input aria-label="notes" defaultValue="typed" />
      {children}
    </>
  )
}

beforeEach(() => {
  resetAllStores()
  resetActionHistory()
})

describe("Tracking undo hotkey", () => {
  it("undoes the last created timeblock on Cmd+Z when the grid is focused", () => {
    render(<Host />)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(peekUndoLabel()).toBe("paint")

    screen.getByTestId("timegrid").focus()
    fireEvent.keyDown(screen.getByTestId("timegrid"), { key: "z", metaKey: true })

    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(canUndo()).toBe(false)
  })

  it("undoes the last created timeblock on Ctrl+Z", () => {
    render(<Host />)
    fireEvent.keyDown(screen.getByTestId("timegrid"), { key: "z", ctrlKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })

  it("does not intercept Cmd+Z inside a text input", () => {
    render(<Host />)
    const field = screen.getByLabelText("notes")
    field.focus()
    fireEvent.keyDown(field, { key: "z", metaKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(canUndo()).toBe(true)
  })

  it("does not intercept Cmd+Z inside a textarea", () => {
    render(
      <Host>
        <textarea aria-label="composer" defaultValue="jot" />
      </Host>,
    )
    const field = screen.getByLabelText("composer")
    field.focus()
    fireEvent.keyDown(field, { key: "z", metaKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(canUndo()).toBe(true)
  })

  it("undoes a split back to the original block", () => {
    render(<Host />)
    const id = useTimeTrackingStore.getState().entries[0]?.id
    expect(id).toBeTruthy()
    useTimeTrackingStore.getState().splitEntryAt(id!, 570)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(2)
    expect(peekUndoLabel()).toBe("split block")

    fireEvent.keyDown(screen.getByTestId("timegrid"), { key: "z", metaKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(useTimeTrackingStore.getState().entries[0]).toMatchObject({ startMin: 540, endMin: 600 })
  })

  it("redoes on Cmd+Shift+Z", () => {
    render(<Host />)
    fireEvent.keyDown(screen.getByTestId("timegrid"), { key: "z", metaKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    fireEvent.keyDown(screen.getByTestId("timegrid"), { key: "z", metaKey: true, shiftKey: true })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
  })
})

describe("handleTrackingUndoKey", () => {
  it("pops a paint when the target is not a field", () => {
    paintWork()
    const grid = document.createElement("div")
    document.body.appendChild(grid)
    const event = new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true })
    Object.defineProperty(event, "target", { value: grid })
    expect(handleTrackingUndoKey(event)).toBe(true)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    grid.remove()
  })

  it("leaves a text input's Cmd+Z alone", () => {
    paintWork()
    const input = document.createElement("input")
    input.type = "text"
    document.body.appendChild(input)
    const event = new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true })
    Object.defineProperty(event, "target", { value: input })
    expect(handleTrackingUndoKey(event)).toBe(false)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(canUndo()).toBe(true)
    input.remove()
  })

  it("names the Tracking writes the stack records", () => {
    expect(TRACKING_ACTION_LABELS).toContain("paint")
    expect(TRACKING_ACTION_LABELS).toContain("erase")
    expect(TRACKING_ACTION_LABELS).toContain("edit block")
    expect(TRACKING_ACTION_LABELS).toContain("split block")
    expect(TRACKING_ACTION_LABELS).toContain("move block")
    expect(TRACKING_ACTION_LABELS).toContain("delete block")
  })
})
