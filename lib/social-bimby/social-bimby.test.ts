import { beforeEach, describe, expect, it } from "vitest"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { getWeekString } from "@/lib/date-utils"
import { getPlanEntries } from "@/lib/plan-text"
import { findPeopleIKnowList, personNamed, PEOPLE_I_KNOW_LIST_ID } from "@/lib/people-i-know"
import { findRemindersList } from "@/lib/reminders"
import { acceptAll } from "@/lib/report-bimby/decide"
import { useReportStore } from "@/lib/report-bimby/store"
import { parseHandoff } from "@/lib/ingest/bimby-handoff"
import { CHAT_LANES } from "@/lib/ingest/bim-lanes"
import { validateBlueprint } from "@/lib/agents/blueprint"
import { socialBimbyBlueprint } from "@/lib/agents/adapters/social-bimby"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { readSocial } from "./parse"
import { buildSocialPlan } from "./plan"
import { trySocial } from "./run"

const MASHA =
  "serious potential new friend Masha, dmd her yesterday (loureedstrash) asking Her to hang out. And she was so sweet and immediately invited me to something on Friday, which I can't go to because I'm going to New York. But she was so sweet and excited to be friends, and I need to hang out with her as soon as I get back."

// Wednesday, November 11, 2026, 3 pm.
const NOW = new Date(2026, 10, 11, 15, 0)

describe("readSocial", () => {
  it("reads the Masha message", () => {
    const r = readSocial(MASHA)!
    expect(r.name).toBe("Masha")
    expect(r.instagram).toBe("loureedstrash")
    expect(r.relation).toBe("serious potential new friend")
    expect(r.hangOut?.kind).toBe("after-trip")
    expect(r.trip).toBe("New York")
    expect(r.events).toHaveLength(1)
    expect(r.events[0]).toMatchObject({ day: 5, going: false })
    expect(r.feelings).toContain("so sweet")
  })

  it("finds a known person by name and does not make a second", () => {
    const r = readSocial("I need to hang out with Kai next week, he invited me to his show", [{ id: "p1", name: "Kai Moreno" }])!
    expect(r.known?.id).toBe("p1")
    expect(r.hangOut?.kind).toBe("next-week")
  })

  it("reads a birthday", () => {
    const r = readSocial("Jo's birthday is March 3")!
    expect(r.name).toBe("Jo")
    expect(r.birthday).toMatchObject({ month: 3, day: 3 })
  })

  it("leaves lines that are not social", () => {
    expect(readSocial("took 1 adderall, only 3 left")).toBeNull()
    expect(readSocial("my friend said the store closes at 9")).toBeNull()
    expect(readSocial("when did I last see Masha?", [{ id: "p", name: "Masha" }])).toBeNull()
    expect(readSocial("going to New York on Friday")).toBeNull()
  })
})

describe("buildSocialPlan", () => {
  it("places 'as soon as I get back' on the day after the flight home", () => {
    const flights = [
      { from: "SFO", to: "JFK", departDate: "2026-11-13", notes: [], missing: [] },
      { from: "JFK", to: "SFO", departDate: "2026-11-17", arriveDate: "2026-11-17", notes: [], missing: [] },
    ]
    const plan = buildSocialPlan(readSocial(MASHA)!, MASHA, NOW, { flights, cityOf: (c) => (c === "JFK" ? "New York" : "San Francisco") })
    const reminder = plan.effects.find((e) => e.kind === "reminder")!
    expect(reminder.fields.find((f) => f.key === "when")!.value).toBe("2026-11-18T11:00")
    expect(reminder.evidence.join(" ")).toContain("JFK→SFO")
  })

  it("with no flight, uses next Monday and says so", () => {
    const plan = buildSocialPlan(readSocial(MASHA)!, MASHA, NOW, { flights: [] })
    expect(plan.effects.map((e) => e.kind)).toEqual(["person", "person-note", "reminder", "plan-entry"])
    const reminder = plan.effects.find((e) => e.kind === "reminder")!
    expect(reminder.fields.find((f) => f.key === "when")!.value).toBe("2026-11-16T11:00")
    expect(reminder.reasoning.join(" ")).toMatch(/No flight home from New York/)
  })
})

describe("Social BIMBY end to end", () => {
  beforeEach(() => {
    useReportStore.setState({ plans: {}, order: [] })
    useTaskStore.setState({ tasks: [] })
  })

  it("writes nothing until Accept, then makes the person, Instagram, note, reminder and plan entry", async () => {
    const returnLeg: Task = {
      id: "fl-home",
      type: FLIGHT_TYPE_ID,
      description: "JFK → SFO",
      stage: "list",
      createdAt: NOW,
      completed: false,
      links: [],
      tags: [],
      attributes: { [FLIGHT_ATTR.departureAirport]: "JFK", [FLIGHT_ATTR.arrivalAirport]: "SFO", [FLIGHT_ATTR.departureTime]: "2026-11-17T09:00" },
    } as unknown as Task
    useTaskStore.getState().addTask(returnLeg)

    const reply = trySocial(MASHA, NOW)!
    expect(reply.route).toMatch(/^SOCIAL/)
    expect(personNamed("Masha")).toBeUndefined()

    await acceptAll(reply.reportId)
    const plan = useReportStore.getState().plans[reply.reportId]!
    expect(plan.effects.every((e) => e.status === "applied")).toBe(true)

    const masha = personNamed("Masha")!
    expect(masha.lists).toContain(findPeopleIKnowList(useTaskStore.getState().lists)?.id ?? PEOPLE_I_KNOW_LIST_ID)
    expect(masha.personProfile?.instagram).toBe("loureedstrash")
    expect(masha.personProfile?.relation).toBe("serious potential new friend")
    expect(masha.noteLog?.at(-1)?.text).toBe(MASHA)

    const remindersId = findRemindersList(useTaskStore.getState().lists)!.id
    const reminder = useTaskStore.getState().tasks.find((t) => t.lists?.includes(remindersId) && /Hang out with Masha/.test(t.description ?? ""))!
    expect(reminder.scheduledTime).toBe("11:00")
    expect(reminder.links?.some((l) => l.targetId === masha.id)).toBe(true)

    const when = plan.effects.find((e) => e.kind === "plan-entry")!.fields.find((f) => f.key === "on")!.value
    const [y, m, d] = when.split("-").map(Number)
    const entries = getPlanEntries("week", getWeekString(new Date(y!, m! - 1, d!)))
    expect(entries.some((e) => /Hang out with Masha/.test(e.text))).toBe(true)
  })

  it("a second message about Masha reuses her", async () => {
    await acceptAll(trySocial(MASHA, NOW)!.reportId)
    const again = trySocial("Masha's birthday is April 9", NOW)!
    await acceptAll(again.reportId)
    const people = useTaskStore.getState().tasks.filter((t) => t.type === "person" && /masha/i.test(t.description ?? ""))
    expect(people).toHaveLength(1)
    expect(people[0]!.attributes?.birthday).toBe("2026-04-09")
    expect(people[0]!.noteLog).toHaveLength(2)
  })
})

describe("wiring", () => {
  it("has a lane in BIM chat ahead of texts, fact and tell", () => {
    const ids = CHAT_LANES.map((l) => l.id) as string[]
    expect(ids.indexOf("social")).toBeGreaterThan(-1)
    expect(ids.indexOf("social")).toBeLessThan(ids.indexOf("fact"))
    expect(ids.indexOf("social")).toBeLessThan(ids.indexOf("tell"))
  })

  it("takes a hand-off by name", () => {
    expect(parseHandoff("send this to social bimby: met Jo at the show")).toEqual({ target: "social", payload: "met Jo at the show" })
  })

  it("has a sound Blueprint", () => {
    expect(validateBlueprint(socialBimbyBlueprint())).toEqual([])
  })
})
