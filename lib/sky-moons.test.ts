import { describe, expect, it } from "vitest"
import { moonAngle, moonsOf, planetFacts } from "./sky-moons"

const DAY_MS = 86_400_000

describe("moonsOf", () => {
  it("gives Venus and Mercury no moons", () => {
    expect(moonsOf("venus")).toEqual([])
    expect(moonsOf("mercury")).toEqual([])
  })

  it("gives Jupiter the four Galilean moons", () => {
    const moons = moonsOf("jupiter")
    expect(moons).toHaveLength(4)
    expect(moons.map((moon) => moon.name)).toEqual(["Io", "Europa", "Ganymede", "Callisto"])
  })

  it("places Earth’s Moon on a 384,400 km mean orbit", () => {
    const [moon] = moonsOf("earth")
    expect(moon).toMatchObject({
      id: "moon",
      name: "Moon",
      radiusKm: 1737.4,
      orbitKm: 384400,
      periodDays: 27.32,
    })
  })

  it("lists the major moons and keeps Triton’s period positive", () => {
    expect(moonsOf("mars").map((moon) => moon.id)).toEqual(["phobos", "deimos"])
    expect(moonsOf("saturn").map((moon) => moon.id)).toEqual([
      "mimas",
      "enceladus",
      "tethys",
      "dione",
      "rhea",
      "titan",
    ])
    expect(moonsOf("uranus").map((moon) => moon.id)).toEqual([
      "miranda",
      "ariel",
      "umbriel",
      "titania",
      "oberon",
    ])
    const [triton] = moonsOf("neptune")
    expect(triton.periodDays).toBeGreaterThan(0)
    expect(triton.retrograde).toBe(true)
  })
})

describe("moonAngle", () => {
  it("advances with time and reverses when retrograde", () => {
    const period = 27.32
    const later = 3 * DAY_MS
    const forward = moonAngle(period, later)
    const backward = moonAngle(period, later, true)
    expect(forward).toBeGreaterThan(moonAngle(period, 0))
    expect(forward).toBeCloseTo((2 * Math.PI * 3) / period, 8)
    expect(backward).toBeLessThan(moonAngle(period, 0, true))
    expect(backward).toBeCloseTo(-forward, 8)
  })
})

const FACT_IDS = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "moon"]

describe("planetFacts", () => {
  it("gives each body short Name, Seen, and Science lines", () => {
    for (const id of FACT_IDS) {
      const facts = planetFacts(id)
      expect(facts.title.length).toBeGreaterThan(0)
      const text = facts.lines.join("\n")
      expect(text).toMatch(/^Name\./m)
      expect(text).toMatch(/^Seen\./m)
      expect(text).toMatch(/^Science\./m)
      expect(facts.lines.length).toBeGreaterThanOrEqual(3)
      for (const line of facts.lines) {
        expect(line.length).toBeLessThanOrEqual(140)
        expect(line.startsWith("Name.") || line.startsWith("Seen.") || line.startsWith("Science.")).toBe(true)
      }
    }
    expect(planetFacts("pluto")).toEqual({ title: "pluto", lines: [] })
  })

  it("keeps discovery and habitability honest", () => {
    const mars = planetFacts("mars").lines.join(" ")
    expect(mars).toContain("water")
    expect(mars).toContain("No life has been confirmed")

    expect(planetFacts("venus").lines.join(" ")).toContain("runaway greenhouse")

    const jupiter = planetFacts("jupiter").lines.join(" ")
    expect(jupiter).toContain("Europa")
    expect(jupiter).toContain("ocean")
    expect(jupiter).toContain("no life has been found")

    const saturn = planetFacts("saturn").lines.join(" ")
    expect(saturn).toContain("Enceladus")
    expect(saturn).toContain("ocean")
    expect(saturn).toContain("no life has been found")

    const uranus = planetFacts("uranus").lines.join(" ")
    expect(uranus).toContain("Herschel")
    expect(uranus).toContain("1781")

    const neptune = planetFacts("neptune").lines.join(" ")
    expect(neptune).toContain("Galle")
    expect(neptune).toContain("1846")
    expect(neptune).toContain("Le Verrier")
    expect(neptune).toContain("Adams")

    expect(planetFacts("moon").lines.join(" ")).toContain("always been known")
  })
})
