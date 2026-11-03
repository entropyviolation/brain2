/**
 * Gems and Trinkets bag — stacks from the stores, count on a full slot.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { TaskType } from "@/lib/types"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"
import { GemsScene } from "./gems-scene"

describe("GemsScene", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({
      tasks: [
        {
          id: "water",
          name: "Drink water",
          type: TaskType.BOOLEAN,
          frequency: "daily",
          gem: "/gems-removebackground/gem5.png",
        },
      ],
      weeklyData: {
        "2026-06-19": { water: { completed: true } },
        "2026-06-20": { water: { completed: true } },
      },
    })
    useTaskStore.setState({
      lists: [],
      folders: [],
      tasks: [
        {
          id: "pen",
          title: "Buy pen",
          description: "Buy pen",
          stage: "completed",
          createdAt: new Date(2026, 5, 19),
          completed: true,
          lists: [],
          icon: "/orbs-removebackground/pen.png",
        },
      ] as never,
    })
  })

  it("shows a stacked gem count and the assigned trinket", async () => {
    const user = userEvent.setup()
    render(<GemsScene surface="desk" />)
    expect(screen.getByTestId("gems-scene")).toHaveTextContent("2 gems · 1 trinket")

    const water = screen.getByRole("button", { name: "Drink water, gem, 2" })
    expect(water).toHaveTextContent("2")
    expect(screen.getByRole("button", { name: "Buy pen, trinket, 1" })).not.toHaveTextContent("1")

    await user.click(water)
    expect(screen.getByText("Drink water · Gem · 2")).toBeInTheDocument()
  })
})
