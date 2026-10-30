import { describe, expect, it } from "vitest"
import { TaskType, type Task, type WeeklyTask } from "@/lib/types"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { earnedLootStacks, lootSlotCount, lootStackLabel, lootSummary } from "./earned-stacks"

const DAY = new Date(2026, 5, 19, 12)

function habit(partial: Partial<WeeklyTask> & Pick<WeeklyTask, "id" | "name">): WeeklyTask {
  return {
    type: TaskType.BOOLEAN,
    frequency: "daily",
    gem: "/gems-removebackground/gem5.png",
    ...partial,
  }
}

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    stage: "completed",
    createdAt: DAY,
    description: partial.title ?? partial.id,
    completed: true,
    completedDate: DAY,
    lists: [],
    ...partial,
  }
}

describe("earnedLootStacks", () => {
  it("stacks one gem per day a daily habit is met", () => {
    const stacks = earnedLootStacks({
      habits: [habit({ id: "water", name: "Drink water" })],
      weeklyData: {
        "2026-06-19": { water: { completed: true } },
        "2026-06-20": { water: { completed: true } },
        "2026-06-21": { water: { completed: false } },
      },
      tasks: [],
    })
    expect(stacks).toEqual([
      {
        id: "gem\n/gems-removebackground/gem5.png",
        kind: "gem",
        src: "/gems-removebackground/gem5.png",
        count: 2,
        names: ["Drink water"],
      },
    ])
    expect(lootSummary(stacks)).toBe("2 gems")
  })

  it("stacks the same stone from two habits and lists both names", () => {
    const stacks = earnedLootStacks({
      habits: [
        habit({ id: "water", name: "Drink water" }),
        habit({ id: "stretch", name: "Stretch" }),
      ],
      weeklyData: {
        "2026-06-19": {
          water: { completed: true },
          stretch: { completed: true },
        },
      },
      tasks: [],
    })
    expect(stacks).toHaveLength(1)
    expect(stacks[0]?.count).toBe(2)
    expect(stacks[0]?.names).toEqual(["Drink water", "Stretch"])
    expect(lootStackLabel(stacks[0]!)).toBe("Drink water, Stretch")
  })

  it("keeps different stones apart and skips weekly habits", () => {
    const stacks = earnedLootStacks({
      habits: [
        habit({ id: "water", name: "Drink water", gem: "/gems-removebackground/gem5.png" }),
        habit({
          id: "week",
          name: "Weekly review",
          frequency: "weekly",
          gem: "/gems-removebackground/gem6.png",
        }),
      ],
      weeklyData: {
        "2026-06-19": {
          water: { completed: true },
          week: { completed: true },
        },
      },
      tasks: [],
    })
    expect(stacks.map((stack) => stack.src)).toEqual(["/gems-removebackground/gem5.png"])
  })

  it("counts each finished task's Lists orb, including one with no custom icon", () => {
    const stacks = earnedLootStacks({
      habits: [],
      weeklyData: {},
      tasks: [
        task({ id: "pen", title: "Buy pen", icon: "/orbs-removebackground/pen.png" }),
        task({ id: "ink", title: "Buy ink", icon: "/orbs-removebackground/pen.png" }),
        task({ id: "open", title: "Still open", completed: false, icon: "/orbs-removebackground/pen.png" }),
        task({ id: "plain", title: "No icon" }),
      ],
    })
    expect(stacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "trinket",
          src: "/orbs-removebackground/pen.png",
          count: 2,
          names: ["Buy ink", "Buy pen"],
        }),
        expect.objectContaining({
          kind: "trinket",
          names: ["No icon"],
          count: 1,
          src: expect.stringMatching(/^\/orbs-removebackground\//),
        }),
      ]),
    )
    expect(stacks).toHaveLength(2)
    expect(lootSummary(stacks)).toBe("3 trinkets")
  })

  it("does not turn a habit-done row into a trinket, and does not count that day twice", () => {
    const water = habit({ id: "water", name: "Drink water" })
    const stacks = earnedLootStacks({
      habits: [water],
      weeklyData: { "2026-06-19": { water: { completed: true } } },
      tasks: [
        task({
          id: habitDoneLogId("water", DAY),
          title: "Drink water",
          loggedAction: true,
          icon: "/orbs-removebackground/pen.png",
          attributes: { sourceHabitId: "water" },
        }),
      ],
    })
    expect(stacks).toHaveLength(1)
    expect(stacks[0]).toMatchObject({ kind: "gem", count: 1 })
  })

  it("counts a habit-done row when the day is missing from weekly data", () => {
    const stacks = earnedLootStacks({
      habits: [habit({ id: "water", name: "Drink water" })],
      weeklyData: {},
      tasks: [task({ id: habitDoneLogId("water", DAY), title: "Drink water", loggedAction: true })],
    })
    expect(stacks[0]).toMatchObject({ kind: "gem", count: 1, names: ["Drink water"] })
  })

  it("sorts gems ahead of trinkets", () => {
    const stacks = earnedLootStacks({
      habits: [habit({ id: "water", name: "Drink water" })],
      weeklyData: { "2026-06-19": { water: { completed: true } } },
      tasks: [task({ id: "pen", title: "Buy pen", icon: "/orbs-removebackground/pen.png" })],
    })
    expect(stacks.map((stack) => stack.kind)).toEqual(["gem", "trinket"])
    expect(lootSummary(stacks)).toBe("1 gem · 1 trinket")
    expect(lootSummary([])).toBe("No gems or trinkets.")
  })

  it("pads the bag to a full row", () => {
    expect(lootSlotCount(0, 8, 24)).toBe(24)
    expect(lootSlotCount(25, 8, 24)).toBe(32)
    expect(lootSlotCount(3, 4, 12)).toBe(12)
  })
})
