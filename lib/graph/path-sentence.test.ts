import { describe, expect, it } from "vitest"
import { pathSentence } from "@/lib/graph/path-sentence"

const defs = [
  {
    id: "mother-of",
    label: "mother of",
    phrases: { forward: ["$s is the mother of $o"], inverse: ["$o is the mother of $s"] },
  },
  { id: "blocks", label: "blocks" },
]

const title = (id: string) => ({ ada: "Ada", lio: "Lio", cy: "Cy" })[id] ?? id

describe("path sentence", () => {
  it("reads the forward phrase out and the inverse phrase in", () => {
    expect(
      pathSentence("ada", [{ relation: "mother-of", to: "lio", direction: "out" }], title, defs),
    ).toBe("Ada is the mother of Lio.")
    expect(
      pathSentence("lio", [{ relation: "mother-of", to: "ada", direction: "in" }], title, defs),
    ).toBe("Ada is the mother of Lio.")
  })

  it("falls back to the label, then joins hops into one sentence", () => {
    expect(
      pathSentence(
        "ada",
        [
          { relation: "mother-of", to: "lio" },
          { relation: "blocks", to: "cy", direction: "out" },
        ],
        title,
        defs,
      ),
    ).toBe("Ada is the mother of Lio; Lio blocks Cy.")
  })

  it("uses relationLabel when the def has no label, and says nothing for an empty path", () => {
    expect(pathSentence("ada", [{ relation: "related", to: "lio" }], title, [])).toBe("Ada related to Lio.")
    expect(pathSentence("ada", [], title, defs)).toBeNull()
  })
})
