import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getWeekString } from "@/lib/date-utils"
import { INSTAGRAM_ACCOUNT_TYPE_ID } from "@/lib/instagram-account-type"
import { IG_FOLLOWS_ME_BACK, IG_USERNAME } from "@/lib/instagram-export"
import { INSTAGRAM_ANALYSIS_LIST_IDS, INSTAGRAM_FOLLOWING_LIST_ID } from "@/lib/instagram-lists"
import { sendToBim, useBimChatStore } from "@/lib/ingest/bim-chat"
import { CHAT_LANES } from "@/lib/ingest/bim-lanes"
import { createPerson, ensurePeopleIKnowList, personNamed } from "@/lib/people-i-know"
import { getPlanEntries } from "@/lib/plan-text"
import { acceptAll } from "@/lib/report-bimby/decide"
import { useReportStore } from "@/lib/report-bimby/store"
import type { ReportPlan } from "@/lib/report-bimby/types"
import { quarterKey } from "@/lib/seasons"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { buildFuturePlan, clausesOf, readFuture, upcomingMonday, type FutureDeps } from "./future"
import { mutualCandidates, mutualsFrom, type Mutual } from "./mutuals"
import { trySocial } from "./run"
import { endSocialSession, readContactAnswer, reviewChunks, socialSessionOpen, startSocialSession, trySocialFollow, type ReviewLine, type SessionDeps } from "./session"

/** The line as typed in BIM chat on 2026-11-21, which BIM logged and asked "how much do you want to?". */
const LINE = "in terms of the future I am excited to hang out with Masha and I want to go on a trip with shelby; note texts and dms from each"

// Saturday, November 21, 2026, 9:22 pm.
const NOW = new Date(2026, 10, 21, 21, 22)
const NEXT_MONDAY = "2026-11-23"

const noContacts: FutureDeps = { mutuals: [], contactOf: () => ({ phones: [] }) }
const kinds = (plan: ReportPlan) => plan.effects.map((e) => e.kind)
const val = (plan: ReportPlan, i: number, key: string) => plan.effects[i]!.fields.find((f) => f.key === key)!.value

describe("readFuture", () => {
  it("reads the line: Masha to hang out with this coming week, a trip with Shelby this season, and a texts review", () => {
    const r = readFuture(LINE, [])!
    expect(r.people.map((p) => p.name)).toEqual(["Masha", "Shelby"])
    expect(r.people[0]!.intents).toEqual([{ kind: "hang", horizon: "week", phrase: "hang out with Masha", feeling: "excited" }])
    expect(r.people[1]!.intents[0]).toMatchObject({ kind: "trip", horizon: "season" })
    expect(r.people[1]!.intents[0]!.phrase).toMatch(/trip with shelby/)
    expect(r.review).toBe(true)
  })

  it("splits clauses on semicolons and 'and I'", () => {
    expect(clausesOf(LINE)).toEqual([
      "in terms of the future I am excited to hang out with Masha",
      "I want to go on a trip with shelby",
      "note texts and dms from each",
    ])
  })

  it("finds known people by first name and keeps their full name", () => {
    const r = readFuture(LINE, [{ id: "m1", name: "Masha Ivanova", instagram: "loureedstrash" }, { id: "s1", name: "Shelby Seal" }])!
    expect(r.people.map((p) => [p.name, p.known?.id])).toEqual([
      ["Masha Ivanova", "m1"],
      ["Shelby Seal", "s1"],
    ])
  })

  it("reads when: this year, this summer, next week", () => {
    expect(readFuture("I want to go on a trip with Kai this year", [])!.people[0]!.intents[0]!.horizon).toBe("year")
    expect(readFuture("want to hang out with Kai this summer and hang out with Jo next week", [])!.people.map((p) => p.intents[0]!.horizon)).toEqual(["season", "week"])
  })

  it("leaves lines that are not this: one hang-out alone, a question, pronouns", () => {
    expect(readFuture("I need to hang out with Kai next week", [])).toBeNull()
    expect(readFuture("should I go on a trip with Kai?", [])).toBeNull()
    expect(readFuture("I want to hang out with her and go on a trip with them", [])).toBeNull()
    expect(readFuture("took 1 adderall, only 3 left", [])).toBeNull()
  })
})

describe("buildFuturePlan", () => {
  it("per person: make them, a note, the intention, the plan entry; a trip also offers a maybe on the year", () => {
    const { plan, review } = buildFuturePlan(readFuture(LINE, [])!, LINE, NOW, noContacts)
    expect(kinds(plan)).toEqual([
      "person", "person-note", "intention", "plan-entry",
      "person", "person-note", "intention", "plan-entry", "plan-entry",
    ])
    // Masha: next week's plan, starting Monday the 23rd.
    expect(val(plan, 3, "period")).toBe("week")
    expect(val(plan, 3, "on")).toBe(NEXT_MONDAY)
    expect(val(plan, 3, "text")).toBe("Hang out with Masha")
    // Shelby: this season, then a maybe on the year.
    expect(val(plan, 7, "period")).toBe("quarter")
    expect(val(plan, 7, "text")).toBe("Go on a trip with Shelby")
    expect(val(plan, 8, "period")).toBe("year")
    expect(val(plan, 8, "text")).toBe("Maybe: go on a trip with shelby")
    expect(val(plan, 1, "text")).toBe("in terms of the future I am excited to hang out with Masha")
    expect(review).toEqual(["Masha", "Shelby"])
  })

  it("the coming week is next Monday's, even on a Sunday", () => {
    expect(upcomingMonday(new Date(2026, 10, 22, 10))).toEqual(new Date(2026, 10, 23))
    expect(upcomingMonday(new Date(2026, 10, 23, 10))).toEqual(new Date(2026, 10, 30))
  })

  it("fills an Instagram from your one matching mutual, and asks when several match or nothing does", () => {
    const mutuals: Mutual[] = [
      { name: "Masha Ivanova", username: "loureedstrash" },
      { name: "Shelby Seal", username: "shelbyseal" },
      { name: "Shelby K", username: "shelbs.k" },
    ]
    const { plan, asks } = buildFuturePlan(readFuture(LINE, [])!, LINE, NOW, { mutuals, contactOf: () => ({ phones: [] }) })
    expect(val(plan, 0, "instagram")).toBe("loureedstrash")
    expect(plan.effects[0]!.evidence).toEqual(["Instagram mutual: Masha Ivanova @loureedstrash"])
    expect(asks).toHaveLength(1)
    expect(asks[0]!.person).toBe("Shelby")
    expect(asks[0]!.candidates.map((c) => c.username)).toEqual(["shelbyseal", "shelbs.k"])

    const none = buildFuturePlan(readFuture(LINE, [])!, LINE, NOW, noContacts)
    expect(none.asks.map((a) => a.question)).toEqual([
      expect.stringContaining("What's Masha's number or @handle?"),
      expect.stringContaining("What's Shelby's number or @handle?"),
    ])
  })

  it("a known person with a number or a handle is not asked about and not remade", () => {
    const known = [{ id: "m1", name: "Masha", instagram: "loureedstrash" }, { id: "s1", name: "Shelby" }]
    const { plan, asks } = buildFuturePlan(readFuture(LINE, known)!, LINE, NOW, { mutuals: [], contactOf: (id) => ({ phones: id === "s1" ? ["555 123 4567"] : [] }) })
    expect(asks).toEqual([])
    expect(kinds(plan).filter((k) => k === "person")).toEqual([])
  })
})

describe("mutuals", () => {
  const account = (username: string, title: string, lists: string[], followsBack?: boolean): Task =>
    ({ id: `ig-${username}`, type: INSTAGRAM_ACCOUNT_TYPE_ID, title, lists, attributes: { [IG_USERNAME]: username, ...(followsBack !== undefined ? { [IG_FOLLOWS_ME_BACK]: followsBack } : {}) } }) as unknown as Task

  it("is the mutuals list, or someone you follow who follows you back", () => {
    const tasks = [
      account("loureedstrash", "Masha Ivanova", [INSTAGRAM_ANALYSIS_LIST_IDS.mutuals]),
      account("shelbyseal", "Shelby Seal", [INSTAGRAM_FOLLOWING_LIST_ID], true),
      account("celeb", "Shelby Famous", [INSTAGRAM_FOLLOWING_LIST_ID], false),
    ]
    expect(mutualsFrom(tasks).map((m) => m.username)).toEqual(["loureedstrash", "shelbyseal"])
  })

  it("matches every word of the name, then a handle that holds the first name", () => {
    const m: Mutual[] = [{ name: "Masha Ivanova", username: "x1" }, { name: "Other", username: "mashaaa.v" }, { name: "Jo Park", username: "jjj" }]
    expect(mutualCandidates("Masha", m).map((x) => x.username)).toEqual(["x1"])
    // No display name has both words, so the handle that holds "masha" is offered (and asked about, not filled, when there are several).
    expect(mutualCandidates("Masha K", m).map((x) => x.username)).toEqual(["mashaaa.v"])
    expect(mutualCandidates("Mashaaa", m).map((x) => x.username)).toEqual(["mashaaa.v"])
    expect(mutualCandidates("Jo", [{ name: "Joanna", username: "jo.anna" }])).toEqual([])
  })
})

describe("the follow-up: asks, then texts and DMs together", () => {
  const ask = { person: "Shelby", candidates: [{ name: "Shelby Seal", username: "shelbyseal" }, { name: "Shelby K", username: "shelbs.k" }], question: "Which one is Shelby?" }

  it("reads a pick, a number, a handle", () => {
    expect(readContactAnswer("2", ask)).toEqual({ instagram: "shelbs.k" })
    expect(readContactAnswer("her number is (555) 123-4567", ask)).toEqual({ phone: "(555) 123-4567" })
    expect(readContactAnswer("@Shelby.Rose", ask)).toEqual({ instagram: "shelby.rose" })
    expect(readContactAnswer("ig is shelbyrose_", ask)).toEqual({ instagram: "shelbyrose_" })
    expect(readContactAnswer("shelbyseal", ask)).toEqual({ instagram: "shelbyseal" })
    expect(readContactAnswer("I'm not sure honestly", ask)).toBeNull()
  })

  it("splits conversations where they go quiet for an hour and keeps the last four", () => {
    const at = (h: number, m = 0) => new Date(2026, 10, 20, h, m).getTime()
    const lines: ReviewLine[] = [0, 2, 4, 6, 8].flatMap((h) => [
      { at: at(h), dir: "in" as const, text: `hi ${h}`, via: "text" as const },
      { at: at(h, 20), dir: "out" as const, text: `yo ${h}`, via: "dm" as const },
    ])
    const chunks = reviewChunks(lines)
    expect(chunks).toHaveLength(4)
    expect(chunks[0]!.map((l) => l.text)).toEqual(["hi 2", "yo 2"])
  })

  describe("a session", () => {
    let plans: ReportPlan[] = []
    const deps = (texts: Record<string, ReviewLine[] | null>, dms: Record<string, ReviewLine[] | null> = {}): SessionDeps => ({
      loadTexts: async (n) => (n in texts ? (texts[n] ?? null) : []),
      loadDms: async (n) => (n in dms ? (dms[n] ?? null) : []),
      putPlan: (p) => plans.push(p),
    })
    const t0 = new Date(2026, 10, 18, 19).getTime()
    const masha: ReviewLine[] = [
      { at: t0, dir: "in", text: "omg that show was so fun", via: "dm" },
      { at: t0 + 60_000, dir: "out", text: "right?? we should go again", via: "dm" },
      { at: t0 + 86_400_000, dir: "in", text: "my sister is visiting next week", via: "text" },
    ]
    beforeEach(() => {
      plans = []
      endSocialSession()
    })

    it("asks first; an answer becomes a card; then goes over texts and DMs; notes come back as a card", async () => {
      const said = startSocialSession([{ person: "Shelby", candidates: [], question: "What's Shelby's number or @handle? (or skip)" }], ["Masha"], NOW.getTime())
      expect(said).toMatch(/What's Shelby's number/)

      const answered = (await trySocialFollow("@shelbyrose", NOW, deps({ Masha: masha })))!
      expect(answered.text).toMatch(/@shelbyrose: on the card below/)
      expect(answered.text).toMatch(/go over Masha's texts and DMs/)
      expect(plans[0]!.effects[0]).toMatchObject({ kind: "person" })
      expect(plans[0]!.effects[0]!.fields.find((f) => f.key === "instagram")!.value).toBe("shelbyrose")

      const first = (await trySocialFollow("go", NOW, deps({ Masha: masha })))!
      expect(first.text).toMatch(/^Masha, 1 of 2 · Instagram DMs/)
      expect(first.text).toContain("Masha: omg that show was so fun")
      expect(first.text).toContain("You: right?? we should go again")
      expect(first.text).toMatch(/What do you want to remember about Masha/)

      const kept = (await trySocialFollow("she loves live shows, take her to one", NOW, deps({ Masha: masha })))!
      expect(kept.text).toMatch(/Kept that for Masha/)
      const second = (await trySocialFollow("next", NOW, deps({ Masha: masha })))!
      expect(second.text).toMatch(/^Masha, 2 of 2 · texts/)
      await trySocialFollow("ask about her sister's visit", NOW, deps({ Masha: masha }))
      const end = (await trySocialFollow("next", NOW, deps({ Masha: masha })))!
      expect(end.text).toMatch(/Done with Masha: 2 notes below/)
      expect(end.text).toMatch(/That's everyone/)
      expect(plans[1]!.effects.map((e) => e.fields.find((f) => f.key === "text")!.value)).toEqual(["she loves live shows, take her to one", "ask about her sister's visit"])
      expect(socialSessionOpen(NOW.getTime())).toBe(false)
    })

    it("skip moves on, done stops, a command or a long unrelated line is left to the other lanes", async () => {
      startSocialSession([{ person: "Shelby", candidates: [], question: "What's Shelby's number or @handle? (or skip)" }], ["Masha", "Shelby"], NOW.getTime())
      expect(await trySocialFollow("log: ate lunch", NOW, deps({}))).toBeNull()
      expect(await trySocialFollow("I was thinking about how the weather has been really weird this whole week honestly", NOW, deps({}))).toBeNull()
      expect((await trySocialFollow("skip", NOW, deps({})))!.text).toMatch(/nothing saved for Shelby/)
      const none = (await trySocialFollow("go", NOW, deps({ Masha: [], Shelby: null }, { Shelby: null })))!
      expect(none.text).toMatch(/No texts or DMs with Masha/)
      expect(none.text).toMatch(/couldn't reach your texts or DMs for Shelby/)
      expect(socialSessionOpen(NOW.getTime())).toBe(false)

      startSocialSession([], ["Masha"], NOW.getTime())
      await trySocialFollow("go", NOW, deps({ Masha: masha }))
      await trySocialFollow("she's so funny", NOW, deps({ Masha: masha }))
      const stop = (await trySocialFollow("done", NOW, deps({ Masha: masha })))!
      expect(stop.text).toMatch(/1 note below.*Okay, stopping here/)
      expect(socialSessionOpen(NOW.getTime())).toBe(false)
    })

    it("is dropped after 30 quiet minutes", () => {
      startSocialSession([], ["Masha"], NOW.getTime())
      expect(socialSessionOpen(NOW.getTime() + 29 * 60_000)).toBe(true)
      expect(socialSessionOpen(NOW.getTime() + 31 * 60_000)).toBe(false)
    })
  })
})

describe("end to end", () => {
  beforeEach(() => {
    resetAllStores()
    endSocialSession()
    useReportStore.setState({ plans: {}, order: [] })
    useBimChatStore.setState({ lines: [], busy: false })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("saves nothing until Accept; then the people, notes, intentions, next week, the season and the year", async () => {
    const reply = trySocial(LINE, NOW)!
    expect(reply.route).toMatch(/^SOCIAL · future/)
    expect(reply.text).toMatch(/That's about Masha and Shelby/)
    expect(reply.text).toMatch(/What's Masha's number or @handle\?/)
    expect(personNamed("Masha")).toBeUndefined()
    expect(getPlanEntries("week", getWeekString(new Date(2026, 10, 23)))).toEqual([])

    await acceptAll(reply.reportId)
    const plan = useReportStore.getState().plans[reply.reportId]!
    expect(plan.effects.map((e) => [e.status, e.result])).toEqual(plan.effects.map((e) => ["applied", e.result]))

    const masha = personNamed("Masha")!
    const shelby = personNamed("Shelby")!
    expect(masha.noteLog?.at(-1)?.text).toBe("in terms of the future I am excited to hang out with Masha")
    expect(shelby.noteLog?.at(-1)?.text).toBe("I want to go on a trip with shelby")
    expect(masha.personProfile?.intentions).toMatchObject([{ text: "Hang out with Masha", kind: "hang", horizon: "week", date: "2026-11-21" }])
    expect(shelby.personProfile?.intentions).toMatchObject([{ text: "Go on a trip with Shelby", kind: "trip", horizon: "season" }])

    expect(getPlanEntries("week", getWeekString(new Date(2026, 10, 23))).map((e) => e.text)).toEqual([expect.stringContaining("Hang out with Masha")])
    expect(getPlanEntries("quarter", quarterKey(NOW)).map((e) => e.text)).toEqual([expect.stringContaining("Go on a trip with Shelby")])
    expect(getPlanEntries("year", "2026").map((e) => e.text)).toEqual([expect.stringContaining("Maybe: go on a trip with shelby")])
  })

  it("reuses a Masha already in People I Know: no second Masha, no ask about her", async () => {
    const listId = ensurePeopleIKnowList()
    const m = createPerson("Masha", listId)
    useTaskStore.getState().addTask({ ...m, personProfile: { instagram: "loureedstrash" } })
    const reply = trySocial(LINE, NOW)!
    expect(reply.text).not.toMatch(/Masha's number/)
    await acceptAll(reply.reportId)
    expect(useTaskStore.getState().tasks.filter((t) => t.type === "person" && /masha/i.test(t.title ?? t.description ?? ""))).toHaveLength(1)
  })

  it("in BIM chat: the line gets the card (not a log), then 'skip' twice and 'go' reads Masha's texts and DMs from the hub", async () => {
    const listId = ensurePeopleIKnowList()
    const m = createPerson("Masha", listId)
    useTaskStore.getState().addTask({ ...m, personProfile: { phones: ["+1 555 123 4567"] } })
    const urls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(String(url))
      if (String(url).includes("/api/phone-texts"))
        return new Response(JSON.stringify({ rows: [{ at: new Date(2026, 10, 19, 18).getTime(), dir: "in", h: "+15551234567", th: "t1", t: "are we still on for thursday" }] }))
      if (String(url).includes("/api/instagram/dms")) return new Response(JSON.stringify({ rows: [] }))
      throw new Error("no network in tests")
    })
    const card = await sendToBim(LINE, NOW, { llm: false })
    expect(card.route).toMatch(/^SOCIAL · future/)
    expect(card.reportId).toBeTruthy()
    expect(card.text).not.toMatch(/how much do you want/i)
    // Masha has a number; Shelby has nothing, so BIM asks.
    expect(card.text).toMatch(/What's Shelby's number or @handle\?/)
    const skipped = await sendToBim("skip", NOW, { llm: false })
    expect(skipped.text).toMatch(/go over Masha's texts and DMs/)
    const shown = await sendToBim("go", NOW, { llm: false })
    expect(shown.route).toMatch(/SOCIAL · review/)
    expect(shown.text).toContain("Masha: are we still on for thursday")
    expect(urls.some((u) => u.includes("/api/instagram/dms?name=Masha"))).toBe(true)
  })

  it("has its own lane before ask-back and every shape lane", () => {
    const ids = CHAT_LANES.map((l) => l.id) as string[]
    expect(ids.indexOf("social-follow")).toBeLessThan(ids.indexOf("ask-back"))
    expect(ids.indexOf("social-follow")).toBeGreaterThan(ids.indexOf("commands"))
  })
})
