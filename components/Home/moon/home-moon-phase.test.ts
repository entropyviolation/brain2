import { describe, expect, it } from "vitest"
import {
  MOON_PHASE_DISK,
  MOON_PHASE_MARKS,
  moonPhaseLight,
  moonPointDay,
  placeMoonMarks,
  selenographicPoint,
} from "./home-moon-phase"

function illumination(cycle: number): number {
  return (1 - Math.cos(cycle * 2 * Math.PI)) / 2
}

function litFraction(cycle: number): number {
  let lit = 0
  let n = 0
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const nx = ((x + 0.5) / 64) * 2 - 1
      const ny = 1 - ((y + 0.5) / 64) * 2
      if (nx * nx + ny * ny > 1) continue
      const nz = Math.sqrt(1 - nx * nx - ny * ny)
      n++
      if (moonPointDay(cycle, nx, nz) >= 0.5) lit++
    }
  }
  return lit / n
}

describe("photographic moon phase", () => {
  it("lights the right while waxing, matching the sprite cycle", () => {
    expect(moonPhaseLight(0).z).toBeLessThan(-0.9)
    expect(moonPhaseLight(0.25).x).toBeGreaterThan(0.9)
    expect(moonPhaseLight(0.5).z).toBeGreaterThan(0.9)
    expect(moonPhaseLight(0.75).x).toBeLessThan(-0.9)

    const east = selenographicPoint(0, 40)
    const west = selenographicPoint(0, -40)
    expect(moonPointDay(0.25, east.x, east.z)).toBeGreaterThan(0.85)
    expect(moonPointDay(0.25, west.x, west.z)).toBeLessThan(0.15)
    expect(moonPointDay(0.75, west.x, west.z)).toBeGreaterThan(0.85)
    expect(moonPointDay(0.75, east.x, east.z)).toBeLessThan(0.15)
  })

  it("matches the glance illumination across the disk", () => {
    for (const cycle of [0, 0.12, 0.25, 0.4, 0.5, 0.63, 0.75, 0.9]) {
      expect(litFraction(cycle)).toBeCloseTo(illumination(cycle), 1)
    }
  })

  it("places the named near-side marks and hides the far side", () => {
    expect(MOON_PHASE_MARKS.map((mark) => [mark.name, mark.lat, mark.lon])).toEqual([
      ["Aristarchus Plateau", 23.7, -47.4],
      ["Kepler Crater", 8.1, -38],
      ["Copernicus Crater", 9.62, -20.08],
      ["Tycho Crater", -43.31, -11.36],
    ])
    expect(selenographicPoint(0, 120).onDisk).toBe(false)
    expect(selenographicPoint(23.7, -47.4).onDisk).toBe(true)

    const marks = placeMoonMarks(MOON_PHASE_DISK)
    expect(marks.every((mark) => mark.onDisk)).toBe(true)

    const aristarchus = marks[0]!
    const kepler = marks[1]!
    const copernicus = marks[2]!
    const tycho = marks[3]!
    expect(aristarchus.left).toBeLessThan(kepler.left)
    expect(kepler.left).toBeLessThan(copernicus.left)
    expect(aristarchus.top).toBeLessThan(kepler.top)
    expect(tycho.top).toBeGreaterThan(70)
    expect(aristarchus.left).toBeLessThan(50)
  })

  it("keeps labels off one another and off the other markers", () => {
    const marks = placeMoonMarks(MOON_PHASE_DISK).filter((mark) => mark.onDisk)
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i]!.box
        const b = marks[j]!.box
        const hit = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        expect(hit, `${marks[i]!.name} / ${marks[j]!.name}`).toBe(false)
      }
    }
  })
})
