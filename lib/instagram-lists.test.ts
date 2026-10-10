import { beforeEach, describe, expect, it } from "vitest"
import {
  IG_FOLLOWER_COUNT,
  IG_FOLLOWS_ME_BACK,
  IG_I_FOLLOW_BACK,
  IG_USERNAME,
  parseInstagramExport,
} from "@/lib/instagram-export"
import {
  applyInstagramImport,
  describeInstagramImportResult,
  ensureInstagramFollowersList,
  ensureInstagramFollowingList,
  findInstagramFollowersList,
  findInstagramFollowingList,
  importInstagramExportTexts,
  INSTAGRAM_FOLLOWERS_LIST_ID,
  INSTAGRAM_FOLLOWING_LIST_ID,
} from "@/lib/instagram-lists"
import { pinSystemListsToHome } from "@/lib/home-system-lists"
import { planDuplicateList } from "@/lib/lists-duplicate"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

function row(username: string, title = "") {
  return {
    title,
    string_list_data: [
      { href: `https://www.instagram.com/${username}`, value: username, timestamp: 10 },
    ],
  }
}

describe("Instagram lists", () => {
  beforeEach(() => {
    resetAllStores()
    useListsUiStore.setState({ homePinned: [] })
  })

  it("creates both lists, refuses delete, and pins them", () => {
    expect(ensureInstagramFollowingList()).toBe(INSTAGRAM_FOLLOWING_LIST_ID)
    expect(ensureInstagramFollowersList()).toBe(INSTAGRAM_FOLLOWERS_LIST_ID)
    const following = findInstagramFollowingList(useTaskStore.getState().lists)
    const followers = findInstagramFollowersList(useTaskStore.getState().lists)
    expect(following?.name).toBe("People I follow on Instagram")
    expect(followers?.name).toBe("People who follow me on Instagram")
    expect(following?.instagramFollowingList).toBe(true)
    expect(followers?.instagramFollowersList).toBe(true)
    expect(following?.scheduleable).toBe(false)
    expect(followers?.scheduleable).toBe(false)
    expect(following?.displayedAttributes).toEqual(["ig-username", "ig-follower-count", "ig-follows-me-back"])
    expect(followers?.sheetConfig?.columnIds).toEqual(["ig-username", "ig-follower-count", "ig-i-follow-back"])

    useTaskStore.getState().deleteList(INSTAGRAM_FOLLOWING_LIST_ID)
    useTaskStore.getState().deleteList(INSTAGRAM_FOLLOWERS_LIST_ID)
    expect(findInstagramFollowingList(useTaskStore.getState().lists)?.id).toBe(INSTAGRAM_FOLLOWING_LIST_ID)
    expect(findInstagramFollowersList(useTaskStore.getState().lists)?.id).toBe(INSTAGRAM_FOLLOWERS_LIST_ID)

    useTaskStore.getState().updateList({ ...following!, name: "Accounts I follow" })
    expect(ensureInstagramFollowingList()).toBe(INSTAGRAM_FOLLOWING_LIST_ID)
    expect(useTaskStore.getState().lists.filter((list) => list.instagramFollowingList)).toHaveLength(1)

    pinSystemListsToHome()
    const pinned = useListsUiStore.getState().homePinned
    expect(pinned).toContain(INSTAGRAM_FOLLOWING_LIST_ID)
    expect(pinned).toContain(INSTAGRAM_FOLLOWERS_LIST_ID)
  })

  it("adopts lists already using those names", () => {
    useTaskStore.getState().addList({
      id: "my-following",
      name: "People I follow on Instagram",
      color: "#111111",
      createdAt: new Date(),
    })
    useTaskStore.getState().addList({
      id: "my-followers",
      name: "People who follow me on Instagram",
      color: "#222222",
      createdAt: new Date(),
    })
    expect(ensureInstagramFollowingList()).toBe("my-following")
    expect(ensureInstagramFollowersList()).toBe("my-followers")
    expect(useTaskStore.getState().lists.some((list) => list.id === INSTAGRAM_FOLLOWING_LIST_ID)).toBe(false)
    expect(useTaskStore.getState().lists.find((list) => list.id === "my-following")?.instagramFollowingList).toBe(true)
    expect(useTaskStore.getState().lists.find((list) => list.id === "my-followers")?.instagramFollowersList).toBe(true)
    useTaskStore.getState().deleteList("my-following")
    useTaskStore.getState().deleteList("my-followers")
    expect(findInstagramFollowingList(useTaskStore.getState().lists)?.id).toBe("my-following")
    expect(findInstagramFollowersList(useTaskStore.getState().lists)?.id).toBe("my-followers")
  })

  it("puts one username on both lists and keeps a typed follower count", () => {
    const parsed = parseInstagramExport([
      {
        name: "following.json",
        text: JSON.stringify({ relationships_following: [row("ada", ""), row("bob")] }),
      },
      {
        name: "followers_1.json",
        text: JSON.stringify({ relationships_followers: [row("ada"), row("cam")] }),
      },
    ])
    applyInstagramImport(parsed)
    const tasks = useTaskStore.getState().tasks
    const ada = tasks.find((task) => task.attributes?.[IG_USERNAME] === "ada")
    const bob = tasks.find((task) => task.attributes?.[IG_USERNAME] === "bob")
    const cam = tasks.find((task) => task.attributes?.[IG_USERNAME] === "cam")
    expect(tasks.filter((task) => task.attributes?.[IG_USERNAME] === "ada")).toHaveLength(1)
    expect(ada?.lists?.slice().sort()).toEqual([INSTAGRAM_FOLLOWERS_LIST_ID, INSTAGRAM_FOLLOWING_LIST_ID].sort())
    expect(ada?.title).toBe("ada")
    expect(ada?.attributes?.[IG_FOLLOWS_ME_BACK]).toBe(true)
    expect(ada?.attributes?.[IG_I_FOLLOW_BACK]).toBe(true)
    expect(bob?.lists).toEqual([INSTAGRAM_FOLLOWING_LIST_ID])
    expect(bob?.attributes?.[IG_FOLLOWS_ME_BACK]).toBe(false)
    expect(bob?.attributes?.[IG_I_FOLLOW_BACK]).toBeUndefined()
    expect(cam?.lists).toEqual([INSTAGRAM_FOLLOWERS_LIST_ID])
    expect(cam?.attributes?.[IG_I_FOLLOW_BACK]).toBe(false)
    expect(cam?.attributes?.[IG_FOLLOWS_ME_BACK]).toBeUndefined()

    const withCount = useTaskStore.getState().tasks.find((task) => task.id === ada?.id)
    if (!withCount) throw new Error("missing ada")
    useTaskStore.getState().updateTask({
      ...withCount,
      attributes: { ...withCount.attributes, [IG_FOLLOWER_COUNT]: 1200 },
    })
    applyInstagramImport(
      parseInstagramExport([
        { name: "following.json", text: JSON.stringify({ relationships_following: [row("ada", "Ada Lovelace")] }) },
      ]),
    )
    const again = useTaskStore.getState().tasks.find((task) => task.id === ada?.id)
    expect(again?.attributes?.[IG_FOLLOWER_COUNT]).toBe(1200)
    expect(again?.title).toBe("Ada Lovelace")
    expect(again?.attributes?.[IG_FOLLOWS_ME_BACK]).toBe(true)
    expect(useTaskStore.getState().tasks.find((task) => task.id === bob?.id)).toBeTruthy()
  })

  it("does not copy either Instagram flag onto a duplicate", () => {
    const id = ensureInstagramFollowingList()
    const source = useTaskStore.getState().lists.find((list) => list.id === id)
    if (!source) throw new Error("missing list")
    const plan = planDuplicateList(source, { scope: "settings", lists: [source], folders: [], tasks: [] })
    expect(plan.list.instagramFollowingList).toBeUndefined()
    expect(plan.list.instagramFollowersList).toBeUndefined()
    expect(plan.list.id).not.toBe(id)
  })

  it("reports extracted rows and leaves the missing side blank", () => {
    expect(
      describeInstagramImportResult({
        followingRows: 2,
        followerRows: 0,
        includedFollowing: true,
        includedFollowers: false,
        added: 2,
        updated: 0,
      }),
    ).toBe(
      "Extracted 2 following rows and 0 follower rows. Added 2. Updated 0. Follows me back stays blank until a followers file is included.",
    )
    expect(
      describeInstagramImportResult({
        followingRows: 1,
        followerRows: 1,
        includedFollowing: true,
        includedFollowers: true,
        added: 0,
        updated: 1,
        skippedZip: true,
      }),
    ).toBe(
      "Extracted 1 following row and 1 follower row. Added 0. Updated 1. The zip was skipped. The JSON and HTML were read.",
    )
  })

  it("imports chosen files onto both lists", () => {
    const report = importInstagramExportTexts([
      {
        name: "connections/followers_and_following/following.json",
        text: JSON.stringify({ relationships_following: [row("ada")] }),
      },
      {
        name: "followers_1.json",
        text: JSON.stringify({ relationships_followers: [row("ada"), row("cam")] }),
      },
    ])
    expect(report.ok).toBe(true)
    expect(report.followingRows).toBe(1)
    expect(report.followerRows).toBe(2)
    expect(report.added).toBe(2)
    expect(report.updated).toBe(0)
    expect(report.message).toContain("Extracted 1 following row and 2 follower rows.")
    expect(findInstagramFollowingList(useTaskStore.getState().lists)?.id).toBe(INSTAGRAM_FOLLOWING_LIST_ID)
    expect(findInstagramFollowersList(useTaskStore.getState().lists)?.id).toBe(INSTAGRAM_FOLLOWERS_LIST_ID)
    const again = importInstagramExportTexts([
      {
        name: "following.json",
        text: JSON.stringify({ relationships_following: [row("ada", "Ada")] }),
      },
    ])
    expect(again.added).toBe(0)
    // Ada’s display name, plus cam’s “I follow them back” now that following is present.
    expect(again.updated).toBe(2)
    expect(again.message).toContain("Follows me back stays blank until a followers file is included.")
    const ada = useTaskStore.getState().tasks.find((task) => task.attributes?.[IG_USERNAME] === "ada")
    expect(ada?.attributes?.[IG_FOLLOWS_ME_BACK]).toBe(true)
    expect(useTaskStore.getState().tasks.filter((task) => task.attributes?.[IG_USERNAME] === "ada")).toHaveLength(1)
    expect(useTaskStore.getState().tasks.find((task) => task.attributes?.[IG_USERNAME] === "cam")).toBeTruthy()
  })

  it("refuses a zip and does not create the lists", () => {
    const report = importInstagramExportTexts([{ name: "instagram-export.zip", text: "PK" }])
    expect(report.ok).toBe(false)
    expect(report.message).toMatch(/does not read the zip/)
    expect(findInstagramFollowingList(useTaskStore.getState().lists)).toBeUndefined()
  })
})
