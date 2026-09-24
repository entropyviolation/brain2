import { describe, expect, it } from "vitest"
import {
  BABY_ANIMALS,
  NAME_SHAPES,
  formatBabyAnimalName,
  localDayKey,
  localMondayKey,
  parseCompanion,
  pickBabyAnimalFromKey,
  pickCompanion,
  slugFriendId,
} from "./baby-animals"

describe("baby animals", () => {
  it("does not put kitten, puppy, or bunny first", () => {
    expect(BABY_ANIMALS[0]?.id).toBe("crow")
    expect(["kitten", "puppy", "bunny"]).not.toContain(BABY_ANIMALS[0]?.id)
  })

  it("still keeps the popular nursery animals in the roster", () => {
    const ids = BABY_ANIMALS.map((animal) => animal.id)
    expect(ids).toEqual(expect.arrayContaining(["kitten", "puppy", "bunny", "seal", "duckling", "chick", "lamb", "skunk"]))
  })

  it("formats both Baby Crow and cute small kitten shapes", () => {
    const crow = BABY_ANIMALS.find((animal) => animal.id === "crow")!
    const kitten = BABY_ANIMALS.find((animal) => animal.id === "kitten")!
    const seal = BABY_ANIMALS.find((animal) => animal.id === "seal")!
    expect(formatBabyAnimalName(crow, "baby-short")).toBe("Baby Crow")
    expect(formatBabyAnimalName(kitten, "cute-small-young")).toBe("cute small kitten")
    expect(formatBabyAnimalName(seal, "baby-young")).toBe("baby seal pup")
    expect(formatBabyAnimalName(kitten, "little-baby-short")).toBe("Little Baby Kitten")
    const skunk = BABY_ANIMALS.find((animal) => animal.id === "skunk")!
    expect(formatBabyAnimalName(skunk, "cute-small-young")).toBe("cute small skunk")
    expect(formatBabyAnimalName(skunk, "sweet-little-young")).toBe("sweet little skunk")
  })

  it("turns a typed request into a card slug", () => {
    expect(slugFriendId("Tiny Cute Striped Polecat")).toBe("tiny-cute-striped-polecat")
    expect(slugFriendId("   ")).toBe("friend")
  })

  it("never uses the word wee in a companion name", () => {
    for (const animal of BABY_ANIMALS) {
      for (const shape of NAME_SHAPES) {
        expect(formatBabyAnimalName(animal, shape).toLowerCase()).not.toMatch(/\bwee\b/)
      }
    }
  })

  it("picks deterministically from a key and varies across nearby keys", () => {
    const a = pickBabyAnimalFromKey("companion:2026-09-20:0")
    const b = pickBabyAnimalFromKey("companion:2026-09-20:0")
    const c = pickBabyAnimalFromKey("companion:2026-09-20:1")
    expect(a.displayName).toBe(b.displayName)
    expect(a.animal.id).toBe(b.animal.id)
    expect(`${c.animal.id}:${c.shape}`).not.toBe(`${a.animal.id}:${a.shape}`)
    expect(a.portraitSrc).toMatch(/\/baby-animals\//)
  })

  it("does not collapse every seed onto kitten", () => {
    const ids = Array.from({ length: 40 }, (_, salt) => pickCompanion("2026-09-20", salt).animal.id)
    expect(new Set(ids).size).toBeGreaterThan(8)
    expect(ids.some((id) => id !== "kitten")).toBe(true)
  })

  it("covers every name shape", () => {
    const used = new Set(NAME_SHAPES.map((_, i) => formatBabyAnimalName(BABY_ANIMALS[i % BABY_ANIMALS.length]!, NAME_SHAPES[i]!)))
    expect(used.size).toBe(NAME_SHAPES.length)
    for (const name of used) {
      expect(name.length).toBeGreaterThan(4)
    }
  })

  it("keys the week from Monday, not the calendar day", () => {
    expect(localMondayKey(new Date(2026, 8, 21))).toBe("2026-09-21")
    expect(localMondayKey(new Date(2026, 8, 22))).toBe("2026-09-21")
    expect(localMondayKey(new Date(2026, 8, 27))).toBe("2026-09-21")
    expect(localMondayKey(new Date(2026, 8, 20))).toBe("2026-09-14")
  })

  it("drops a stored companion once the local day rolls", () => {
    const today = localDayKey(new Date("2026-09-20T12:00:00"))
    expect(today).toBe("2026-09-20")
    const kept = parseCompanion(
      JSON.stringify({ day: "2026-09-20", salt: 2, id: "crow", displayName: "Baby Crow" }),
      "2026-09-20",
    )
    expect(kept?.id).toBe("crow")
    expect(
      parseCompanion(JSON.stringify({ day: "2026-09-19", salt: 2, id: "crow", displayName: "Baby Crow" }), "2026-09-20"),
    ).toBeNull()
  })
})
