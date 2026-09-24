import { describe, expect, it } from "vitest"
import { pickFriendSuggestion } from "./friend-suggestion"
import { speciesPersonality } from "./baby-animal-personality"
import { TaskType, type Folder, type Task, type WeeklyTask } from "@/lib/types"

const folders: Folder[] = [{ id: "naf", name: "Next Actions", createdAt: new Date("2026-09-21"), listIds: ["na"] }]
const now = new Date("2026-09-21T12:00:00")

function task(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "scheduled",
    createdAt: new Date("2026-09-21T12:00:00"),
    completed: false,
    lists: ["na"],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@work",
    entropy: 0.5,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...extra,
  }
}

function habit(id: string, name: string): WeeklyTask {
  return { id, name, type: TaskType.BOOLEAN, frequency: "daily" }
}

const mix = [
  task("na-1", "File the taxes"),
  task("day-1", "Buy oats", { lists: ["errands"], scheduledDate: now }),
]

describe("pickFriendSuggestion source bias", () => {
  it("lets a hedgehog prefer an open daily habit", () => {
    const picked = pickFriendSuggestion(mix, folders, null, () => 0, {
      personality: speciesPersonality("hedgehog"),
      habits: [habit("h1", "Brush fur")],
      weeklyData: {},
      now,
    })
    expect(picked.source).toBe("habit")
    expect(picked.line).toMatch(/Brush fur/)
  })

  it("lets a crow prefer a Next Action over today's To Do", () => {
    const picked = pickFriendSuggestion(mix, folders, null, () => 0, {
      personality: speciesPersonality("crow"),
      habits: [habit("h1", "Brush fur")],
      weeklyData: {},
      now,
    })
    expect(picked.source).toBe("nextAction")
    expect(picked.taskId).toBe("na-1")
  })

  it("lets a puppy prefer today's To Do", () => {
    const picked = pickFriendSuggestion(mix, folders, null, () => 0, {
      personality: speciesPersonality("puppy"),
      habits: [habit("h1", "Brush fur")],
      weeklyData: {},
      now,
    })
    expect(picked.source).toBe("todo")
    expect(picked.taskId).toBe("day-1")
  })

  it("falls through when the favorite source is empty", () => {
    const picked = pickFriendSuggestion([task("na-1", "File the taxes")], folders, null, () => 0, {
      personality: speciesPersonality("hedgehog"),
      habits: [],
      weeklyData: {},
      now,
    })
    expect(picked.source).toBe("nextAction")
    expect(picked.taskId).toBe("na-1")
  })

  it("can say I love you or offer a whim when flavor is on", () => {
    const love = pickFriendSuggestion(mix, folders, null, () => 0, {
      personality: { ...speciesPersonality("kitten"), loveYouRate: 100, whimRate: 0 },
      flavor: true,
      now,
    })
    expect(love.kind).toBe("affection")
    expect(love.line.toLowerCase()).toMatch(/love you|favorite|fine|proud/)

    const whim = pickFriendSuggestion(mix, folders, null, () => 0, {
      personality: { ...speciesPersonality("owl"), loveYouRate: 0, whimRate: 100, whimId: "read" },
      flavor: true,
      now,
    })
    expect(whim.kind).toBe("whim")
    expect(whim.title.toLowerCase()).toMatch(/read/)
  })

  it("boosts titles the species loves", () => {
    const rows = [
      task("na-1", "File the taxes"),
      task("na-2", "Read a chapter"),
    ]
    const picked = pickFriendSuggestion(rows, folders, null, () => 0, {
      personality: speciesPersonality("owl"),
      now,
    })
    expect(picked.taskId).toBe("na-2")
  })
})
