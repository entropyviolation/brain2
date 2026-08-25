/**
 * NeedsAttention — Home card omits the stale reason.
 */
import { fireEvent, render, screen } from "@testing-library/react"
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

    render(<NeedsAttention onOpenItem={() => {}} options={{ now: NOW }} defaultCollapsed={false} />)

    expect(screen.queryByText("Aging unscheduled task")).not.toBeInTheDocument()
    expect(screen.queryByText("Stale")).not.toBeInTheDocument()
    expect(screen.getByText("Late report")).toBeInTheDocument()
    expect(screen.getByText("Old inbox item")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Unclarified" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument()
  })

  it("starts collapsed by default and hides the queue", () => {
    taskRepository.add(task({ id: "overdue", description: "Late report", deadline: daysAgo(2) }))

    render(<NeedsAttention onOpenItem={() => {}} options={{ now: NOW }} />)

    expect(screen.getByRole("button", { name: /Needs Attention/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Late report")).not.toBeInTheDocument()
  })

  it("persists collapsed and expanded state in localStorage", () => {
    taskRepository.add(task({ id: "overdue", description: "Late report", deadline: daysAgo(2) }))

    render(<NeedsAttention onOpenItem={() => {}} options={{ now: NOW }} />)
    const toggle = screen.getByRole("button", { name: /Needs Attention/ })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(localStorage.getItem("cogs-home-needs-attention")).toBe("expanded")
    expect(screen.getByText("Late report")).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(localStorage.getItem("cogs-home-needs-attention")).toBe("collapsed")
    expect(screen.queryByText("Late report")).not.toBeInTheDocument()
  })

  it("restores the stored collapsed state after remount", () => {
    taskRepository.add(task({ id: "overdue", description: "Late report", deadline: daysAgo(2) }))
    localStorage.setItem("cogs-home-needs-attention", "collapsed")

    render(<NeedsAttention onOpenItem={() => {}} options={{ now: NOW }} defaultCollapsed={false} />)

    expect(screen.getByRole("button", { name: /Needs Attention/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Late report")).not.toBeInTheDocument()
  })
})
