import { beforeEach, describe, expect, it } from "vitest"
import type { WebFound } from "@/lib/bim-flow/web-lane"
import { datesIn, pickEventDate, readBirthdayReply, windowOf } from "@/lib/social-bimby/birthday-reply"
import { sendToBim } from "@/lib/ingest/bim-chat"
import { replyToCard } from "./card-reply"
import { useReportStore } from "./store"
import type { ReportPlan } from "./types"

// Sunday, the day the line was sent.
const NOW = new Date(2026, 10, 22, 14, 0)
const LINE = "the birthday was the same day as the foxtide show at brooklyn steel last weekend. and 22 years ago so 2004"

/** A venue calendar: many shows, each with its own day. Only one is Foxtide. */
const FOUND: WebFound = {
  query: "foxtide show brooklyn steel November 2026",
  results: [
    { title: "Brooklyn Steel — Upcoming Shows", url: "https://www.brooklynsteel.com/events", snippet: "Concerts at Brooklyn Steel, 319 Frost St." },
    { title: "Foxtide Tickets, 2026 Tour Dates", url: "https://www.example-tix.com/foxtide", snippet: "Foxtide live at Brooklyn Steel, Sat Nov 14, 2026. Doors 7pm." },
  ],
  pages: [
    {
      url: "https://www.brooklynsteel.com/events",
      text: [
        "Fri, Nov 13 · Glass Harbor · Doors 7:00 PM",
        "Sat, Nov 14 · Foxtide with special guests · Doors 7:00 PM",
        "Sun, Nov 15 · The Moss Choir · Doors 6:30 PM",
        "Fri, Nov 20 · Neon Ferns",
      ].join("\n"),
    },
  ],
}

function seedCard(): ReportPlan {
  const plan: ReportPlan = {
    id: "p1",
    text: "met Nico, it was his birthday",
    at: NOW.toISOString(),
    trace: [],
    effects: [
      {
        id: "e1",
        kind: "birthday",
        title: "Nico's birthday",
        reasoning: ["You said it was his birthday."],
        evidence: [],
        fields: [
          { key: "person", label: "Person", type: "text", value: "Nico" },
          { key: "date", label: "Birthday", type: "text", value: "" },
        ],
        status: "failed",
        result: "Birthday must look like 1998-03-14.",
      },
    ],
  }
  useReportStore.getState().put(plan)
  return plan
}

describe("reading a reply to a birthday card", () => {
  it("finds the year, the event and the window", () => {
    const r = readBirthdayReply(LINE, NOW)
    expect(r.year).toBe(2004)
    expect(r.yearsAgo).toBe(22)
    expect(r.event).toBe("foxtide show at brooklyn steel")
    expect(r.window).toMatchObject({ from: "2026-11-13", to: "2026-11-15", said: "last weekend" })
    expect(r.query).toBe("foxtide show brooklyn steel November 2026")
    expect(r.monthDay).toBeUndefined()
  })

  it("takes a day said outright, with no search", () => {
    expect(readBirthdayReply("it's march 14, 1998", NOW)).toMatchObject({ year: 1998, monthDay: { month: 3, day: 14 } })
    expect(readBirthdayReply("3/14 and he turned 28", NOW)).toMatchObject({ yearsAgo: 28, monthDay: { month: 3, day: 14 } })
  })

  it("windows the usual phrases", () => {
    expect(windowOf("yesterday", NOW)).toMatchObject({ from: "2026-11-21", to: "2026-11-21" })
    expect(windowOf("this weekend", NOW)).toMatchObject({ from: "2026-11-20", to: "2026-11-22" })
    expect(windowOf("last saturday", NOW)).toMatchObject({ from: "2026-11-21", to: "2026-11-21" })
    expect(windowOf("in october", NOW)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" })
  })

  it("reads dates in page text", () => {
    const got = datesIn("Sat, Nov 14 · Foxtide | 2026-11-20 | 11/21/2026 | 15 November", NOW).map((d) => d.iso)
    expect(got).toEqual(expect.arrayContaining(["2026-11-14", "2026-11-20", "2026-11-21", "2026-11-15"]))
  })

  it("picks the event's own day off a venue calendar, not its neighbours", () => {
    const hit = pickEventDate(FOUND, readBirthdayReply(LINE, NOW), NOW)
    expect(hit).toMatchObject({ iso: "2026-11-14", inWindow: true })
  })
})

describe("replyToCard", () => {
  beforeEach(() => useReportStore.setState({ plans: {}, order: [] }))

  it("answers the failed Nico card with a new card: 2004-11-14, and sets the old one aside", async () => {
    seedCard()
    const queries: string[] = []
    const reply = await replyToCard(LINE, { planId: "p1", effectId: "e1" }, NOW, { search: async (q) => (queries.push(q), FOUND) })
    expect(queries).toEqual(["foxtide show brooklyn steel November 2026"])
    expect(reply?.text).toMatch(/Nico's birthday: Nov 14, 2004/)
    expect(reply?.route).toMatch(/^REPLY · birthday · WEB/)
    const plan = useReportStore.getState().plans[reply!.reportId!]!
    const e = plan.effects[0]!
    expect(e.kind).toBe("birthday")
    expect(e.fields.find((f) => f.key === "date")?.value).toBe("2004-11-14")
    expect(e.fields.find((f) => f.key === "person")?.value).toBe("Nico")
    expect(e.reasoning.join(" ")).toMatch(/22 years before 2026 agrees/)
    expect(e.evidence[0]).toMatch(/Foxtide/)
    expect(useReportStore.getState().plans.p1!.effects[0]!.status).toBe("rejected")
  })

  it("says so when the search fails, and makes no card", async () => {
    seedCard()
    const reply = await replyToCard(LINE, { planId: "p1", effectId: "e1" }, NOW, { search: async () => null })
    expect(reply?.reportId).toBeUndefined()
    expect(reply?.text).toMatch(/couldn't look up/)
    expect(useReportStore.getState().plans.p1!.effects[0]!.status).toBe("failed")
  })

  it("counts the year back when only the age is said", async () => {
    seedCard()
    const reply = await replyToCard("same day as the foxtide show at brooklyn steel last weekend, 22 years ago", { planId: "p1", effectId: "e1" }, NOW, { search: async () => FOUND })
    const plan = useReportStore.getState().plans[reply!.reportId!]!
    expect(plan.effects[0]!.fields.find((f) => f.key === "date")?.value).toBe("2004-11-14")
  })

  it("leaves other kinds to the chat", async () => {
    useReportStore.getState().put({ id: "p2", text: "", at: NOW.toISOString(), trace: [], effects: [{ id: "n1", kind: "person-note", title: "Note", reasoning: [], evidence: [], fields: [], status: "pending" }] })
    expect(await replyToCard("hi", { planId: "p2", effectId: "n1" }, NOW, { search: async () => FOUND })).toBeNull()
  })

  it("runs through sendToBim when the line carries the card", async () => {
    seedCard()
    const line = await sendToBim(LINE, NOW, { llm: false, about: { planId: "p1", effectId: "e1", label: "BIRTHDAY · Nico's birthday" }, search: async () => FOUND })
    expect(line.route).toMatch(/^REPLY · birthday/)
    expect(line.reportId).toBeTruthy()
    expect(useReportStore.getState().plans[line.reportId!]!.effects[0]!.fields[1]!.value).toBe("2004-11-14")
  })
})
