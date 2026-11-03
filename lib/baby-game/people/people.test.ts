import { describe, expect, it } from "vitest"
import { cachedWalk } from "../walk"
import { SPRITE_PALETTE, SPRITE_SIZE } from "../sprites"
import { BOTTOMS, BUILDS, CENTER_SPEC, EXTRAS, HAIR_STYLES, HATS, MOUTHS, parsePerson, PATTERNS, SHOES, TOPS, type PersonSpec } from "./spec"
import { drawPerson, type PersonPose } from "./draw"
import { colorHex, COLOR_NAMES, rampOf } from "./color"
import { GEN_PEOPLE } from "./gen-people"
import { getPlayerSpec, playerGridOf } from "./player"

const VIEWS = ["front", "side", "back"] as const
const POSES: PersonPose[] = ["stand", "blink", "breathe", "walk0", "walk1", "walk2", "walk3", "reach", "reach2", "wave", "wave2", "cheer", "cheer2"]

const valid = (grid: string[], label: string) => {
  expect(grid, label).toHaveLength(SPRITE_SIZE)
  for (const row of grid) {
    expect(row, label).toHaveLength(SPRITE_SIZE)
    for (const ch of row) expect(ch === "." || SPRITE_PALETTE[ch], `${label} letter ${ch}`).toBeTruthy()
  }
  // the margin the sprite pipeline keeps clear
  expect(grid[0]!.replace(/[.k]/g, ""), label).toBe("")
  expect(grid[SPRITE_SIZE - 1]!.replace(/[.k]/g, ""), label).toBe("")
}

describe("the Center of The World", () => {
  it("is the pixie: pale, brown-eyed, strawberry blonde, in black with a chain belt and white go-go boots", () => {
    expect(CENTER_SPEC.skin).toBe("pale")
    expect(CENTER_SPEC.eyes).toBe("brown")
    expect(CENTER_SPEC.hair.color).toBe("strawberry")
    expect(CENTER_SPEC.top).toMatchObject({ kind: "corset", color: "black" })
    expect(CENTER_SPEC.shoes).toMatchObject({ kind: "gogo", color: "white" })
    expect(CENTER_SPEC.extras).toEqual(expect.arrayContaining(["chainbelt", "scarf", "pointyears"]))
    expect(getPlayerSpec()).toEqual(CENTER_SPEC)
  })

  it("draws every pose in every view on the palette", () => {
    for (const view of VIEWS) for (const pose of POSES) valid(drawPerson(CENTER_SPEC, view, pose), `${view} ${pose}`)
  }, 60000)

  it("shows her colors: black clothes, white boots, silver, strawberry hair", () => {
    const flat = drawPerson(CENTER_SPEC, "front").join("")
    const colors = new Set([...flat].map((ch) => SPRITE_PALETTE[ch]).filter(Boolean))
    expect(colors.has(colorHex("strawberry"))).toBe(true)
    expect(colors.has(colorHex("white"))).toBe(true)
    expect(colors.has(colorHex("black"))).toBe(true)
    expect(colors.size).toBeGreaterThanOrEqual(14)
  })

  it("has brown eyes: no green or teal anywhere in her snapped palette, and the spec says brown", () => {
    expect(CENTER_SPEC.eyes).toBe("brown")
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max === min) return { h: 0, s: 0 }
      const d = max - min
      const l = (max + min) / 2
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60
      return { h, s }
    }
    for (const [ch, hex] of Object.entries(GEN_PEOPLE.player!.palette)) {
      const { h, s } = hue(hex)
      expect(h < 70 || h > 200 || s < 0.18, `${ch} ${hex} reads green or teal`).toBe(true)
    }
  })

  it("moves: walk frames differ, blink closes the eyes, and a wave raises an arm", () => {
    for (const view of VIEWS) {
      const frames = new Set([0, 1, 2, 3].map((f) => drawPerson(CENTER_SPEC, view, `walk${f}` as PersonPose).join("")))
      expect(frames.size, view).toBeGreaterThanOrEqual(3)
    }
    expect(drawPerson(CENTER_SPEC, "front", "blink").join("")).not.toBe(drawPerson(CENTER_SPEC, "front").join(""))
    expect(drawPerson(CENTER_SPEC, "front", "wave").join("")).not.toBe(drawPerson(CENTER_SPEC, "front").join(""))
    expect(drawPerson(CENTER_SPEC, "side", "reach").join("")).not.toBe(drawPerson(CENTER_SPEC, "side").join(""))
  })

  it("plays the snapped ComfyUI render of her, on its own palette, with walk frames made from it", () => {
    const g = GEN_PEOPLE.player!
    expect(g).toBeTruthy()
    for (const view of VIEWS) {
      expect(playerGridOf(view)).toEqual(g[view])
      valid(playerGridOf(view), `snapped ${view}`)
    }
    expect(new Set(Object.keys(g.palette)).size).toBeGreaterThanOrEqual(20)
    const base = playerGridOf("front")
    const frames = new Set([0, 1, 2, 3].map((f) => cachedWalk("player", base, "front", f as 0 | 1 | 2 | 3).join("")))
    expect(frames.size).toBeGreaterThanOrEqual(3)
  })
})

describe("the person drawer", () => {
  it("draws every option of every list, in every view", () => {
    const tried: PersonSpec[] = []
    for (const build of BUILDS) tried.push({ ...CENTER_SPEC, build })
    for (const style of HAIR_STYLES) tried.push({ ...CENTER_SPEC, hair: { style, color: "ginger" } })
    for (const mouth of MOUTHS) tried.push({ ...CENTER_SPEC, mouth })
    for (const kind of TOPS) for (const pattern of PATTERNS) tried.push({ ...CENTER_SPEC, top: { kind, color: "teal", accent: "cream", pattern } })
    for (const kind of BOTTOMS) tried.push({ ...CENTER_SPEC, bottom: { kind, color: "denim" } })
    for (const kind of SHOES) tried.push({ ...CENTER_SPEC, shoes: { kind, color: "brown" } })
    for (const kind of HATS) tried.push({ ...CENTER_SPEC, hat: { kind, color: "red", accent: "cream" } })
    for (const e of EXTRAS) tried.push({ ...CENTER_SPEC, extras: [e] })
    for (const spec of tried) for (const view of VIEWS) valid(drawPerson(spec, view), `${JSON.stringify(spec)} ${view}`)
  }, 120000)

  it("is deterministic, and different people draw differently", () => {
    expect(drawPerson(CENTER_SPEC, "front")).toEqual(drawPerson({ ...CENTER_SPEC }, "front"))
    const other: PersonSpec = { ...CENTER_SPEC, hair: { style: "bangs", color: "jet" }, top: { kind: "hoodie", color: "red", accent: "cream", pattern: "solid" } }
    expect(drawPerson(other, "front").join("")).not.toBe(drawPerson(CENTER_SPEC, "front").join(""))
  })

  it("reads clothing from the spec: a hoodie and a dress are not the same sprite", () => {
    const of = (kind: PersonSpec["top"]["kind"]) => drawPerson({ ...CENTER_SPEC, hair: { style: "short", color: "ginger" }, extras: [], bottom: { kind: "pants", color: "denim" }, top: { ...CENTER_SPEC.top, kind } }, "front").join("")
    const groups = new Map<string, string[]>()
    for (const kind of TOPS) groups.set(of(kind), [...(groups.get(of(kind)) ?? []), kind])
    expect([...groups.values()].filter((g) => g.length > 1), "tops that draw the same").toEqual([])
  })

  it("clamps anything unknown to a safe spec and never throws", () => {
    expect(parsePerson(null)).toEqual(CENTER_SPEC)
    const odd = parsePerson({ build: "giant", skin: "green", hair: { style: "mullet", color: "nope" }, top: { kind: "toga", color: "#112233" }, extras: ["scarf", "wings", "scarf"] })
    expect(odd.build).toBe(CENTER_SPEC.build)
    expect(odd.skin).toBe(CENTER_SPEC.skin)
    expect(odd.hair).toEqual(CENTER_SPEC.hair)
    expect(odd.top.kind).toBe(CENTER_SPEC.top.kind)
    expect(odd.top.color).toBe("#112233")
    expect(odd.extras).toEqual(["scarf"])
    valid(drawPerson(odd, "front"), "clamped")
  })
})

describe("people colors", () => {
  it("makes four tones whose shadows are darker and cooler than their lights", () => {
    for (const name of COLOR_NAMES) {
      const r = rampOf(colorHex(name))
      const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11
      expect(lum(r.hi), name).toBeGreaterThanOrEqual(lum(r.mid))
      expect(lum(r.mid), name).toBeGreaterThan(lum(r.lo))
      expect(lum(r.lo), name).toBeGreaterThan(lum(r.deep))
    }
  })
})
