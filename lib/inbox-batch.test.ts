import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import {
  applyDeadlineToInboxItems,
  applyListsToInboxItems,
  deleteInboxItems,
  firstWalkId,
  clarifyInboxItems,
  inboxAllSelected,
  inboxBatchTargets,
  inInboxPartition,
  isInboxEditableTarget,
  nextWalkId,
  openInboxIds,
  openRevisitInboxIds,
  renameInboxIdea,
  setInboxMonkeyBrain,
  rotateInboxQueue,
  sortInboxNewestFirst,
  toggleSelectedId,
  walkQueueIds,
  isBareInboxCapture,
  isDatedInboxCapture,
  pickRandomInboxIds,
  rangeSelectIds,
  inboxTitleLines,
} from "./inbox-batch"

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  description: id,
  stage: "inbox",
  completed: false,
  createdAt: new Date(),
  lists: [],
  ...extra,
})

describe("sortInboxNewestFirst", () => {
  it("puts the newest capture first and sinks a missing date", () => {
    const older = task("old", { createdAt: new Date("2026-01-01T00:00:00Z") })
    const newer = task("new", { createdAt: new Date("2026-09-23T12:00:00Z") })
    const undated = task("none", { createdAt: new Date(Number.NaN) })
    expect(sortInboxNewestFirst([older, undated, newer]).map((item) => item.id)).toEqual(["new", "old", "none"])
  })

  it("breaks equal timestamps by later position", () => {
    const when = new Date("2026-09-23T12:00:00Z")
    const first = task("a", { createdAt: when })
    const second = task("b", { createdAt: when })
    expect(sortInboxNewestFirst([first, second]).map((item) => item.id)).toEqual(["b", "a"])
  })
})

describe("rotateInboxQueue", () => {
  it("rotates so the focused item is first", () => {
    expect(rotateInboxQueue(["a", "b", "c"], "b")).toEqual(["b", "c", "a"])
  })

  it("leaves the queue when start is missing or already first", () => {
    expect(rotateInboxQueue(["a", "b"], "a")).toEqual(["a", "b"])
    expect(rotateInboxQueue(["a", "b"], "z")).toEqual(["a", "b"])
  })
})

describe("nextWalkId", () => {
  it("opens the first remaining id when nothing is current", () => {
    expect(nextWalkId(["a", "b", "c"], new Set(["a", "b", "c"]), null)).toBe("a")
  })

  it("advances to the next still-open id and wraps to skipped ones", () => {
    expect(nextWalkId(["a", "b", "c"], new Set(["b", "c"]), "a")).toBe("b")
    expect(nextWalkId(["a", "b", "c"], new Set(["a", "c"]), "c")).toBe("a")
  })

  it("stops when the only remaining open id is the one just left", () => {
    expect(nextWalkId(["a", "b"], new Set(["b"]), "b")).toBe(null)
  })
})

describe("firstWalkId / openInboxIds", () => {
  it("skips completed and non-inbox tasks", () => {
    const tasks = [task("a"), task("b", { stage: "clarified" }), task("c", { completed: true }), task("d")]
    const open = openInboxIds(tasks)
    expect([...open]).toEqual(["a", "d"])
    expect(firstWalkId(["b", "c", "d", "a"], open)).toBe("d")
  })
})

describe("isInboxEditableTarget", () => {
  it("lets chords through on checkboxes and buttons, not text fields", () => {
    const box = document.createElement("input")
    box.type = "checkbox"
    const text = document.createElement("input")
    text.type = "text"
    const area = document.createElement("textarea")
    expect(isInboxEditableTarget(box)).toBe(false)
    expect(isInboxEditableTarget(text)).toBe(true)
    expect(isInboxEditableTarget(area)).toBe(true)
  })
})

describe("renameInboxIdea", () => {
  it("renames the title and a lockstep description", () => {
    expect(renameInboxIdea(task("a", { title: "old", description: "old" }), "new")).toEqual({
      title: "new",
      description: "new",
    })
  })

  it("leaves a distinct description body alone", () => {
    expect(renameInboxIdea(task("a", { title: "Name", description: "Long body" }), "Renamed")).toEqual({
      title: "Renamed",
      description: "Long body",
    })
  })
})

describe("walkQueueIds", () => {
  it("walks only the current selection, rotating from focus when it is selected", () => {
    expect(walkQueueIds(["a", "b", "c"], [], "a")).toEqual([])
    expect(walkQueueIds(["a", "b", "c"], ["c", "a"], "a")).toEqual(["a", "c"])
    expect(walkQueueIds(["a", "b", "c"], ["a", "b", "c"], "b")).toEqual(["b", "c", "a"])
  })
})

describe("toggleSelectedId / inboxBatchTargets", () => {
  it("toggles membership and falls back to the focused row", () => {
    expect(toggleSelectedId(["a"], "b")).toEqual(["a", "b"])
    expect(toggleSelectedId(["a", "b"], "a")).toEqual(["b"])
    expect(inboxBatchTargets(["x", "y"], "z")).toEqual(["x", "y"])
    expect(inboxBatchTargets([], "z")).toEqual(["z"])
    expect(inboxBatchTargets([], null)).toEqual([])
  })
})

describe("inboxAllSelected / deleteInboxItems", () => {
  it("is true only when every open id is selected", () => {
    expect(inboxAllSelected(["a", "b"], ["a", "b"])).toBe(true)
    expect(inboxAllSelected(["a", "b"], ["a"])).toBe(false)
    expect(inboxAllSelected([], [])).toBe(false)
  })

  it("drops only the selected ids", () => {
    const tasks = [task("a"), task("b"), task("c")]
    expect(deleteInboxItems(tasks, ["b", "c"]).map((t) => t.id)).toEqual(["a"])
    expect(deleteInboxItems(tasks, [])).toEqual(tasks)
  })
})

describe("applyListsToInboxItems / applyDeadlineToInboxItems", () => {
  it("unions lists onto the selected ids only", () => {
    const tasks = [task("a", { lists: ["home"] }), task("b")]
    const next = applyListsToInboxItems(tasks, ["a"], ["work", "home"])
    expect(next[0].lists).toEqual(["home", "work"])
    expect(next[1].lists).toEqual([])
  })

  it("sets a deadline on the selected ids", () => {
    const day = new Date(2026, 8, 21)
    const tasks = [task("a"), task("b")]
    const next = applyDeadlineToInboxItems(tasks, ["b"], day)
    expect(next[0].deadline).toBeUndefined()
    expect(next[1].deadline).toBe(day)
  })
})

describe("clarifyInboxItems / monkey brain partition", () => {
  it("files listed items as clarified and unlisteds onto the list stage", () => {
    const tasks = [task("a", { lists: ["work"] }), task("b"), task("c", { stage: "clarified" })]
    const next = clarifyInboxItems(tasks, ["a", "b", "c"])
    expect(next[0].stage).toBe("clarified")
    expect(next[0].lists).toEqual(["work"])
    expect(next[1].stage).toBe("list")
    expect(next[2].stage).toBe("clarified")
  })

  it("moves between inbox and monkey brain", () => {
    const tasks = [task("a"), task("b", { monkeyBrain: true })]
    const dumped = setInboxMonkeyBrain(tasks, ["a"], true)
    expect(inInboxPartition(dumped[0], "monkey")).toBe(true)
    expect(openRevisitInboxIds(dumped)).toEqual(new Set())
    const back = setInboxMonkeyBrain(dumped, ["a"], false)
    expect(inInboxPartition(back[0], "inbox")).toBe(true)
    expect(back[0].monkeyBrain).toBeUndefined()
  })
})

describe("bare captures, random select, title lines", () => {
  it("treats a default inbox capture as bare and a listed or dated one as not", () => {
    expect(isBareInboxCapture(task("a", { urgency: 3, importance: 3, estimatedDuration: 1 }))).toBe(true)
    expect(isBareInboxCapture(task("b", { lists: ["work"] }))).toBe(false)
    expect(isBareInboxCapture(task("c", { tags: ["later"] }))).toBe(false)
    expect(isBareInboxCapture(task("d", { attributes: { note: "x" } }))).toBe(false)
    expect(isDatedInboxCapture(task("e", { deadline: new Date() }))).toBe(true)
    expect(isBareInboxCapture(task("e", { deadline: new Date() }))).toBe(false)
  })

  it("picks a random count, or the whole pile when the number is larger", () => {
    const ids = ["a", "b", "c", "d"]
    expect(pickRandomInboxIds(ids, 2, () => 0)).toHaveLength(2)
    expect(pickRandomInboxIds(ids, 9)).toEqual(ids)
    expect(pickRandomInboxIds(ids, 0)).toEqual([])
  })

  it("selects the inclusive range and lifts a trailing parenthetical", () => {
    expect(rangeSelectIds(["a", "b", "c", "d"], "b", "d")).toEqual(["b", "c", "d"])
    expect(inboxTitleLines("Plan something else (Give yourself intense assignments)")).toEqual({
      line: "Plan something else",
      aside: "Give yourself intense assignments",
    })
  })
})
