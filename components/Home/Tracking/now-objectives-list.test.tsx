/**
 * components/Home/Tracking/now-objectives-list.test.tsx
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { NowObjectivesList } from "./now-objectives-list"
import type { NowObjective } from "@/lib/now-objective"

const seed: NowObjective[] = [
  { id: "a", text: "finish the nest", addedAt: "2026-10-10T12:00:00.000Z" },
  {
    id: "b",
    text: "already done",
    addedAt: "2026-10-10T12:01:00.000Z",
    completedAt: "2026-10-10T12:05:00.000Z",
  },
]

describe("NowObjectivesList", () => {
  it("opens a popup without requiring layout change, adds and completes", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onToggleComplete = vi.fn()
    const onEditText = vi.fn()

    render(
      <NowObjectivesList
        objectives={seed}
        onAdd={onAdd}
        onEditText={onEditText}
        onToggleComplete={onToggleComplete}
      />,
    )

    expect(screen.queryByTestId("now-objectives-pop")).not.toBeInTheDocument()
    await user.click(screen.getByTestId("now-objectives-trigger"))
    expect(screen.getByTestId("now-objectives-pop")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: /Objectives for right now/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Mark objective complete: finish the nest/i }))
    expect(onToggleComplete).toHaveBeenCalledWith("a")

    await user.type(screen.getByRole("textbox", { name: "Add objective" }), "one more")
    await user.click(screen.getByRole("button", { name: "Add objective" }))
    expect(onAdd).toHaveBeenCalledWith("one more")
  })

  it("logs a completed objective, hides done rows, and opens delete from the row", async () => {
    const user = userEvent.setup()
    const onAddCompleted = vi.fn()
    const onRemove = vi.fn()

    render(
      <NowObjectivesList
        objectives={seed}
        onAdd={() => {}}
        onAddCompleted={onAddCompleted}
        onEditText={() => {}}
        onToggleComplete={() => {}}
        onRemove={onRemove}
        onSaveForLater={() => {}}
        onAttach={() => {}}
      />,
    )

    await user.click(screen.getByTestId("now-objectives-trigger"))
    await user.type(screen.getByRole("textbox", { name: "Add objective" }), "already finished")
    await user.click(screen.getByRole("button", { name: "Completed objective" }))
    expect(onAddCompleted).toHaveBeenCalledWith("already finished")

    expect(screen.getByDisplayValue("already done")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hide completed" }))
    expect(screen.queryByDisplayValue("already done")).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("finish the nest")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show completed" }))
    expect(screen.getByDisplayValue("already done")).toBeInTheDocument()

    await user.click(screen.getByText(/added /))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onRemove).toHaveBeenCalledWith("a")
  })

  it("inline mode shows the list without a trigger", () => {
    render(
      <NowObjectivesList
        mode="inline"
        objectives={seed}
        onAdd={() => {}}
        onEditText={() => {}}
        onToggleComplete={() => {}}
      />,
    )
    expect(screen.getByTestId("now-objectives-inline")).toBeInTheDocument()
    expect(screen.queryByTestId("now-objectives-trigger")).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("finish the nest")).toBeInTheDocument()
  })
})
