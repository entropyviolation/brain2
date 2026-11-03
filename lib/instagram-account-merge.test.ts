import { beforeEach, describe, expect, it } from "vitest"
import { INSTAGRAM_ACCOUNT_TYPE_ID, igAccountId, instagramProfileKeyHandle } from "@/lib/instagram-account-type"
import { IG_FOLLOWER_COUNT, IG_USERNAME } from "@/lib/instagram-export"
import {
  INSTAGRAM_FOLLOWERS_LIST_ID,
  INSTAGRAM_FOLLOWING_LIST_ID,
  ensureInstagramFollowersList,
  ensureInstagramFollowingList,
  mergeDuplicateInstagramAccounts,
} from "@/lib/instagram-lists"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

function account(id: string, username: string, createdAt: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: username,
    completed: false,
    createdAt,
    lists: [INSTAGRAM_FOLLOWERS_LIST_ID],
    attributes: { [IG_USERNAME]: username },
    ...extra,
  } as Task
}

describe("mergeDuplicateInstagramAccounts", () => {
  beforeEach(() => {
    resetAllStores()
    ensureInstagramFollowingList()
    ensureInstagramFollowersList()
  })

  it("folds same-username copies into the oldest and types it", () => {
    const store = useTaskStore.getState()
    store.setTasks([
      account("ig-b", "_.alyssav._", "2026-10-30T00:00:00Z", {
        lists: [INSTAGRAM_FOLLOWING_LIST_ID],
        tags: ["b"],
        attributes: { [IG_USERNAME]: "_.alyssav._", [IG_FOLLOWER_COUNT]: 900 },
      }),
      account("ig-a", "_.alyssav._", "2026-10-23T00:00:00Z", { tags: ["a"] }),
      account("ig-c", "_.alyssav._", "2026-11-01T00:00:00Z"),
      account("ig-other", "someone", "2026-10-23T00:00:00Z"),
      { id: "note", title: "note", completed: false, createdAt: "2026-10-01T00:00:00Z", links: [{ targetId: "ig-c" }] } as Task,
    ])

    expect(mergeDuplicateInstagramAccounts()).toEqual({ merged: 2, typed: 2 })

    const tasks = useTaskStore.getState().tasks
    const left = tasks.filter((t) => t.attributes?.[IG_USERNAME] === "_.alyssav._")
    expect(left.map((t) => t.id)).toEqual(["ig-a"])
    expect(left[0]!.type).toBe(INSTAGRAM_ACCOUNT_TYPE_ID)
    expect(new Set(left[0]!.lists)).toEqual(new Set([INSTAGRAM_FOLLOWERS_LIST_ID, INSTAGRAM_FOLLOWING_LIST_ID]))
    expect(new Set(left[0]!.tags)).toEqual(new Set(["a", "b"]))
    expect(left[0]!.attributes?.[IG_FOLLOWER_COUNT]).toBe(900)
    expect(tasks.find((t) => t.id === "note")?.links?.[0]?.targetId).toBe("ig-a")
    expect(useTaskStore.getState().removedTaskIds).toEqual(expect.arrayContaining(["ig-b", "ig-c"]))
  })

  it("is a no-op the second time and leaves unrelated items alone", () => {
    useTaskStore.getState().setTasks([
      account("ig-a", "x", "2026-10-23T00:00:00Z"),
      account("ig-b", "x", "2026-10-24T00:00:00Z"),
      { id: "p", title: "Plain", completed: false, createdAt: "2026-10-01T00:00:00Z", attributes: { [IG_USERNAME]: "x" } } as Task,
    ])
    mergeDuplicateInstagramAccounts()
    expect(mergeDuplicateInstagramAccounts()).toEqual({ merged: 0, typed: 0 })
    expect(useTaskStore.getState().tasks.map((t) => t.id).sort()).toEqual(["ig-a", "p"])
  })

  it("keeps a type the person chose", () => {
    useTaskStore.getState().setTasks([account("ig-a", "x", "2026-10-23T00:00:00Z", { type: "person" })])
    expect(mergeDuplicateInstagramAccounts().typed).toBe(0)
    expect(useTaskStore.getState().tasks[0]!.type).toBe("person")
  })
})

describe("Instagram Account type helpers", () => {
  it("makes the same id for the same handle", () => {
    expect(igAccountId(" Foo.Bar ")).toBe(igAccountId("foo.bar"))
  })

  it("shows the profile key only for the type or a list of the type", () => {
    const attrs = { [IG_USERNAME]: "foo" }
    expect(instagramProfileKeyHandle({ type: INSTAGRAM_ACCOUNT_TYPE_ID, attributes: attrs })).toBe("foo")
    expect(instagramProfileKeyHandle({ type: "item", attributes: attrs }, { itemTypeId: INSTAGRAM_ACCOUNT_TYPE_ID })).toBe("foo")
    expect(instagramProfileKeyHandle({ type: "item", attributes: attrs }, { itemTypeId: "item" })).toBe("")
  })
})
