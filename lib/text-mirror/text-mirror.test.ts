import { describe, it, expect } from "vitest"
import { appendEntry, countWords, entryHtml, isLongEnough, parseMirrorCommand, sourceLabel } from "./text-mirror"

const CMD =
  'Create a document in Docs called "Allietext" and make it so that any text added manaully by user anywhere in the app (human written text, user written text) over 70 words should be automatically added (with source and time info as header and separated by newline) to the document all across app'

describe("parseMirrorCommand", () => {
  it("reads the Allietext sentence", () => {
    expect(parseMirrorCommand(CMD)).toEqual({ kind: "enable", title: "Allietext", overWords: 70 })
  })
  it("reads a stop line", () => {
    expect(parseMirrorCommand("Stop auto-adding typed text to Allietext")).toEqual({ kind: "disable" })
  })
  it("ignores other sentences", () => {
    expect(parseMirrorCommand("Create a document called \"Trip\"")).toBeNull()
    expect(parseMirrorCommand("log: wrote 100 words")).toBeNull()
  })
})

describe("word threshold", () => {
  it("is strictly over", () => {
    expect(isLongEnough(Array(70).fill("a").join(" "), 70)).toBe(false)
    expect(isLongEnough(Array(71).fill("a").join(" "), 70)).toBe(true)
    expect(countWords("— a , b")).toBe(2)
  })
})

describe("entries", () => {
  it("shape a header, the text, and a blank line", () => {
    const html = entryHtml("Notes › Body", new Date(2026, 10, 7, 9, 5), "one <two>\nthree")
    expect(html).toContain("<strong>Notes › Body · ")
    expect(html).toContain("one &lt;two&gt;<br>three")
    expect(html.endsWith("<p><br></p>")).toBe(true)
  })
  it("replaces a blank body and otherwise appends", () => {
    expect(appendEntry("<p><br></p>", "X")).toBe("X")
    expect(appendEntry("<p>a</p>", "X")).toBe("<p>a</p>X")
  })
  it("builds a source without repeats", () => {
    expect(sourceLabel({ dialog: "Item", field: "item" })).toBe("Item")
    expect(sourceLabel({})).toBe("Unlabeled field")
  })
})
