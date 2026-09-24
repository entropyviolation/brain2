import { describe, it, expect } from "vitest"
import {
  beatTheClockMultiplier,
  resolveCompletionPoints,
  withListMembership,
  applyItemRules,
  isDayUnscheduledPlanned,
  MAX_BEAT_THE_CLOCK_BONUS,
  isTaskItem,
  countsInDone,
  createListItem,
  createNextActionItem,
  itemTitle,
  itemTitleOrUntitled,
  syncTitleFromDescription,
} from "./item-utils"
import type { Folder, ItemTypeDefinition, Task, List } from "@/lib/types"
import {
  buildCompletionTierAttributes,
  defaultCompletionTierValues,
  TIER_ATTR_IDS,
  TIER_POINTS,
} from "./completion-tiers"

describe("itemTitle", () => {
  it("prefers the canonical title", () => {
    expect(itemTitle({ title: "Buy milk", description: "Buy milk" })).toBe("Buy milk")
  })

  it("falls back to the legacy description mirror", () => {
    expect(itemTitle({ description: "Buy milk" })).toBe("Buy milk")
  })

  it("lets title win when the two have drifted apart", () => {
    // The whole point of the seam: before it, some call sites read
    // `description || title` and others `title || description`, so a renamed
    // item showed its old name in half the app.
    expect(itemTitle({ title: "Buy oat milk", description: "Buy milk" })).toBe("Buy oat milk")
  })

  it("treats a blank or whitespace-only title as absent", () => {
    expect(itemTitle({ title: "   ", description: "Buy milk" })).toBe("Buy milk")
    expect(itemTitle({ title: "", description: "Buy milk" })).toBe("Buy milk")
  })

  it("trims, and returns empty for a nameless or missing record", () => {
    expect(itemTitle({ title: "  Buy milk  " })).toBe("Buy milk")
    expect(itemTitle({})).toBe("")
    expect(itemTitle(undefined)).toBe("")
    expect(itemTitle(null)).toBe("")
  })
})

describe("itemTitleOrUntitled", () => {
  it("labels a nameless record", () => {
    expect(itemTitleOrUntitled({})).toBe("Untitled")
    expect(itemTitleOrUntitled({ title: "   " })).toBe("Untitled")
  })

  it("accepts a caller-specific fallback", () => {
    expect(itemTitleOrUntitled({}, "operation")).toBe("operation")
  })

  it("passes a real name straight through", () => {
    expect(itemTitleOrUntitled({ description: "Buy milk" })).toBe("Buy milk")
  })
})

describe("syncTitleFromDescription", () => {
  it("fills in a title for a creator that only wrote a description", () => {
    expect(syncTitleFromDescription({ description: "Buy milk" })).toEqual({
      title: "Buy milk",
      description: "Buy milk",
    })
  })

  it("follows a rename made through the mirror", () => {
    // renameDocument writes description alone; readers prefer title.
    const previous = { title: "Draft", description: "Draft" }
    expect(syncTitleFromDescription({ ...previous, description: "Final" }, previous)).toEqual({
      title: "Final",
      description: "Final",
    })
  })

  it("keeps an existing title when there is no previous record to compare", () => {
    const next = { title: "Draft", description: "Final" }
    expect(syncTitleFromDescription(next)).toBe(next)
  })

  it("leaves a parked note's name alone when its body changes", () => {
    // Title and description were never in lockstep here, so description is
    // body text, not a name.
    const previous = { title: "Weekend", description: "Weekend\nMilk" }
    const next = { title: "Weekend", description: "Weekend\nMilk\nEggs" }
    expect(syncTitleFromDescription(next, previous)).toBe(next)
  })

  it("lets an explicit title win when both fields change", () => {
    const previous = { title: "Draft", description: "Draft" }
    const next = { title: "Final", description: "Something else" }
    expect(syncTitleFromDescription(next, previous)).toBe(next)
  })

  it("never writes description", () => {
    const next = { title: "Kept", description: "" }
    expect(syncTitleFromDescription(next)).toBe(next)
    expect(syncTitleFromDescription({ title: "", description: "" })).toEqual({
      title: "",
      description: "",
    })
  })
})

describe("beatTheClockMultiplier", () => {
  it("returns 1 when durations are missing", () => {
    expect(beatTheClockMultiplier(undefined, undefined)).toBe(1)
    expect(beatTheClockMultiplier(60, undefined)).toBe(1)
    expect(beatTheClockMultiplier(undefined, 30)).toBe(1)
  })

  it("returns 1 when the task met or exceeded its estimate", () => {
    expect(beatTheClockMultiplier(60, 60)).toBe(1)
    expect(beatTheClockMultiplier(60, 90)).toBe(1)
  })

  it("returns 1 for invalid (non-positive / negative) inputs", () => {
    expect(beatTheClockMultiplier(0, 0)).toBe(1)
    expect(beatTheClockMultiplier(-10, 5)).toBe(1)
    expect(beatTheClockMultiplier(60, -5)).toBe(1)
  })

  it("scales the bonus by the fraction of time saved, capped at 20%", () => {
    expect(beatTheClockMultiplier(60, 30)).toBeCloseTo(1.1) // half the time
    expect(beatTheClockMultiplier(60, 0)).toBeCloseTo(1 + MAX_BEAT_THE_CLOCK_BONUS) // instant
    expect(beatTheClockMultiplier(100, 90)).toBeCloseTo(1.02) // 10% under
  })
})

const folders: Folder[] = [
  { id: "f-na", name: "Next Actions", createdAt: new Date(), listIds: ["na"] },
]
const lists: List[] = [
  { id: "na", name: "Inbox", color: "#000", createdAt: new Date() },
]

const naTask = (overrides: Partial<Task>): Task => ({
  id: "t",
  description: "Task",
  stage: "clarified",
  createdAt: new Date(),
  completed: false,
  lists: ["na"],
  ...overrides,
})

describe("resolveCompletionPoints — beat-the-clock", () => {
  it("keeps the default 1 point when there are no durations", () => {
    expect(resolveCompletionPoints(naTask({}), lists, folders)).toBe(1)
  })

  it("keeps base points when the task ran over its estimate", () => {
    expect(resolveCompletionPoints(naTask({ estimatedDuration: 30, actualDuration: 45 }), lists, folders)).toBe(1)
  })

  it("awards a bonus when finishing under the standard time", () => {
    // base 1 × 1.10 = 1.1
    expect(
      resolveCompletionPoints(naTask({ estimatedDuration: 60, actualDuration: 30 }), lists, folders),
    ).toBeCloseTo(1.1)
  })

  it("uses rewardValue for non-next-action tasks when set", () => {
    const listTask = naTask({ lists: [], rewardValue: 7, estimatedDuration: 60, actualDuration: 10 })
    expect(resolveCompletionPoints(listTask, lists, folders)).toBe(7)
  })

  it("defaults non-next-action tasks to 1 point when rewardValue is unset", () => {
    const listTask = naTask({ lists: [] })
    expect(resolveCompletionPoints(listTask, lists, folders)).toBe(1)
  })
})

describe("withListMembership", () => {
  const bookType: ItemTypeDefinition = {
    id: "book",
    name: "Book",
    attributes: [{ id: "read", name: "Read", type: "boolean" }],
    defaultAttributeValues: { read: false },
  }
  const types = [bookType]
  const booksToBuy: List = {
    id: "tobuy",
    name: "Books to Buy",
    color: "#000",
    createdAt: new Date(),
    itemTypeId: "book",
    itemAttributes: [{ id: "purchased", name: "Purchased", type: "boolean" }],
    defaultAttributeValues: { purchased: false },
  }

  it("adopts the list's item type for an untyped item and seeds composed defaults", () => {
    const out = withListMembership(naTask({ lists: ["tobuy"] }), booksToBuy, types)
    expect(out.type).toBe("book")
    expect(out.attributes).toEqual({ read: false, purchased: false })
  })

  it("does not overwrite an existing attribute value or a non-task type", () => {
    const existing = naTask({ type: "book", attributes: { read: true } })
    const out = withListMembership(existing, booksToBuy, types)
    expect(out.type).toBe("book")
    expect(out.attributes?.read).toBe(true) // existing value preserved
    expect(out.attributes?.purchased).toBe(false) // new default added
  })

  it("returns the task untouched when the list is undefined", () => {
    const t = naTask({})
    expect(withListMembership(t, undefined, types)).toBe(t)
  })
})

describe("applyItemRules", () => {
  const bookType: ItemTypeDefinition = { id: "book", name: "Book" }
  const types = [bookType]
  const booksToBuy: List = {
    id: "tobuy",
    name: "Books to Buy",
    color: "#000",
    createdAt: new Date(),
    itemTypeId: "book",
    rules: [
      {
        id: "purchased->owned",
        name: "When purchased, owned",
        trigger: "update",
        when: { field: "purchased", operator: "eq", value: true },
        action: { kind: "setAttribute", field: "owned", value: true },
      },
    ],
  }

  it("runs a list rule for an item that belongs to that list", () => {
    const task = naTask({ type: "book", lists: ["tobuy"], attributes: { purchased: true } })
    const out = applyItemRules(task, [booksToBuy], types, "update")
    expect(out.attributes?.owned).toBe(true)
  })

  it("returns the task unchanged when no rules apply", () => {
    const task = naTask({ type: "book", lists: [], attributes: { purchased: true } })
    expect(applyItemRules(task, [booksToBuy], types, "update")).toBe(task)
  })
})

describe("resolveCompletionPoints — completion-tier formula points", () => {
  const tierCategories: List[] = [
    {
      id: "na",
      name: "Inbox",
      color: "#000",
      createdAt: new Date(),
      itemAttributes: buildCompletionTierAttributes("pages"),
    },
  ]

  const tierTask = (current: number): Task =>
    naTask({
      attributes: { ...defaultCompletionTierValues("pages"), [TIER_ATTR_IDS.current]: current },
    })

  it("awards the bare-minimum reward at 1 page", () => {
    expect(resolveCompletionPoints(tierTask(1), tierCategories, folders)).toBe(TIER_POINTS.bareMin)
  })

  it("awards the goal reward at 5 pages", () => {
    expect(resolveCompletionPoints(tierTask(5), tierCategories, folders)).toBe(TIER_POINTS.goal)
  })

  it("awards the exceptional reward plus per-page bonus beyond 20 pages", () => {
    expect(resolveCompletionPoints(tierTask(25), tierCategories, folders)).toBe(TIER_POINTS.exceptional + 5)
  })

  it("awards zero when nothing was done (below the bare minimum)", () => {
    expect(resolveCompletionPoints(tierTask(0), tierCategories, folders)).toBe(0)
  })
})

describe("isDayUnscheduledPlanned", () => {
  it("matches local calendar days, not UTC date keys", () => {
    const evening = new Date(2026, 8, 7, 22, 0, 0)
    const midnight = new Date(2026, 8, 7, 0, 0, 0)
    expect(
      isDayUnscheduledPlanned(
        {
          id: "todo-1",
          description: "Day to-do",
          stage: "clarified",
          createdAt: midnight,
          completed: false,
          lists: [],
          scheduledDate: midnight,
        },
        evening,
      ),
    ).toBe(true)
  })
})

describe("isTaskItem / createListItem / countsInDone", () => {
  it("does not treat a generic list item as a task", () => {
    const item = createListItem("big area rug", ["wishlist"])
    expect(item.type).toBe("item")
    expect(isTaskItem(item, folders)).toBe(false)
  })

  it("creates next-action items as tasks", () => {
    const task = createNextActionItem("Write intro", ["na"])
    expect(task.type).toBe("task")
    expect(isTaskItem(task, folders)).toBe(true)
  })

  it("counts logged actions in Done even when they are not tasks", () => {
    const logged: Task = {
      ...createListItem("read 12 pages of Dune"),
      type: "action",
      loggedAction: true,
      completed: true,
      completedDate: new Date(),
    }
    expect(countsInDone(logged, folders)).toBe(true)
    expect(countsInDone({ ...createListItem("rug"), completed: true }, folders)).toBe(false)
  })

  it("missing type is a task only when the row lives in Next Actions", () => {
    expect(isTaskItem({ ...createListItem("rug"), type: undefined }, folders)).toBe(false)
    expect(isTaskItem({ ...createListItem("Write intro", ["na"]), type: undefined }, folders)).toBe(true)
    expect(countsInDone({ ...createListItem("rug"), type: undefined, completed: true }, folders)).toBe(false)
  })
})

