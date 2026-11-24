import { beforeEach, describe, expect, it } from "vitest"
import { useFollowStore } from "@/lib/follow-through/store"
import { emptyLedger } from "@/lib/follow-through/types"
import { useReportStore } from "@/lib/report-bimby/store"
import { readClock } from "@/lib/stream-bimby/parse"
import { useTaskStore } from "@/lib/task-store"
import { usePlanRunStore } from "../store"
import { fileDay } from "./apply"
import { tryDay } from "./run"
import { useDayPlanStore } from "./store"
import { readDayUpdate, type DayChange } from "./update"
import { applyDayEffect } from "./update-apply"

const M1 =
  "what I have to do for the rest of the day: order hairdye and anything else from walmart (tights comes to mind) asap, dye hair, bleach eyebrows, shave legs, pack (my stuff and elijahs) and plan outfits, finish foxtide stuff, and plan ny, and read marilyn text and reply. MUST be done is dye hair (and thus order hairdye) bleach eyebrows and pack, and text marilyn. and then foxtide stuff and planning ny is important as well. also i prob will have to do my laundry can you find out what time the laundromats by my house close?"

const M2 = `update on this plan- laundromats close really soon and its hella dark so like either im not doing laundry orrr im doing it here somehow?!? like asking the neighbor if i can use their laundry key? gaining courage to do that. Scary thing. maybe i should make myself do 1 scary thing per day. Still havent really done anything just danced around, drank redbull, did take an adderall did make the order (it’s on its way now) maybe worked on brain2 a little which is good. (update as of 7pm). add to my to do list make shebly gift (orca) maybe do sewing fix sewing machine? and check into flight which is tomorrow at basically noon so get to the port at… hey wait where’s my passport (put it under the red boxes to flatten) need to get a case for that thing!

updated plan:
-walmart incoming
-check into flight
-maybe post on something else?
- dye hair, bleach eyebrows, shower, shave, oil up


updateee 7:36 the walmart order has arrived, posted on something else.

need to just clean tf out of the house and pack and dye hair and bleach brows. Also i really do think i should ask a neighbor to borrow their laundry key…


was putting in dry shampoo to ask for laundry key now cutting hair? actually i should do key first?


8:11 after a lot of rehearsing, job finally done with (laundry key obtained) it was extremely stressful and im still a bit stressed.`

const at = (h: number, m = 0) => new Date(2026, 10, 11, h, m, 0, 0)
const adds = (cs: DayChange[]) => cs.flatMap((c) => (c.op === "add" ? [c] : []))
const lines = (cs: DayChange[]) => cs.flatMap((c) => (c.op === "line" ? [c.line] : []))

beforeEach(() => {
  useDayPlanStore.setState({ plans: {}, order: [] })
  useFollowStore.setState(emptyLedger())
  usePlanRunStore.setState({ run: null })
  useReportStore.setState({ plans: {}, order: [] } as never)
  useTaskStore.setState({ tasks: [] } as never)
})

async function planAt410() {
  const reply = await tryDay(M1, at(16, 10))
  return useDayPlanStore.getState().plans[reply!.dayId!]!
}

describe("clocks in an evening stream", () => {
  it("reads a bare clock as the latest one not after the send time", () => {
    expect(readClock("updateee 7:36 the order came", at(20, 12))?.hhmm).toBe("19:36")
    expect(readClock("8:11 job done", at(20, 12))?.hhmm).toBe("20:11")
    expect(readClock("8:17 hit", at(13, 57))?.hhmm).toBe("08:17")
    expect(readClock("(update as of 7pm)")?.hhmm).toBe("19:00")
    expect(readClock("11:30-1:15 work", at(14, 0))).toMatchObject({ hhmm: "11:30", end: "13:15" })
  })
})

describe("the day plan keeps a to-do said beside a question", () => {
  it("puts laundry on the list and keeps the laundromat question", async () => {
    const plan = await planAt410()
    expect(plan.items.map((i) => i.title)).toContain("do laundry")
    expect(plan.remarks.join(" ")).toMatch(/laundromats by my house close/)
  })
})

describe("an update read against the plan", () => {
  it("is changes to the plan, not 23 notes", async () => {
    const plan = await planAt410()
    const { changes, heard } = readDayUpdate(plan, M2, { since: "16:10", now: at(20, 12) })
    const added = adds(changes)
    const key = added.find((a) => /neighbor/.test(a.title))!
    // The way laundry can happen comes first, it is scary, and it got done at 20:11.
    expect(key).toMatchObject({ before: "do laundry", resistance: 3, doneAt: "20:11" })
    expect(key.feeling).toMatch(/scared/)
    // Things added to the day, with the prerequisite and the must.
    expect(added.find((a) => a.title === "make shebly gift")).toMatchObject({ note: "orca", tier: "rest" })
    expect(added.find((a) => a.title === "fix sewing machine")).toMatchObject({ before: "do sewing" })
    expect(added.find((a) => a.title === "check into flight")).toMatchObject({ tier: "must" })
    expect(added.find((a) => a.title === "post on something else")).toMatchObject({ doneAt: "19:36" })
    // Nothing already on the plan is added twice ("bleach brows" is "bleach eyebrows", "shave" is "shave legs").
    expect(added.map((a) => a.title)).not.toEqual(expect.arrayContaining(["bleach brows", "shave", "pack", "dye hair", "walmart incoming"]))
    // The walmart order was done somewhere in 16:10–19:00, not at a minute.
    expect(changes).toContainEqual(expect.objectContaining({ op: "done", item: "order hairdye and anything else from walmart", from: "16:10", to: "19:00" }))
    expect(lines(changes)).toEqual(
      expect.arrayContaining([
        "note: i should make myself do 1 scary thing per day",
        expect.stringMatching(/^track: danced around, drank redbull.* 16:10-19:00$/),
        "shopping: passport case",
        "note: where my passport is: put it under the red boxes to flatten",
        "log: walmart order arrived at 19:36",
        "log: laundry key obtained at 20:11",
      ]),
    )
    expect(lines(changes).some((l) => /^note: mood: .*stressed.*at 20:11$/.test(l))).toBe(true)
    // Asides are heard, not filed.
    expect(heard).toContain("get to the port at")
    expect(changes.length).toBeLessThan(23)
  })

  it("comes through tryDay as a card, and accepting it changes the plan", async () => {
    const plan = await planAt410()
    const reply = await tryDay(M2, at(20, 12))
    expect(reply?.route).toMatch(/^DAY · update/)
    const card = useReportStore.getState().plans[reply!.reportId!]!
    const keyAdd = card.effects.find((e) => e.op === "add" && /neighbor/.test(e.title))!
    expect(applyDayEffect(keyAdd, at(20, 12)).ok).toBe(true)
    const after = useDayPlanStore.getState().plans[plan.id]!
    const key = after.items.find((i) => /neighbor/.test(i.title))!
    const laundry = after.items.find((i) => i.title === "do laundry")!
    expect(laundry.after).toBe(key.id)
    expect(key).toMatchObject({ resistance: 3, blocker: expect.stringMatching(/scared/) })
    expect(new Date(key.doneAt!).getHours()).toBe(20)
    expect(after.heardAt).toBe(at(20, 12).toISOString())
  })

  it("checks off a filed task inside a window when the minute is unknown", async () => {
    const plan = await planAt410()
    fileDay(plan.id, at(16, 15))
    const reply = await tryDay(M2, at(20, 12))
    const card = useReportStore.getState().plans[reply!.reportId!]!
    const done = card.effects.find((e) => e.op === "done")!
    const res = applyDayEffect(done, at(20, 12))
    expect(res.message).toMatch(/sometime 16:10–19:00/)
    const item = useDayPlanStore.getState().plans[plan.id]!.items.find((i) => /walmart/.test(i.title))!
    expect(item.doneWindow).toBe("16:10–19:00")
    expect(useTaskStore.getState().tasks.find((t) => t.id === item.filedTaskId)?.completed).toBe(true)
  })
})
