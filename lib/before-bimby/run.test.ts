import { describe, expect, it } from "vitest"
import { readDump } from "@/lib/dump-bimby/parse"
import type { Task } from "@/lib/types"
import { answerBefore, beforeAppendix, itemsBefore, tryBefore } from "./run"

// The real morning of 2026-11-24 in BIM chat.
const at = (h: number, m: number) => new Date(2026, 10, 24, h, m).toISOString()
const NOW = new Date(2026, 10, 24, 10, 22)
const DUMP =
  "but anyway, charge headphones so I can listen to my INCREDIBLE new discover/mega playlist i spent a few hrs or whatever building this morning (can be seen from spotify usage and playlistlab; id label the activity of that time 'music discovery/making playlists'. and then ivebeen working on brain2 for a few hrs already it seems (testing if the secret escape works. ) and now im going to have to clean house before 2pmish when Elijah gets home. Bare minimum - change sheets, open all window, put clothes away, clear surfaces, clear off couch. Best case maybe i just hit the laundromat and clean couch cushions and other stuff idk. idk.... oh shit our detergent is in the laundry room anyway. TO DO ASAP - get neighbor laundry key to make copy."
const LOGS = [
  { text: "what I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready (45 minutes).", at: at(9, 19) },
  { text: DUMP, at: at(9, 25) },
  { text: "how many minutes until elijah gets back? and what do i have to do in the minutes", at: at(9, 26) },
  // Yesterday's line names him too, and is not today's.
  { text: "need to vacuum before elijah gets home", at: new Date(2026, 10, 23, 9, 0).toISOString() },
]
const done: Task = { id: "t1", description: "Change sheets", type: "task", completed: true, completedDate: new Date(2026, 10, 24, 10, 0), scheduledDate: new Date(2026, 10, 24) } as Task
const data = { tasks: [done], logs: LOGS }

describe("the ask, from the real morning", () => {
  it("answers 'what do i have to do before elijah gets home' with the time and every thing said", () => {
    const reply = tryBefore("what do i have to do before elijah gets home", NOW, data)!
    expect(reply.route).toContain("BEFORE")
    expect(reply.text).toContain("Elijah gets home around 2 PM: 3 hours 38 minutes from now")
    for (const t of ["Clean the house", "Shower and get ready · 45 min", "Put clothes away", "Clear surfaces", "Clear off couch", "Open all window"]) expect(reply.text).toContain(t)
    expect(reply.text).toMatch(/If time:\n• Hit the laundromat\n• Clean couch cushions/)
    expect(reply.text).toMatch(/Done:\n• Change sheets/)
    expect(reply.text).not.toContain("Vacuum")
  })
  it("reads clean house and clean the house as one thing", () => {
    const items = itemsBefore({ key: "elijah:home", label: "Elijah gets home" }, data, NOW)
    expect(items.filter((i) => /clean (?:the )?house/i.test(i.title))).toHaveLength(1)
  })
  it("answers the time question with the list too", () => {
    const reply = tryBefore("how many minutes until elijah gets back?", NOW, data)!
    expect(reply.text).toMatch(/^Elijah gets home around 2 PM: 3 hours 38 minutes/)
    expect(reply.text).toContain("Clean the house")
  })
  it("adds the list under a model answer", () => {
    expect(beforeAppendix("how many minutes until elijah gets back?", NOW, data)).toMatch(/^Before Elijah gets home, you said you have to:\n1\. Clean the house/)
  })
  it("passes a time question it cannot answer when nothing was said", () => {
    expect(answerBefore({ key: "marilyn:home", label: "Marilyn gets home" }, { list: false, time: true }, data, NOW)).toBeNull()
  })
})

describe("the Dump BIMBY on the same dump", () => {
  it("reads the plans before the event, due at its clock", () => {
    const read = readDump(DUMP, new Date(2026, 10, 24, 9, 25))
    const tied = read.intentions.filter((i) => i.before === "Elijah gets home")
    expect(tied.map((i) => i.title)).toEqual(["Clean house", "Change sheets", "Open all window", "Put clothes away", "Clear surfaces", "Clear off couch", "Hit the laundromat", "Clean couch cushions"])
    expect(new Date(tied[0]!.by!).getHours()).toBe(14)
    expect(read.intentions.some((i) => /laundry key/i.test(i.title))).toBe(true)
    expect(read.intentions.some((i) => /^Charge headphones/.test(i.title))).toBe(true)
    expect(read.rest.some((r) => /^Bare minimum/.test(r))).toBe(false)
  })
})
