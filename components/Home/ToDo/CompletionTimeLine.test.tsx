import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Task } from "@/lib/types"
import { confirmEstimates, makeEstimate } from "@/lib/estimated-values"
import { CompletionTimeLine, formatCompletionWindow } from "./CompletionTimeLine"

const FINISH = new Date(2026, 8, 17, 20, 30)
const START = new Date(2026, 8, 17, 19, 50)

function row(overrides: Partial<Task> = {}): Task {
  return {
    id: "row",
    description: "Write at least 3 pages per day",
    stage: "completed",
    createdAt: FINISH,
    completed: true,
    completedDate: FINISH,
    startedAt: START,
    actualDuration: 40,
    lists: [],
    estimates: [
      makeEstimate("completedDate", "now", "assumed finished just now (8:30 PM)", FINISH),
      makeEstimate("startedAt", "now", "assumed finished just now (8:30 PM)", FINISH),
      makeEstimate("actualDuration", "rate", "4 pages × 10 min each", FINISH),
    ],
    ...overrides,
  } as Task
}

describe("CompletionTimeLine", () => {
  it("shows the window and duration, tilde-marked while assumed", () => {
    render(<CompletionTimeLine task={row()} completedAt={FINISH} history={[]} onConfirm={vi.fn()} />)
    expect(screen.getByText("~7:50 – 8:30 PM")).toBeInTheDocument()
    expect(screen.getByText("~40m")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /est\./i })).toBeInTheDocument()
  })

  it("drops the tilde and the chip once the times are confirmed", () => {
    const confirmed = row({ estimates: confirmEstimates(row().estimates, undefined, FINISH) })
    render(<CompletionTimeLine task={confirmed} completedAt={FINISH} history={[]} onConfirm={vi.fn()} />)
    expect(screen.getByText("7:50 – 8:30 PM")).toBeInTheDocument()
    expect(screen.getByText("40m")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /est\./i })).not.toBeInTheDocument()
  })

  it("explains the assumption in the chip's tooltip", () => {
    render(<CompletionTimeLine task={row()} completedAt={FINISH} history={[]} onConfirm={vi.fn()} />)
    expect(screen.getByRole("button", { name: /est\./i })).toHaveAttribute(
      "title",
      expect.stringContaining("4 pages × 10 min each"),
    )
  })

  it("confirms as-is with no changes from the check button", () => {
    const onConfirm = vi.fn()
    render(<CompletionTimeLine task={row()} completedAt={FINISH} history={[]} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTitle("These times look right — confirm them"))
    expect(onConfirm).toHaveBeenCalledWith("row", {})
  })

  it("corrects the finish time and duration inline", () => {
    const onConfirm = vi.fn()
    render(<CompletionTimeLine task={row()} completedAt={FINISH} history={[]} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: /est\./i }))
    fireEvent.change(screen.getByLabelText(/finished/i), { target: { value: "18:15" } })
    fireEvent.change(screen.getByLabelText(/took/i), { target: { value: "55" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onConfirm).toHaveBeenCalledWith("row", {
      completedAt: new Date(2026, 8, 17, 18, 15),
      durationMinutes: 55,
    })
  })

  it("leads with the date in week and month lists", () => {
    render(<CompletionTimeLine task={row()} completedAt={FINISH} history={[]} showDate />)
    expect(screen.getByText(/Sep 17, ~7:50 – 8:30 PM/)).toBeInTheDocument()
  })

  it("falls back to the finish time alone when no start is known", () => {
    expect(formatCompletionWindow(undefined, FINISH)).toBe("8:30 PM")
    expect(formatCompletionWindow(FINISH, FINISH)).toBe("8:30 PM")
    expect(formatCompletionWindow(new Date(2026, 8, 17, 11, 30), FINISH)).toBe("11:30 AM – 8:30 PM")
  })

  it("shows a read-only usually chip from peer history without rewriting estimates", () => {
    const peers: Task[] = [
      row({ id: "peer-a", actualDuration: 20, estimates: undefined }),
      row({ id: "peer-b", actualDuration: 50, estimates: undefined }),
    ]
    render(<CompletionTimeLine task={row({ estimates: undefined })} completedAt={FINISH} history={peers} />)
    expect(screen.getByText("usually ~35m")).toBeInTheDocument()
    expect(screen.getByTitle(/same title/i)).toBeInTheDocument()
  })
})
