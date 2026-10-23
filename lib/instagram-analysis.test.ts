import { beforeEach, describe, expect, it } from "vitest"
import {
  IG_ANALYSIS_LISTS,
  IG_DISPLAY_NAME,
  IG_FLAGS,
  IG_FOLLOWED_ME,
  IG_I_FOLLOWED,
  IG_INTERACTIONS,
  IG_LAST_ENGAGED,
  IG_PROFILE,
  igAnalysisColumns,
  igDay,
  looksLikeInstagramAnalysis,
  parseInstagramAnalysis,
  planInstagramAnalysisImport,
} from "@/lib/instagram-analysis"
import { IG_FOLLOWER_COUNT, IG_FOLLOWS_ME_BACK, IG_I_FOLLOW_BACK, IG_USERNAME } from "@/lib/instagram-export"
import {
  importInstagramExportTexts,
  INSTAGRAM_ANALYSIS_LIST_IDS,
  INSTAGRAM_FOLLOWERS_LIST_ID,
  INSTAGRAM_FOLLOWING_LIST_ID,
  PEOPLE_FOLDER_ID,
} from "@/lib/instagram-lists"
import { planDuplicateList } from "@/lib/lists-duplicate"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

const T1 = 1595977231 // 2020-07-28 UTC
const T2 = 1597473301 // 2020-08-15 UTC

/** A small summary.json in the shape analyze.py writes. */
function summary(overrides: Record<string, unknown> = {}) {
  return {
    generated: "2026-10-22",
    people: {
      mutual_one: { lk: 1, sl: 14, dm: 87, dmt: 167, last: T2, fo: T1, fr: T2, cf: 1, n: "Mutual One" },
      only_follow: { fo: T1 },
      fan_one: { fr: T2, uf: 1, vw: 3 },
      asked: { rq: T1, n: "Asked" },
      gone: { bk: T2 },
    },
    lists: {
      followers: ["fan_one", "mutual_one"],
      following: ["mutual_one", "only_follow"],
      mutuals: ["mutual_one"],
      nofb: ["only_follow"],
      fans: ["fan_one"],
      pending: ["asked"],
      blocked: ["gone"],
      contacts: [["Liza", "555"]],
    },
    usernames: ["asked", "fan_one", "gone", "mutual_one", "only_follow"],
    ...overrides,
  }
}

const LIST_IDS = {
  followers: "followers",
  following: "following",
  mutuals: "mutuals",
  nofb: "nofb",
  fans: "fans",
  pending: "pending",
  blocked: "blocked",
}

describe("parseInstagramAnalysis", () => {
  it("recognises summary.json and nothing else", () => {
    expect(looksLikeInstagramAnalysis(summary())).toBe(true)
    expect(looksLikeInstagramAnalysis({ relationships_following: [] })).toBe(false)
    expect(looksLikeInstagramAnalysis([])).toBe(false)
    expect(parseInstagramAnalysis({ people: {} })).toBeNull()
  })

  it("reads the report's columns for each account", () => {
    const parsed = parseInstagramAnalysis(summary())!
    expect(parsed.generated).toBe("2026-10-22")
    const mutual = parsed.people.get("mutual_one")!
    expect(mutual.attributes).toEqual({
      [IG_DISPLAY_NAME]: "Mutual One",
      [IG_FLAGS]: ["close friend"],
      [IG_I_FOLLOWED]: "2020-07-28",
      [IG_FOLLOWED_ME]: "2020-08-15",
      // lk + sl + dm; DMs got and views are not "my" interactions in the report
      [IG_INTERACTIONS]: 102,
      "ig-liked-posts": 1,
      "ig-story-likes": 14,
      "ig-dms-sent": 87,
      "ig-dms-got": 167,
      [IG_LAST_ENGAGED]: "2020-08-15",
      [IG_PROFILE]: "instagram.com/mutual_one",
    })
    // Zero counts are left blank.
    expect(parsed.people.get("only_follow")!.attributes[IG_INTERACTIONS]).toBeUndefined()
    expect(parsed.lists.mutuals).toEqual(new Set(["mutual_one"]))
    expect(parsed.people.size).toBe(5)
  })

  it("uses the report's UTC day", () => {
    expect(igDay(T1)).toBe("2020-07-28")
    expect(igDay(0)).toBeUndefined()
    expect(igDay("x")).toBeUndefined()
  })

  it("names each list's date columns as the report does", () => {
    const names = (key: keyof typeof IG_ANALYSIS_LISTS) => igAnalysisColumns(key).map((c) => c.name)
    expect(names("followers").slice(0, 5)).toEqual(["Username", "Display name", "Flags", "Followed me", "I follow back since"])
    expect(names("pending")).toContain("Requested")
    expect(names("blocked")).toContain("Blocked")
    expect(names("mutuals").slice(-3)).toEqual(["Reels/stories viewed", "Last I engaged", "Profile"])
    expect(igAnalysisColumns("nofb")).toHaveLength(16)
  })
})

describe("planInstagramAnalysisImport", () => {
  it("adds membership for every list and follow-back from both sides", () => {
    const changes = planInstagramAnalysisImport([], parseInstagramAnalysis(summary())!, LIST_IDS)
    const by = new Map(changes.map((c) => [c.name, c]))
    expect(by.get("mutual_one")!.lists).toEqual(["followers", "following", "mutuals"])
    expect(by.get("mutual_one")!.attributes[IG_FOLLOWS_ME_BACK]).toBe(true)
    expect(by.get("mutual_one")!.attributes[IG_I_FOLLOW_BACK]).toBe(true)
    expect(by.get("only_follow")!.attributes[IG_FOLLOWS_ME_BACK]).toBe(false)
    expect(by.get("fan_one")!.attributes[IG_I_FOLLOW_BACK]).toBe(false)
    expect(by.get("asked")!.lists).toEqual(["pending"])
    expect(by.get("gone")!.lists).toEqual(["blocked"])
    expect(changes.every((c) => c.create)).toBe(true)
  })

  it("moves an account off a list it left, keeps its other lists and columns", () => {
    const existing = [
      {
        id: "a",
        name: "My friend",
        lists: ["following", "nofb", "other-list"],
        attributes: { [IG_USERNAME]: "Only_Follow", [IG_FOLLOWER_COUNT]: 900, "ig-dms-sent": 4, mine: "kept" },
      },
    ]
    const next = summary({
      lists: { ...summary().lists, followers: ["fan_one", "mutual_one", "only_follow"], nofb: [], mutuals: ["mutual_one", "only_follow"] },
    })
    const [change] = planInstagramAnalysisImport(existing, parseInstagramAnalysis(next)!, LIST_IDS).filter((c) => c.id === "a")
    // nofb is empty in this summary, so it is left as it was.
    expect(change.lists).toEqual(["following", "nofb", "other-list", "followers", "mutuals"])
    expect(change.attributes[IG_FOLLOWER_COUNT]).toBe(900)
    expect(change.attributes.mine).toBe("kept")
    // An owned count the summary no longer has is cleared.
    expect(change.attributes["ig-dms-sent"]).toBeUndefined()
    expect(change.attributes[IG_FOLLOWS_ME_BACK]).toBe(true)
  })

  it("drops an account from a full list when it is no longer on it", () => {
    const existing = [{ id: "x", name: "left_me", lists: ["followers"], attributes: { [IG_USERNAME]: "left_me" } }]
    const [change] = planInstagramAnalysisImport(existing, parseInstagramAnalysis(summary())!, LIST_IDS).filter((c) => c.id === "x")
    expect(change.lists).toEqual([])
  })

  it("plans nothing on a second identical run", () => {
    const parsed = parseInstagramAnalysis(summary())!
    const first = planInstagramAnalysisImport([], parsed, LIST_IDS)
    const existing = first.map((c, i) => ({ id: String(i), name: c.name, lists: c.lists, attributes: c.attributes }))
    expect(planInstagramAnalysisImport(existing, parsed, LIST_IDS)).toEqual([])
  })
})

describe("summary.json through the Instagram upload", () => {
  beforeEach(() => {
    resetAllStores()
    useListsUiStore.setState({ homePinned: [], listDisplay: {} })
  })

  const upload = (value: unknown) =>
    importInstagramExportTexts([{ name: "summary.json", text: JSON.stringify(value) }])

  it("fills seven lists in the People folder with the report's columns", () => {
    const report = upload(summary())
    expect(report.ok).toBe(true)
    expect(report.message).toContain("Read the Instagram analysis from 2026-10-22.")
    expect(report.message).toContain("Added 5.")

    const { lists, tasks, folders } = useTaskStore.getState()
    const mutuals = lists.find((l) => l.id === INSTAGRAM_ANALYSIS_LIST_IDS.mutuals)!
    expect(mutuals.name).toBe("Instagram mutuals")
    expect(mutuals.instagramAnalysisList).toBe("mutuals")
    expect(mutuals.scheduleable).toBe(false)
    expect(mutuals.sheetConfig?.columnIds).toEqual(igAnalysisColumns("mutuals").map((c) => c.id))

    // The built-in lists keep their own columns first and gain the report's.
    const following = lists.find((l) => l.id === INSTAGRAM_FOLLOWING_LIST_ID)!
    expect(following.displayedAttributes?.slice(0, 3)).toEqual([IG_USERNAME, IG_FOLLOWER_COUNT, IG_FOLLOWS_ME_BACK])
    expect(following.displayedAttributes).toContain(IG_LAST_ENGAGED)
    expect(following.itemAttributes?.find((a) => a.id === IG_FOLLOWED_ME)?.name).toBe("Follows me since")

    const folder = folders.find((f) => f.id === PEOPLE_FOLDER_ID)!
    expect(folder.name).toBe("People")
    expect(folder.listIds).toEqual(
      expect.arrayContaining([INSTAGRAM_FOLLOWERS_LIST_ID, INSTAGRAM_FOLLOWING_LIST_ID, ...Object.values(INSTAGRAM_ANALYSIS_LIST_IDS)]),
    )
    expect(useListsUiStore.getState().listDisplay[INSTAGRAM_ANALYSIS_LIST_IDS.blocked]).toBe("table")

    const mutual = tasks.find((t) => t.attributes?.[IG_USERNAME] === "mutual_one")!
    expect(mutual.title).toBe("mutual_one")
    expect(mutual.lists).toEqual([INSTAGRAM_FOLLOWERS_LIST_ID, INSTAGRAM_FOLLOWING_LIST_ID, INSTAGRAM_ANALYSIS_LIST_IDS.mutuals])
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length)
  })

  it("updates in place on a second run and leaves a renamed list and a moved list alone", () => {
    upload(summary())
    const store = useTaskStore.getState()
    const fans = store.lists.find((l) => l.id === INSTAGRAM_ANALYSIS_LIST_IDS.fans)!
    store.updateList({ ...fans, name: "Fans" })
    store.addFolder({ id: "elsewhere", name: "Elsewhere", createdAt: new Date(), listIds: [] })
    store.removeListFromFolder(PEOPLE_FOLDER_ID, INSTAGRAM_ANALYSIS_LIST_IDS.blocked)
    store.addListToFolder("elsewhere", INSTAGRAM_ANALYSIS_LIST_IDS.blocked)
    const count = store.tasks.length

    const report = upload(summary())
    expect(report.message).toContain("Added 0.")
    expect(report.message).toContain("Updated 0.")
    const after = useTaskStore.getState()
    expect(after.tasks).toHaveLength(count)
    expect(after.lists.find((l) => l.id === INSTAGRAM_ANALYSIS_LIST_IDS.fans)!.name).toBe("Fans")
    expect(after.lists.filter((l) => l.instagramAnalysisList === "fans")).toHaveLength(1)
    expect(after.folders.find((f) => f.id === PEOPLE_FOLDER_ID)!.listIds).not.toContain(INSTAGRAM_ANALYSIS_LIST_IDS.blocked)
  })

  it("joins an account already imported from the followers download", () => {
    importInstagramExportTexts([
      {
        name: "following.json",
        text: JSON.stringify({
          relationships_following: [{ title: "", string_list_data: [{ value: "mutual_one", href: "", timestamp: 1 }] }],
        }),
      },
    ])
    const before = useTaskStore.getState().tasks.filter((t) => t.attributes?.[IG_USERNAME] === "mutual_one")
    expect(before).toHaveLength(1)
    upload(summary())
    const after = useTaskStore.getState().tasks.filter((t) => t.attributes?.[IG_USERNAME] === "mutual_one")
    expect(after.map((t) => t.id)).toEqual([before[0].id])
    expect(after[0].attributes?.["ig-story-likes"]).toBe(14)
  })

  it("lets an analysis list be deleted, and a duplicate is an ordinary list", () => {
    upload(summary())
    const pending = useTaskStore.getState().lists.find((l) => l.id === INSTAGRAM_ANALYSIS_LIST_IDS.pending)!
    expect(planDuplicateList(pending, { lists: useTaskStore.getState().lists, folders: [] } as never).list.instagramAnalysisList).toBeUndefined()
    useTaskStore.getState().deleteList(pending.id)
    expect(useTaskStore.getState().lists.some((l) => l.id === pending.id)).toBe(false)
    expect(useTaskStore.getState().removedListIds).toContain(pending.id)

    // Importing again makes the list under a fresh id, so the tombstone cannot drop it on reload.
    upload(summary())
    const again = useTaskStore.getState().lists.filter((l) => l.instagramAnalysisList === "pending")
    expect(again).toHaveLength(1)
    expect(again[0].id).not.toBe(pending.id)
    const asked = useTaskStore.getState().tasks.find((t) => t.attributes?.[IG_USERNAME] === "asked")!
    expect(asked.lists).toContain(again[0].id)
  })

  it("still reads the followers download the old way", () => {
    const report = importInstagramExportTexts([
      { name: "summary-of-nothing.json", text: JSON.stringify({ hello: 1 }) },
    ])
    expect(report.ok).toBe(false)
  })
})
