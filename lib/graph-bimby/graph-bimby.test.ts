import { describe, expect, it } from "vitest"
import { dayIn, parseTellLead, readAbout, sentences, tellLead } from "./parse"
import { buildGraphPlan } from "./plan"
import { withProposals } from "./ghosts"
import type { MemoryGraph } from "@/lib/memory-graph/build"

const NOW = new Date(2026, 10, 24, 15, 0)
const LINDA = { id: "p-linda", name: "Linda Gibbins Croft", person: true }
const PEOPLE = [
  { id: "p-linda", name: "Linda Gibbins Croft" },
  { id: "p-elijah", name: "Elijah Gibbins Croft" },
  { id: "p-marilyn", name: "Marilyn Monroe" },
]

const SAID =
  "Linda Gibbins Croft is my boyfriend Elijah Gibbins Croft's biological mother. She is a former social worker and currently a remote therapist. She lives at 245463463 wallaby way. etc etc"

describe("parseTellLead", () => {
  it("takes the name and the words from the GRAPH key's lead", () => {
    expect(parseTellLead(`${tellLead("Linda Gibbins Croft")}she is nice`)).toEqual({ name: "Linda Gibbins Croft", names: ["Linda Gibbins Croft"], body: "she is nice" })
    expect(parseTellLead("tell about Foxtide Work: due friday")).toEqual({ name: "Foxtide Work", names: ["Foxtide Work"], body: "due friday" })
  })
  it("leaves every other line alone", () => {
    expect(parseTellLead("tell me about Linda")).toBeNull()
    expect(parseTellLead("Tell BIM about Linda:   ")).toBeNull()
    expect(parseTellLead("tell habits bimby i did skincare")).toBeNull()
  })
})

describe("readAbout", () => {
  it("reads the Linda example into kin, a fact and an address", () => {
    const { reads, unread } = readAbout(SAID, LINDA, PEOPLE, NOW)
    expect(reads).toMatchObject([
      { kind: "kin", relation: "mother-of", role: "mother", qualifier: "biological", otherName: "Elijah Gibbins Croft", otherId: "p-elijah", toMe: "boyfriend" },
      { kind: "fact", text: "Linda is a former social worker and currently a remote therapist" },
      { kind: "place", text: "245463463 wallaby way", precision: "mailing" },
    ])
    expect(unread).toEqual([])
  })

  it("dates a sighting at Thanksgiving and reads an ask as a to-do", () => {
    const { reads } = readAbout("Saw her at thanksgiving and she made me mad. She wants me to send my christmas list asap", LINDA, PEOPLE, NOW)
    // Thanksgiving 2026 is Nov 26, after "today": past tense takes 2025's (Nov 27).
    expect(reads).toMatchObject([
      { kind: "seen", date: "2025-11-27", dateSaid: true },
      { kind: "todo", title: "Send my christmas list to Linda", urgent: true },
    ])
  })

  it("reads contact details, a birthday and how they are to you", () => {
    const { reads } = readAbout("Her number is 951 201 5076. Her ig is @lindagc. Her birthday is March 3. She is my aunt.", LINDA, PEOPLE, NOW)
    expect(reads).toMatchObject([
      { kind: "contact", phones: ["951 201 5076"] },
      { kind: "contact", handles: ["lindagc"] },
      { kind: "birthday", date: "2027-03-03" },
      { kind: "relation", word: "aunt", relation: "aunt-uncle-of" },
    ])
  })

  it("keeps people-only reads off an item that is not a person", () => {
    const { reads, unread } = readAbout("I need to call the venue today. Saw her at the show.", { id: "t1", name: "Foxtide Work", person: false }, PEOPLE, NOW)
    expect(reads.map((r) => r.kind)).toEqual(["todo"])
    expect(unread).toEqual(["Saw her at the show."])
  })

  it("splits sentences and drops an etc tail", () => {
    expect(sentences("One thing. Two things!\nThree; four etc etc")).toEqual(["One thing.", "Two things!", "Three", "four"])
  })

  it("finds holidays on the asked side of today", () => {
    expect(dayIn("at christmas", NOW, "future")).toBe("2026-12-25")
    expect(dayIn("at christmas", NOW, "past")).toBe("2025-12-25")
  })
})

describe("buildGraphPlan", () => {
  const data = {
    subject: LINDA,
    people: PEOPLE,
    tasks: [{ id: "t-xmas", name: "Send Linda Christmas list" }],
    known: { address: undefined, relation: undefined, linkedIds: [] as string[] },
  }

  it("proposes the note, kin link, fact and address for the Linda example", () => {
    const { plan } = buildGraphPlan(SAID, NOW, data, [])
    expect(plan.about).toBe("p-linda")
    expect(plan.effects.map((e) => e.kind)).toEqual(["item-note", "kin", "relation", "fact", "place"])
    const kin = plan.effects.find((e) => e.kind === "kin")!
    expect(kin.title).toBe("Linda Gibbins Croft is the biological mother of Elijah Gibbins Croft")
    expect(kin.ref).toBe("p-elijah")
    expect(plan.effects.find((e) => e.kind === "relation")!.fields.find((f) => f.key === "relation")!.value).toBe("boyfriend's biological mother")
    expect(plan.effects.every((e) => e.status === "pending")).toBe(true)
  })

  it("amends a to-do already on the list instead of making a twin", () => {
    const { plan } = buildGraphPlan("She wants me to send my christmas list asap", NOW, data, [])
    const amend = plan.effects.find((e) => e.kind === "amend")!
    expect(amend.ref).toBe("t-xmas")
    expect(plan.effects.some((e) => e.kind === "todo")).toBe(false)
  })

  it("skips a link that already exists", () => {
    const { plan } = buildGraphPlan(SAID, NOW, { ...data, known: { ...data.known, linkedIds: ["p-elijah"] } }, [])
    expect(plan.effects.some((e) => e.kind === "kin")).toBe(false)
  })
})

describe("withProposals", () => {
  it("draws each waiting change as a proposed node on the center", () => {
    const graph: MemoryGraph = { centerId: "p-linda", nodes: [{ id: "p-linda", kind: "person", label: "Linda", facts: [] }], edges: [] }
    const { plan } = buildGraphPlan(SAID, NOW, { subject: LINDA, people: PEOPLE, tasks: [], known: { linkedIds: [] } }, [])
    plan.effects[0].status = "applied"
    const out = withProposals(graph, [plan])
    const ghosts = out.nodes.filter((n) => n.kind === "proposal")
    expect(ghosts).toHaveLength(plan.effects.length - 1)
    expect(out.edges.every((e) => e.a === "p-linda" && e.proposed)).toBe(true)
    expect(ghosts[0].proposal).toEqual({ planId: plan.id, effectId: plan.effects[1].id })
  })
})

describe("readsFromModel", () => {
  it("keeps only reads that quote a sentence the rules left, and drops invented ones", async () => {
    const { readsFromModel } = await import("./llm")
    const unread = ["Linda grew sunflowers every summer with her dad."]
    const out = readsFromModel(
      {
        reads: [
          { kind: "fact", quote: "grew sunflowers every summer", value: "Linda grows sunflowers in summer" },
          { kind: "fact", quote: "she is a pilot", value: "Linda is a pilot" },
          { kind: "relation", quote: "with her dad", value: "x", other: "Bob", role: "father" },
          { kind: "none", quote: "Linda", value: "" },
        ],
      },
      unread,
      LINDA,
      NOW,
    )
    expect(out).toEqual([{ kind: "fact", text: "Linda grows sunflowers in summer", quote: unread[0] }])
  })
})

describe("project tells", () => {
  const FOX = { id: "t-fox", name: "Foxtide Work", person: false, project: true }
  it("reads plans as parts and doubts as considerations", () => {
    const { plan } = buildGraphPlan("Next step is to book the venue asap. Thinking about moving the show to spring.", NOW, { subject: FOX, people: PEOPLE, tasks: [], known: { linkedIds: [] } })
    expect(plan.effects.map((e) => [e.kind, e.fields[0]?.value])).toEqual([
      ["item-note", "Next step is to book the venue asap. Thinking about moving the show to spring."],
      ["step", "Book the venue"],
      ["consider", "Thinking about moving the show to spring"],
    ])
  })

  it("tells about a group: a note on each and a list to hold them", () => {
    const { plan } = buildGraphPlan("They are all coming to dinner on Sunday.", NOW, {
      subject: LINDA,
      group: [LINDA, { id: "p-elijah", name: "Elijah Gibbins Croft", person: true }],
      people: PEOPLE,
      tasks: [],
      known: { linkedIds: [] },
    })
    expect(plan.aboutIds).toEqual(["p-linda", "p-elijah"])
    expect(plan.effects.map((e) => e.kind)).toEqual(["item-note", "item-note", "fact", "group"])
    expect(plan.effects.at(-1)!.fields[0].value).toBe("Linda Gibbins Croft + Elijah Gibbins Croft")
  })
})
