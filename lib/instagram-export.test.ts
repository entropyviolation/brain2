import { describe, expect, it } from "vitest"
import {
  IG_FOLLOWER_COUNT,
  IG_FOLLOWS_ME_BACK,
  IG_I_FOLLOW_BACK,
  parseInstagramExport,
  planInstagramImport,
  type IgExisting,
} from "@/lib/instagram-export"

const FOLLOWING_ID = "people-i-follow-on-instagram"
const FOLLOWERS_ID = "people-who-follow-me-on-instagram"

function row(username: string, title = "", extra: Record<string, unknown> = {}) {
  return {
    title,
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/_u/${username}`,
        value: username,
        timestamp: 1700000000,
      },
    ],
    ...extra,
  }
}

function followingFile(rows: ReturnType<typeof row>[], name = "following.json") {
  return { name, text: JSON.stringify({ relationships_following: rows }) }
}

function followersFile(rows: ReturnType<typeof row>[], name = "followers_1.json") {
  return { name, text: JSON.stringify({ relationships_followers: rows }) }
}

function changeFor(username: string, changes: ReturnType<typeof planInstagramImport>) {
  return changes.find((change) => change.username.toLowerCase() === username.toLowerCase())
}

describe("Instagram export parser", () => {
  it("leaves Follows me back unset when only following is imported", () => {
    const parsed = parseInstagramExport([
      followingFile([row("ada", ""), row("grace", "Grace Hopper")]),
    ])
    expect(parsed.includedFollowing).toBe(true)
    expect(parsed.includedFollowers).toBe(false)
    expect(parsed.following.get("ada")?.name).toBeUndefined()
    expect(parsed.following.get("grace")?.name).toBe("Grace Hopper")

    const changes = planInstagramImport([], parsed, {
      followingListId: FOLLOWING_ID,
      followersListId: FOLLOWERS_ID,
    })
    const ada = changeFor("ada", changes)
    expect(ada?.create).toBe(true)
    expect(ada?.name).toBe("ada")
    expect(ada?.lists).toEqual([FOLLOWING_ID])
    expect(ada?.writeFollowsMeBack).toBe(false)
    expect(ada?.followsMeBack).toBeUndefined()
    expect(ada?.writeIFollowBack).toBe(false)
    expect(changeFor("grace", changes)?.name).toBe("Grace Hopper")
  })

  it("sets Follows me back and I follow them back from the intersection", () => {
    const parsed = parseInstagramExport([
      followingFile([row("ada", "Ada Lovelace"), row("bob")]),
      followersFile([row("ada", ""), row("cam", "")], "followers_1.json"),
      { name: "followers_2.json", text: JSON.stringify([row("dee")]) },
    ])
    expect(parsed.includedFollowers).toBe(true)
    expect(parsed.followers.has("dee")).toBe(true)

    const changes = planInstagramImport([], parsed, {
      followingListId: FOLLOWING_ID,
      followersListId: FOLLOWERS_ID,
    })
    const ada = changeFor("ada", changes)
    expect(changes.filter((change) => change.username === "ada")).toHaveLength(1)
    expect(ada?.lists).toEqual([FOLLOWING_ID, FOLLOWERS_ID])
    expect(ada?.writeFollowsMeBack).toBe(true)
    expect(ada?.followsMeBack).toBe(true)
    expect(ada?.writeIFollowBack).toBe(true)
    expect(ada?.iFollowBack).toBe(true)

    const bob = changeFor("bob", changes)
    expect(bob?.lists).toEqual([FOLLOWING_ID])
    expect(bob?.followsMeBack).toBe(false)
    expect(bob?.writeIFollowBack).toBe(false)

    const cam = changeFor("cam", changes)
    expect(cam?.lists).toEqual([FOLLOWERS_ID])
    expect(cam?.iFollowBack).toBe(false)
    expect(cam?.writeFollowsMeBack).toBe(false)
    expect(cam?.name).toBe("cam")
  })

  it("builds the followers list alone and leaves I follow them back unset", () => {
    const parsed = parseInstagramExport([followersFile([row("cam", "")])])
    expect(parsed.includedFollowing).toBe(false)
    const changes = planInstagramImport([], parsed, {
      followingListId: FOLLOWING_ID,
      followersListId: FOLLOWERS_ID,
    })
    const cam = changeFor("cam", changes)
    expect(cam?.lists).toEqual([FOLLOWERS_ID])
    expect(cam?.writeIFollowBack).toBe(false)
    expect(cam?.writeFollowsMeBack).toBe(false)
    expect(changes.some((change) => change.lists.includes(FOLLOWING_ID))).toBe(false)
  })

  it("keeps a typed follower count when the file has none, and does not drop a missing row", () => {
    const existing: IgExisting[] = [
      {
        id: "ada-row",
        name: "Ada",
        lists: [FOLLOWING_ID],
        username: "Ada",
        followerCount: 1200,
      },
      {
        id: "old-row",
        name: "Old Account",
        lists: [FOLLOWING_ID],
        username: "oldacct",
        followerCount: 4,
      },
    ]
    const parsed = parseInstagramExport([
      followingFile([row("ada", ""), { ...row("bea"), follower_count: 80 }]),
    ])
    const changes = planInstagramImport(existing, parsed, {
      followingListId: FOLLOWING_ID,
      followersListId: FOLLOWERS_ID,
    })
    const ada = changeFor("ada", changes)
    expect(ada?.create).toBe(false)
    expect(ada?.id).toBe("ada-row")
    expect(ada?.writeFollowerCount).toBe(false)
    expect(ada?.writeFollowsMeBack).toBe(false)
    expect(ada?.lists).toContain(FOLLOWING_ID)
    const bea = changeFor("bea", changes)
    expect(bea?.writeFollowerCount).toBe(true)
    expect(bea?.followerCount).toBe(80)
    expect(changes.some((change) => change.id === "old-row")).toBe(false)
    expect(changes.every((change) => change.create || change.id)).toBe(true)
  })

  it("reads a display name from HTML without a parser library", () => {
    const parsed = parseInstagramExport([
      {
        name: "following.html",
        text: `<div><h2>Ada Lovelace</h2><a href="https://www.instagram.com/ada">ada</a></div>
          <a href="https://www.instagram.com/_u/grace">grace</a>`,
      },
    ])
    expect(parsed.following.get("ada")?.name).toBe("Ada Lovelace")
    expect(parsed.following.get("grace")?.name).toBeUndefined()
    expect(parsed.includedFollowers).toBe(false)
  })

  it("reads a username from the href when the title and value are empty", () => {
    const parsed = parseInstagramExport([
      followingFile([
        {
          title: "",
          string_list_data: [{ href: "https://www.instagram.com/linus", value: "", timestamp: 1 }],
        },
      ]),
    ])
    expect(parsed.following.has("linus")).toBe(true)
  })
})

describe("attribute ids used by the plan", () => {
  it("keeps the stored field names stable", () => {
    expect(IG_FOLLOWER_COUNT).toBe("ig-follower-count")
    expect(IG_FOLLOWS_ME_BACK).toBe("ig-follows-me-back")
    expect(IG_I_FOLLOW_BACK).toBe("ig-i-follow-back")
  })
})
