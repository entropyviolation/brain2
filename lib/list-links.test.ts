/**
 * Connected-list membership: A→B auto-join, exclusions, unlink, cycles.
 */
import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import {
  addListLinkToLists,
  allListLinks,
  applyListLinksToTask,
  applyListLinksToTasks,
  canLinkLists,
  expandListMembership,
  hasListLink,
  isLinkableListId,
  linksForList,
  preserveLinkedTargetIds,
  removeListLinkFromLists,
  stripListLinksForDeletedList,
} from "./list-links"

const list = (id: string, linkedTargetListIds?: string[]): List => ({
  id,
  name: id,
  color: "#111",
  createdAt: new Date("2026-01-01"),
  ...(linkedTargetListIds ? { linkedTargetListIds } : {}),
})

const task = (partial: Partial<Task> & Pick<Task, "id">): Task => ({
  description: partial.id,
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: [],
  ...partial,
})

describe("isLinkableListId", () => {
  it("rejects folder All Items and Next Actions smart lists", () => {
    expect(isLinkableListId("reading")).toBe(true)
    expect(isLinkableListId("__all-items__folder1")).toBe(false)
    expect(isLinkableListId("__all-items__root")).toBe(false)
    expect(isLinkableListId("na-smart-daily")).toBe(false)
    expect(canLinkLists("a", "a")).toBe(false)
    expect(canLinkLists("a", "b")).toBe(true)
  })
})

describe("addListLinkToLists / removeListLinkFromLists", () => {
  it("stores A→B on A only, idempotently", () => {
    const lists = [list("a"), list("b")]
    const once = addListLinkToLists(lists, "a", "b")
    expect(once.find((l) => l.id === "a")?.linkedTargetListIds).toEqual(["b"])
    expect(once.find((l) => l.id === "b")?.linkedTargetListIds).toBeUndefined()
    expect(addListLinkToLists(once, "a", "b")).toBe(once)
    expect(hasListLink(once, "a", "b")).toBe(true)
  })

  it("rejects self-links and missing lists", () => {
    const lists = [list("a"), list("b")]
    expect(addListLinkToLists(lists, "a", "a")).toBe(lists)
    expect(addListLinkToLists(lists, "a", "missing")).toBe(lists)
  })

  it("allows multiple outbound links and both directions", () => {
    let lists = [list("a"), list("b"), list("c")]
    lists = addListLinkToLists(lists, "a", "b")
    lists = addListLinkToLists(lists, "a", "c")
    lists = addListLinkToLists(lists, "b", "a")
    expect(allListLinks(lists)).toEqual([
      { sourceListId: "a", targetListId: "b" },
      { sourceListId: "a", targetListId: "c" },
      { sourceListId: "b", targetListId: "a" },
    ])
  })

  it("remove drops the pair without touching other links", () => {
    let lists = addListLinkToLists([list("a"), list("b"), list("c")], "a", "b")
    lists = addListLinkToLists(lists, "a", "c")
    lists = removeListLinkFromLists(lists, "a", "b")
    expect(lists.find((l) => l.id === "a")?.linkedTargetListIds).toEqual(["c"])
    const gone = removeListLinkFromLists(lists, "a", "c")
    expect(gone.find((l) => l.id === "a")?.linkedTargetListIds).toBeUndefined()
  })
})

describe("linksForList (symmetric settings view)", () => {
  it("shows push on A and receive on B for the same A→B link", () => {
    const lists = addListLinkToLists([list("a"), list("b")], "a", "b")
    expect(linksForList(lists, "a")).toEqual([{ sourceListId: "a", targetListId: "b", role: "push" }])
    expect(linksForList(lists, "b")).toEqual([{ sourceListId: "a", targetListId: "b", role: "receive" }])
  })
})

describe("expandListMembership", () => {
  it("adds source items onto the target, honoring exclusions", () => {
    const lists = addListLinkToLists([list("a"), list("b")], "a", "b")
    expect(expandListMembership(["a"], lists)).toEqual(["a", "b"])
    expect(expandListMembership(["a"], lists, ["b"])).toEqual(["a"])
    expect(expandListMembership(["b"], lists)).toEqual(["b"])
  })

  it("unions A↔B without looping, still skipping exclusions", () => {
    let lists = addListLinkToLists([list("a"), list("b")], "a", "b")
    lists = addListLinkToLists(lists, "b", "a")
    expect(expandListMembership(["a"], lists)).toEqual(["a", "b"])
    expect(expandListMembership(["b"], lists)).toEqual(["b", "a"])
    expect(expandListMembership(["a"], lists, ["b"])).toEqual(["a"])
  })

  it("follows A→B→C transitively", () => {
    let lists = addListLinkToLists([list("a"), list("b"), list("c")], "a", "b")
    lists = addListLinkToLists(lists, "b", "c")
    expect(expandListMembership(["a"], lists)).toEqual(["a", "b", "c"])
  })
})

describe("applyListLinksToTask", () => {
  const linked = () => addListLinkToLists([list("a"), list("b")], "a", "b")

  it("joins a new source item onto the target", () => {
    const item = applyListLinksToTask(task({ id: "t1", lists: ["a"] }), undefined, linked())
    expect(item.lists).toEqual(["a", "b"])
    expect(item.listMembershipExclusions).toBeUndefined()
  })

  it("records an exclusion when the user drops the target, and does not re-add", () => {
    const lists = linked()
    const onBoth = task({ id: "t1", lists: ["a", "b"] })
    const removed = applyListLinksToTask(task({ id: "t1", lists: ["a"] }), onBoth, lists)
    expect(removed.lists).toEqual(["a"])
    expect(removed.listMembershipExclusions).toEqual(["b"])
    const resync = applyListLinksToTask(removed, removed, lists)
    expect(resync.lists).toEqual(["a"])
    expect(resync.listMembershipExclusions).toEqual(["b"])
  })

  it("clears the exclusion when the user explicitly adds the item back", () => {
    const lists = linked()
    const excluded = task({ id: "t1", lists: ["a"], listMembershipExclusions: ["b"] })
    const added = applyListLinksToTask(task({ id: "t1", lists: ["a", "b"] }), excluded, lists)
    expect(added.lists).toEqual(["a", "b"])
    expect(added.listMembershipExclusions).toBeUndefined()
  })

  it("does not mass-change membership when expanding with previous === task (link create)", () => {
    const lists = linked()
    const onA = task({ id: "t1", lists: ["a"] })
    const joined = applyListLinksToTask(onA, onA, lists)
    expect(joined.lists).toEqual(["a", "b"])
    expect(joined.listMembershipExclusions).toBeUndefined()
  })
})

describe("applyListLinksToTasks / unlink", () => {
  it("syncs existing source items onto the target", () => {
    const lists = addListLinkToLists([list("a"), list("b")], "a", "b")
    const tasks = [task({ id: "t1", lists: ["a"] }), task({ id: "t2", lists: ["b"] })]
    const next = applyListLinksToTasks(tasks, lists)
    expect(next[0].lists).toEqual(["a", "b"])
    expect(next[1].lists).toEqual(["b"])
  })

  it("unlink leaves already-joined items on both lists", () => {
    let lists = addListLinkToLists([list("a"), list("b")], "a", "b")
    const joined = applyListLinksToTasks([task({ id: "t1", lists: ["a"] })], lists)
    expect(joined[0].lists).toEqual(["a", "b"])
    lists = removeListLinkFromLists(lists, "a", "b")
    const afterUnlink = applyListLinksToTasks(joined, lists)
    expect(afterUnlink[0].lists).toEqual(["a", "b"])
  })
})

describe("stripListLinksForDeletedList / preserveLinkedTargetIds", () => {
  it("drops the deleted id from other lists' outbound links", () => {
    let lists = addListLinkToLists([list("a"), list("b"), list("c")], "a", "b")
    lists = addListLinkToLists(lists, "c", "b")
    const next = stripListLinksForDeletedList(
      lists.filter((l) => l.id !== "b"),
      "b",
    )
    expect(next.find((l) => l.id === "a")?.linkedTargetListIds).toBeUndefined()
    expect(next.find((l) => l.id === "c")?.linkedTargetListIds).toBeUndefined()
  })

  it("keeps live outbound links when a settings save omits or stale-copies them", () => {
    const previous = list("a", ["b"])
    const incoming = list("a")
    incoming.name = "Alpha"
    expect(preserveLinkedTargetIds(incoming, previous).linkedTargetListIds).toEqual(["b"])
    expect(preserveLinkedTargetIds({ ...previous, name: "Alpha", linkedTargetListIds: ["stale"] }, previous).linkedTargetListIds).toEqual(
      ["b"],
    )
  })
})
