import { describe, expect, it } from "vitest"
import { DEFAULT_FRIEND_PERSONALITY, personalityFor, sanitizeFriendPersonality } from "./baby-animal-personality"

describe("friend personality sanitize", () => {
  it("fills defaults and clamps scores without inventing lists", () => {
    expect(sanitizeFriendPersonality(null)).toEqual(DEFAULT_FRIEND_PERSONALITY)
    const next = sanitizeFriendPersonality({
      cadence: "chatty",
      suggestionRate: 140,
      listBias: { na: 80, "": 12 },
      pushiness: "nope",
    })
    expect(next.cadence).toBe("chatty")
    expect(next.suggestionRate).toBe(100)
    expect(next.listBias).toEqual({ na: 80 })
    expect(next.pushiness).toBe("nudge")
  })

  it("reads a stored personality by animal id without inventing one", () => {
    const stored = sanitizeFriendPersonality({ cadence: "quiet", suggestionRate: 10 })
    expect(personalityFor({ foal: stored }, "foal", "small foal").cadence).toBe("quiet")
    expect(personalityFor({}, "foal").cadence).toBe("eager")
    expect(personalityFor({}, "foal").todoWeight).toBeGreaterThan(personalityFor({}, "foal").habitWeight)
    expect(personalityFor({}, "hedgehog").habitWeight).toBeGreaterThan(personalityFor({}, "crow").habitWeight)
    expect(personalityFor({}, "crow").nextActionsWeight).toBeGreaterThan(personalityFor({}, "lamb").nextActionsWeight)
    expect(personalityFor({}, "owl").whimId).toBe("read")
    expect(personalityFor({}, "kitten").dialogEffect).toBe("sparkle")
    expect(personalityFor({}, "puppy").loveYouRate).toBeGreaterThan(personalityFor({}, "crow").loveYouRate)
    expect(personalityFor({}, "mouse", "baby mouse").dialogEffect).toBe("whisper")
    expect(personalityFor({}, "mouse", "baby mouse").whimId).toBe("curl")
    expect(personalityFor({}, "skunk", "The Cutest Skunk").whimId).toBe("soak")
    expect(personalityFor({}, "axolotl", "Small Axolotl").dialogEffect).toBe("sparkle")
    expect(personalityFor({}, "axolotl", "Small Axolotl").titleLoves).toContain("pink")
    expect(personalityFor({}, "tiny-cute-striped-polecat", "Tiny Cute Striped Polecat").whimId).toBe("shiny")
    expect(personalityFor({}, "pack-00f0350b6374", "Little Rock Hyrax").dialogEffect).toBe("sparkle")
    expect(personalityFor({}, "pack-other", "Little Rock Hyrax").titleLoves).toContain("snow")
    expect(personalityFor({}, "kitten", "Baby Kitten").cadence).toBe("quiet")
    expect(personalityFor({}, "puppy", "Itty-Bitty Puppy").loveYouRate).toBeGreaterThan(personalityFor({}, "crow").loveYouRate)
    expect(personalityFor({}, "bunny", "Small Bunny").dialogEffect).toBe("whisper")
  })
})
