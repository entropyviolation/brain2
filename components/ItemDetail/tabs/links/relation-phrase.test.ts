import { describe, expect, it } from "vitest"
import { guessReversePhrase } from "@/components/ItemDetail/links/relation-phrase"

describe("guessReversePhrase", () => {
  it.each([
    ["is a member of", "has member", false],
    ["is the coach of", "has coach", false],
    ["has member", "is a member of", false],
    ["has owner", "is an owner of", false],
    ["is roommates with", "is roommates with", true],
    ["coaches", "is coached by", false],
    ["employs", "is employed by", false],
    ["manages", "is managed by", false],
    ["carries", "is carried by", false],
    ["sort of near", "", false],
  ])("%s → %s", (label, inverseLabel, symmetric) => {
    expect(guessReversePhrase(label)).toEqual({ inverseLabel, symmetric })
  })
})
