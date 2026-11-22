import { describe, expect, it } from "vitest"
import { activityName, readDayStream, sinceDate } from "./bim-grammar"

const kinds = (line: string) => readDayStream(line)?.map((p) => `${p.kind}:${p.what}`) ?? null

describe("day-stream grammar", () => {
  it("reads to dos, with tomorrow and without filler", () => {
    expect(kinds("need to book the train tickets")).toEqual(["todo:book the train tickets"])
    expect(kinds("Also really need to call the bank")).toEqual(["todo:call the bank"])
    expect(kinds("MUST MUST FINISH THE ZINE TODAY!")).toEqual(["todo:FINISH THE ZINE"])
    expect(readDayStream("have to go to the store tomorrow")).toEqual([{ kind: "todo", what: "go to the store", dayOffset: 1 }])
    expect(kinds("To do: plant the basil")).toEqual(["todo:plant the basil"])
    expect(kinds("Still have to do those posters")).toEqual(["todo:do those posters"])
  })

  it("reads wants, and buying after need to / gotta as a want", () => {
    expect(kinds("need more phone chargers")).toEqual(["want:phone chargers"])
    expect(kinds("iso camera charger")).toEqual(["want:camera charger"])
    expect(kinds("Iso: lamp shade")).toEqual(["want:lamp shade"])
    expect(kinds("gotta get boot repair glue")).toEqual(["want:boot repair glue"])
    expect(kinds("gotta get my bike")).toEqual(["todo:get my bike"])
    expect(kinds("i ordered a lamp")).toBeNull()
    expect(kinds("need more meds")).toEqual(["todo:refill meds"])
  })

  it("reads an intake only with a known pill or drink", () => {
    expect(readDayStream("took another pill btw (2)")).toEqual([{ kind: "intake", what: "another pill (2)", cls: "drug" }])
    expect(kinds("2nd energy drink of the day")).toEqual(["intake:2nd energy drink of the day"])
    expect(readDayStream("sipping mint yerba")?.[0]).toMatchObject({ kind: "intake", cls: "drink" })
    expect(kinds("took a nap")).toBeNull()
    expect(kinds("gonna have a red bull")).toBeNull()
  })

  it("reads activity starts and stops", () => {
    expect(kinds("starting dishes")).toEqual(["start:dishes"])
    expect(kinds("taking a shower rn")).toEqual(["start:shower"])
    expect(kinds("home from walk")).toEqual(["stop:walk"])
    expect(kinds("done with laundry")).toEqual(["stop:laundry"])
    expect(readDayStream("walking since 4:40")?.[0]).toMatchObject({ kind: "start", what: "walking", since: { h: 4, m: 40 } })
    expect(kinds("leaving house rn")).toBeNull()
    expect(kinds("startin now then")).toBeNull()
  })

  it("splits parts and keeps a part it cannot read as a log line", () => {
    expect(kinds("done with shower now time to get dressed")).toEqual(["stop:shower", "rest:time to get dressed"])
    expect(kinds("hitting the vape. took an adderall earlier too")).toEqual(["intake:the vape", "intake:an adderall earlier too"])
  })

  it("leaves questions, list headers, pastes and plain notes to the other lanes", () => {
    expect(readDayStream("do i need to book the train?")).toBeNull()
    expect(readDayStream("Intention: take vitamins, drink water")).toBeNull()
    expect(readDayStream("need to\nbook train")).toBeNull()
    expect(readDayStream("the sunset was pretty")).toBeNull()
    expect(readDayStream("https://example.com need to read")).toBeNull()
  })

  it("names the activity, not the sentence", () => {
    expect(activityName("taking a shower")).toBe("shower")
    expect(activityName("doing the dishes")).toBe("dishes")
  })

  it("puts 'since 4:40' at the latest such time not in the future", () => {
    const now = new Date(2026, 10, 21, 17, 0)
    expect(sinceDate({ h: 4, m: 40 }, now).getHours()).toBe(16)
    expect(sinceDate({ h: 9, m: 0 }, now).getHours()).toBe(9)
    expect(sinceDate({ h: 4, m: 40, pm: false }, now).getHours()).toBe(4)
  })
})

describe("counts as <habit>", () => {
  it("reads the habit and keeps the rest as its note", () => {
    expect(readDayStream("doing a facemask rn so counts as skincare")).toEqual([{ kind: "habit", what: "skincare", note: "doing a facemask" }])
    expect(readDayStream("walked to the store, that counts for my steps habit")).toEqual([{ kind: "habit", what: "steps", note: "walked to the store" }])
  })
})
