import { describe, expect, it } from "vitest"
import { readAnchor, readAnchorClock, readBeforeAsk, readFiling, readMentions } from "./parse"

// The real lines from BIM chat on 2026-11-24.
const NOW = new Date(2026, 10, 24, 10, 21)
const FILING = "what I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready (45 minutes)."
const DUMP =
  "but anyway, charge headphones so I can listen to my INCREDIBLE new discover/mega playlist i spent a few hrs or whatever building this morning (can be seen from spotify usage and playlistlab; id label the activity of that time 'music discovery/making playlists'. and then ivebeen working on brain2 for a few hrs already it seems (testing if the secret escape works. ) and now im going to have to clean house before 2pmish when Elijah gets home. Bare minimum - change sheets, open all window, put clothes away, clear surfaces, clear off couch. Best case maybe i just hit the laundromat and clean couch cushions and other stuff idk. idk.... oh shit our detergent is in the laundry room anyway. TO DO ASAP - get neighbor laundry key to make copy."

describe("readAnchor", () => {
  it("folds gets back / gets home / comes home into one event", () => {
    expect(readAnchor("before Elijah gets back")?.anchor).toEqual({ key: "elijah:home", label: "Elijah gets home" })
    expect(readAnchor("until elijah comes home")?.anchor.key).toBe("elijah:home")
    expect(readAnchor("how many minutes until elijah gets back?")?.anchor.key).toBe("elijah:home")
  })
  it("reads the clock said with it", () => {
    const hit = readAnchor("clean house before 2pmish when Elijah gets home")
    expect(hit?.anchor.key).toBe("elijah:home")
    expect(hit?.clock).toBe("2pm")
  })
  it("leaves a plain clock alone", () => {
    expect(readAnchor("clean the house before 2pm")).toBeNull()
  })
})

describe("readAnchorClock", () => {
  it("reads 2pmish from the dump", () => {
    expect(new Date(readAnchorClock(DUMP, "elijah:home", NOW)!).getHours()).toBe(14)
  })
  it("reads a told time, and a bare hour as the afternoon", () => {
    expect(new Date(readAnchorClock("elijah gets home at 2", "elijah:home", NOW)!).getHours()).toBe(14)
    expect(new Date(readAnchorClock("Elijah will be back around 1:30pm", "elijah:home", NOW)!).getMinutes()).toBe(30)
  })
})

describe("readFiling", () => {
  it("files the colon list as required items", () => {
    const f = readFiling(FILING, NOW)!
    expect(f.anchor.key).toBe("elijah:home")
    expect(f.items.map((i) => i.title)).toEqual(["Clean the house", "Shower and get ready"])
    expect(f.items[0]!.urgent).toBe(true)
    expect(f.items[1]!.minutes).toBe(45)
    expect(f.items.every((i) => i.required)).toBe(true)
  })
  it("reads 'before X I need to …' and '… before X'", () => {
    expect(readFiling("before elijah gets home I need to change the sheets and put clothes away", NOW)?.items.map((i) => i.title)).toEqual(["Change the sheets", "Put clothes away"])
    expect(readFiling("need to clean the house before elijah gets home", NOW)?.items.map((i) => i.title)).toEqual(["Clean the house"])
  })
  it("is not a question", () => {
    expect(readFiling("what do i have to do before elijah gets home", NOW)).toBeNull()
  })
})

describe("readBeforeAsk", () => {
  it("reads the list question with no ?", () => {
    expect(readBeforeAsk("what do i have to do before elijah gets home")).toMatchObject({ anchor: { key: "elijah:home" }, list: true })
  })
  it("reads the time question, and both together", () => {
    expect(readBeforeAsk("how many minutes until elijah gets back?")).toMatchObject({ time: true })
    expect(readBeforeAsk("how many minutes until elijah gets back? and what do i have to do in the minutes")).toMatchObject({ time: true, list: true })
  })
  it("leaves the filing alone", () => {
    expect(readBeforeAsk(FILING)).toBeNull()
  })
})

describe("readMentions", () => {
  it("reads the plan and the lists after it from the real dump", () => {
    const items = readMentions(DUMP, "elijah:home", NOW)
    const titles = items.map((i) => i.title)
    expect(titles).toEqual(["Clean house", "Change sheets", "Open all window", "Put clothes away", "Clear surfaces", "Clear off couch", "Hit the laundromat", "Clean couch cushions"])
    expect(items.filter((i) => !i.required).map((i) => i.title)).toEqual(["Hit the laundromat", "Clean couch cushions"])
  })
})
