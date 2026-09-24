import { describe, expect, it } from "vitest"
import { TaskType } from "@/lib/types"
import {
  habitContributesWillpowerStone,
  weekWillpowerStones,
  willpowerStoneId,
} from "@/lib/willpower-stones"

const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 21 + i))

const drink = {
  id: "drink",
  name: "Drink water",
  type: TaskType.BOOLEAN,
  rewardValue: 10,
  frequency: "daily" as const,
  gem: "/gems-removebackground/gem5.png",
}

const stretch = {
  id: "stretch",
  name: "Stretch",
  type: TaskType.BOOLEAN,
  rewardValue: 10,
  frequency: "daily" as const,
  gem: "/gems-removebackground/gem.png",
}

const weekly = {
  id: "weekly-review",
  name: "Weekly review",
  type: TaskType.BOOLEAN,
  rewardValue: 10,
  frequency: "weekly" as const,
  gem: "/gems-removebackground/gem3.png",
}

describe("willpower stones", () => {
  it("places one stone per completion of the same habit this week", () => {
    const weeklyData = {
      "2026-09-21": { drink: { completed: true } },
      "2026-09-22": { drink: { completed: true } },
      "2026-09-23": { drink: { completed: true } },
    }
    const stones = weekWillpowerStones([drink, stretch], weeklyData, week)
    expect(stones).toHaveLength(3)
    expect(stones.every((s) => s.src === drink.gem && s.name === "Drink water")).toBe(true)
    expect(stones.map((s) => s.id)).toEqual([
      willpowerStoneId("drink", "2026-09-21"),
      willpowerStoneId("drink", "2026-09-22"),
      willpowerStoneId("drink", "2026-09-23"),
    ])
  })

  it("collects a daily habit completed on any day of the visible week", () => {
    const weeklyData = {
      "2026-09-23": { drink: { completed: true } },
    }
    expect(habitContributesWillpowerStone(drink, weeklyData, week)).toBe(true)
    expect(weekWillpowerStones([drink, stretch], weeklyData, week)).toEqual([
      { id: willpowerStoneId("drink", "2026-09-23"), src: drink.gem, name: "Drink water" },
    ])
  })

  it("drops that day's copy when uncompleted", () => {
    const three = {
      "2026-09-21": { drink: { completed: true } },
      "2026-09-22": { drink: { completed: true } },
      "2026-09-23": { drink: { completed: true } },
    }
    expect(weekWillpowerStones([drink], three, week)).toHaveLength(3)
    const two = {
      ...three,
      "2026-09-22": { drink: { completed: false } },
    }
    expect(weekWillpowerStones([drink], two, week).map((s) => s.id)).toEqual([
      willpowerStoneId("drink", "2026-09-21"),
      willpowerStoneId("drink", "2026-09-23"),
    ])
  })

  it("drops every stone when today was the only hit and is uncompleted", () => {
    const done = { "2026-09-21": { drink: { completed: true } } }
    expect(habitContributesWillpowerStone(drink, done, week)).toBe(true)
    const undone = { "2026-09-21": { drink: { completed: false } } }
    expect(habitContributesWillpowerStone(drink, undone, week)).toBe(false)
    expect(weekWillpowerStones([drink], undone, week)).toEqual([])
  })

  it("keeps invert (any-day) when another day in the week is still complete", () => {
    const data = {
      "2026-09-21": { drink: { completed: false } },
      "2026-09-24": { drink: { completed: true } },
    }
    expect(habitContributesWillpowerStone(drink, data, week)).toBe(true)
  })

  it("ignores weekly habits and incomplete dailies", () => {
    const weeklyData = {
      "2026-09-21": { "weekly-review": { completed: true } },
    }
    expect(habitContributesWillpowerStone(weekly, weeklyData, week)).toBe(false)
    expect(habitContributesWillpowerStone(stretch, {}, week)).toBe(false)
  })
})
