/**
 * NeedsAttention — Home card omits the stale reason.
 */
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import type { Task } from "@/lib/types"
import { NeedsAttention } from "./NeedsAttention"

const NOW = new Date("2026-06-23T12:00:00.000Z")

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    description: overrides.description ?? "Task",
    stage: "clarified",
    createdAt: NOW,
    completed: false,
    lists: [],
    scheduledDate: NOW,
    ...overrides,
  }
}

describe("NeedsAttention", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not show stale-only items or a Stale tag", () => {
    taskRepository.add(
      task({
        id: "stale-only",
        description: "Aging unscheduled task",
        createdAt: daysAgo(30),
        scheduledDate: undefined,
      }),
    )
    taskRepository.add(
      task({
        id: "overdue",
        description: "Late report",
        deadline: daysAgo(2),
      }),
    )
    taskRepository.add(
      task({
        id: "inbox-and-stale",
        description: "Old inbox item",
        stage: "inbox",
        createdAt: daysAgo(40),
        scheduledDate: undefined,
      }),
    )

    render(<NeedsAttention onOpenItem={() => {}} options={{ now: NOW }} />)

    expect(screen.queryByText("Aging unscheduled task")).not.toBeInTheDocument()
    expect(screen.queryByText("Stale")).not.toBeInTheDocument()
    expect(screen.getByText("Late report")).toBeInTheDocument()
    expect(screen.getByText("Old inbox item")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Unclarified" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument()
  })
})
