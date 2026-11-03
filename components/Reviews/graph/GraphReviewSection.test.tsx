/**
 * components/Reviews/graph/GraphReviewSection.test.tsx — Weekly graph review is read-only: a fixture graph shows its suggestions
 * and opening the section does not write the task store.
 */
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import "@/lib/person-relations"
import { graphReview } from "@/lib/graph/graph-review"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { GraphReviewSection } from "./GraphReviewSection"

function linked(id: string, links: [string, string][] = []): Task {
  return {
    id,
    description: id,
    title: id,
    stage: "scheduled",
    createdAt: new Date(2026, 9, 1, 12, 0, 0),
    completed: false,
    lists: [],
    links: links.map(([relation, targetId], index) => ({ id: `${id}-${index}`, relation, targetId })),
  }
}

describe("GraphReviewSection", () => {
  beforeEach(() => {
    resetAllStores()
    useGraphInboxStore.setState({ proposals: [] })
  })

  it("shows the fixture suggestion count and does not write tasks", () => {
    const fixture = [
      linked("me", [["related", "a"], ["related", "b"]]),
      linked("a", [["related", "x"]]),
      linked("b", [["related", "x"]]),
      linked("x"),
      linked("lone"),
    ]
    for (const task of fixture) useTaskStore.getState().addTask(task)
    const tasks = useTaskStore.getState().tasks
    const review = graphReview(tasks, (id) => itemTitleOrUntitled(tasks.find((task) => task.id === id)))
    expect(review.suggestions.length).toBeGreaterThan(0)

    render(<GraphReviewSection />)

    const box = screen.getByTestId("graph-review")
    const list = within(box).getByText("Might be missing").nextElementSibling as HTMLElement
    expect(list.querySelectorAll("li")).toHaveLength(review.suggestions.length)
    expect(list).toHaveTextContent("me")
    expect(list).toHaveTextContent("x")
    expect(useTaskStore.getState().tasks).toBe(tasks)
    expect(useGraphInboxStore.getState().proposals).toEqual([])
  })
})
