import { describe, expect, it } from "vitest"
import { stripSecretSpans } from "@/lib/secrets"
import { wholeSecret } from "./make-secret"
import { withoutEchoes } from "@/lib/bim-flow/retrieve"

describe("wholeSecret", () => {
  it("wraps a plain line so it hides with secrets off", () => {
    const s = wholeSecret("who do I think about at night")
    expect(s).toBe("\\secret who do I think about at night \\secret")
    expect(stripSecretSpans(s).trim()).toBe("")
  })

  it("folds a line that was partly secret into one span, and leaves an all-secret line alone", () => {
    expect(stripSecretSpans(wholeSecret("Logged: \\secret thinking of Marilyn \\secret · 10:59 AM")).trim()).toBe("")
    expect(wholeSecret("\\secret already \\secret")).toBe("\\secret already \\secret")
  })
})

describe("withoutEchoes", () => {
  it("drops rows that only repeat the question, keeps the rest", () => {
    const rows = [
      { text: "Text log · who do I think about at night · from text pipeline" },
      { text: "thinking about Marilyn Monroe at night again" },
    ]
    expect(withoutEchoes(rows, "Who do I think about at night?")).toEqual([rows[1]])
    expect(withoutEchoes(rows, "night")).toEqual(rows)
  })
})
