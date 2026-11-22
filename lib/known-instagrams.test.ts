import { describe, expect, it } from "vitest"
import { suggestInstagrams, type KnownInstagram } from "@/lib/known-instagrams"

const known: KnownInstagram[] = [
  { handle: "nico.nyc", who: "Nico", person: true },
  { handle: "dominico", person: false },
  { handle: "sam_r", who: "Nicole Park", person: true },
  { handle: "other", person: false },
]

describe("suggestInstagrams", () => {
  it("ranks handle prefix, then contains, then the person's name", () => {
    expect(suggestInstagrams(known, "nic").map((k) => k.handle)).toEqual(["nico.nyc", "dominico", "sam_r"])
  })
  it("ignores a leading @ and is empty for nothing typed", () => {
    expect(suggestInstagrams(known, "@oth").map((k) => k.handle)).toEqual(["other"])
    expect(suggestInstagrams(known, "")).toEqual([])
  })
})
