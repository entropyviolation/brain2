import { describe, expect, it } from "vitest"
import { noteText, readLength, readPassing } from "./parse"

const NOW = new Date(2026, 10, 24, 9, 25)
// The real dump of 2026-11-24 in BIM chat.
const DUMP =
  "but anyway, charge headphones so I can listen to my INCREDIBLE new discover/mega playlist i spent a few hrs or whatever building this morning (can be seen from spotify usage and playlistlab; id label the activity of that time 'music discovery/making playlists'. and then ivebeen working on brain2 for a few hrs already it seems (testing if the secret escape works. ) and now im going to have to clean house before 2pmish when Elijah gets home. Bare minimum - change sheets, open all window, put clothes away, clear surfaces, clear off couch. Best case maybe i just hit the laundromat and clean couch cushions and other stuff idk. idk.... oh shit our detergent is in the laundry room anyway. TO DO ASAP - get neighbor laundry key to make copy."

const lines = (text: string) => readPassing(text, NOW).map(noteText)

describe("the real dump", () => {
  it("keeps both activities said in passing and the event", () => {
    expect(lines(DUMP)).toEqual([
      "activity: music discovery/making playlists, about 3 h, this morning",
      "activity: working on brain2, about 3 h, until now",
      "event: Elijah gets home, about 2 PM",
    ])
  })
})

describe("one-liners", () => {
  it.each([
    ["spent a few hrs building playlists", ["activity: building playlists, about 3 h"]],
    ["Elijah gets home 2pm", ["event: Elijah gets home, 2 PM"]],
    // Sent live on 2026-11-24: the activity once swallowed ", feeling so tired".
    ["i spent a few hrs building playlists this morning, feeling so tired. Elijah gets home 2pm", ["activity: building playlists, about 3 h, this morning", "mood: tired", "event: Elijah gets home, 2 PM"]],
    ["elijah gets home at 2", ["event: Elijah gets home, 2 PM"]],
    ["mom lands around 6:30pm", ["event: Mom lands, about 6:30 PM"]],
    ["walked the dog for 45 minutes with Marilyn", ["activity: walked the dog, 45 min, with Marilyn"]],
    ["was at the laundromat this morning", ["place: the laundromat"]],
    ["hung out with Marilyn after lunch", ["company: Marilyn"]],
    ["Marilyn came over", ["company: Marilyn"]],
    ["feeling so tired today", ["mood: tired"]],
    ["been cleaning for 2 hours, feeling productive", ["activity: cleaning, 2 h", "mood: productive"]],
  ])("%s", (text, want) => {
    expect(lines(text)).toEqual(want)
  })
  it.each([
    "need to clean the house before 2",
    "going to the gym later",
    "what time is it",
    "add milk to shopping",
    "the movie was good",
  ])("leaves %s alone", (text) => {
    expect(lines(text)).toEqual([])
  })
})

describe("readLength", () => {
  it("reads vague and exact lengths", () => {
    expect(readLength("a few hrs")).toEqual({ minutes: 180, approx: true })
    expect(readLength("a couple hours")).toEqual({ minutes: 120, approx: true })
    expect(readLength("2-3 hours")).toEqual({ minutes: 150, approx: true })
    expect(readLength("45 minutes")).toEqual({ minutes: 45, approx: false })
    expect(readLength("an hour and a half")).toEqual({ minutes: 90, approx: false })
  })
})
