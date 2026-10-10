/**
 * lib/sky-scale.ts — Powers of ten on the Moon chart
 *
 * One stop for each decade of metres from 10^-16 (a proton) through 10^26
 * (the observable universe). The Florida State optical-microscopy primer
 * is a factual checklist for that reach: protons and electrons, DNA, a
 * cell, then orders of magnitude out to a galaxy seen from about ten
 * million light years. Captions are original. Moon and Earth are photographs.
 *
 * Inspiration only: Powers of Ten (Charles and Ray Eames, 1977), that
 * primer, and Scale of the Universe.
 *
 * Ocean Beach, San Diego (32.75°N, 117.25°W) is the 10^0 and 10^1 place.
 * The gull stays there. A house mouse is the 10^-1 m stop.
 *
 * Decades the heliocentric chart can hold (Earth–Moon through the Milky
 * Way) ease with `approachZoom`. Smaller and larger decades are a
 * full-frame card. Moon and Earth use the photographs in `public/planets`.
 * A person, a western gull, and the city are original drawings: the repo
 * has no photograph of them. The other cards are schematics. The flight
 * across a decade is one CSS scale, from 1 to 0.1, so a photograph hands
 * off to the next photograph without a cut. The 10^21 m stop is the Milky
 * Way, and the chart mounts `GalaxySchematic` for it. The 10^26 m card is
 * a labeled circle and one speck, and it says it is a schematic.
 *
 * Session only. Nothing here writes `brain2-sky-motion` or changes the
 * saved time rate or the view width. Opening the tour does not pause the
 * chart clock.
 */

import { GALAXY_DIAMETER_LY, SUN_GALACTIC_RADIUS_LY } from "./sky-galaxy"
import { AU_KM } from "./sky-observe"
import { approachZoom, zoomFactor } from "./sky-zoom"
import { BODY_RADIUS_KM, MOON_DISTANCE_KM, MOON_RADIUS_KM, SUN_RADIUS_KM } from "./solar-system"

/** Julian-year light travel, metres. Same c and year as `sky-zoom.ts`. */
const LIGHT_YEAR_M = 299792.458 * 86400 * 365.25 * 1000

const AU_M = AU_KM * 1000

/** How long one decade stays on screen at the default pace. */
export const SCALE_DECADE_MS = 4000

/**
 * Transport for the open tour. Session only, and not the chart clock.
 * Slower and Faster change this pace. Previous and Next step one decade.
 */
export const SCALE_CONTROLS = ["Pause", "Play", "Slower", "Faster", "Previous", "Next"] as const

export const SCALE_STOPS = [
  "proton",
  "carbon",
  "uranium",
  "inner-electron",
  "electron",
  "hydrogen",
  "water",
  "dna",
  "virus",
  "bacterium",
  "cell",
  "hair",
  "sand",
  "ant",
  "dollar",
  "mouse",
  "person",
  "seagull",
  "park",
  "downtown",
  "city",
  "south-coast",
  "moon",
  "earth",
  "earth-moon",
  "sun",
  "mercury",
  "earth-orbit",
  "neptune",
  "heliopause",
  "oort-inner",
  "oort-outer",
  "proxima",
  "vega",
  "pleiades",
  "orion",
  "galactic-center",
  "galaxy",
  "andromeda",
  "local-group",
  "coma",
  "sloan",
  "universe",
] as const

export type ScaleStop = (typeof SCALE_STOPS)[number]

/** Whole tour at the default pace: one dwell per decade. */
export const SCALE_TOUR_MS = SCALE_STOPS.length * SCALE_DECADE_MS

export type ScaleGlyph =
  | "proton"
  | "nucleus"
  | "nucleus-dense"
  | "shell"
  | "electron"
  | "atom"
  | "molecule"
  | "helix"
  | "virus"
  | "bacterium"
  | "cell"
  | "hair"
  | "sand"
  | "ant"
  | "dollar"
  | "mouse"
  | "person"
  | "gull"
  | "park"
  | "blocks"
  | "skyline"
  | "span"
  | "moon"
  | "earth"
  | "andromeda"
  | "group"
  | "cluster"
  | "wall"

/** Ocean Beach, San Diego. The 10^0 and 10^1 place, not a chart of the shore. */
export const OCEAN_BEACH = { latDeg: 32.75, lonDeg: -117.25 } as const

type ScaleRow = {
  exponent: number
  metres: number
  name: string
  caption: string
  glyph: ScaleGlyph | null
}

const MOON_DIAMETER_KM = Math.round(MOON_RADIUS_KM * 2)
const EARTH_DIAMETER_KM = BODY_RADIUS_KM.earth * 2
const SUN_DIAMETER_KM = SUN_RADIUS_KM * 2

const ROWS: { [K in ScaleStop]: ScaleRow } = {
  proton: {
    exponent: -16,
    metres: 8.4e-16,
    name: "Proton",
    caption: "A proton has a charge radius of about 0.84 fm.",
    glyph: "proton",
  },
  carbon: {
    exponent: -15,
    metres: 5.4e-15,
    name: "Carbon nucleus",
    caption: "A carbon nucleus is about 5.4 fm across.",
    glyph: "nucleus",
  },
  uranium: {
    exponent: -14,
    metres: 1.5e-14,
    name: "Uranium nucleus",
    caption: "A uranium nucleus is about 15 fm across.",
    glyph: "nucleus-dense",
  },
  "inner-electron": {
    exponent: -13,
    metres: 5.75e-13,
    name: "Uranium inner electron",
    caption: "In the Bohr model, uranium's innermost electron sits about 0.6 pm from the nucleus.",
    glyph: "shell",
  },
  electron: {
    exponent: -12,
    metres: 2.43e-12,
    name: "Electron",
    caption: "An electron has no hard edge; its Compton wavelength is 2.43 pm.",
    glyph: "electron",
  },
  hydrogen: {
    exponent: -11,
    metres: 5.29e-11,
    name: "Hydrogen atom",
    caption: "A hydrogen atom's Bohr radius is 53 pm.",
    glyph: "atom",
  },
  water: {
    exponent: -10,
    metres: 2.8e-10,
    name: "Water molecule",
    caption: "A water molecule is about 0.28 nm across.",
    glyph: "molecule",
  },
  dna: {
    exponent: -9,
    metres: 2e-9,
    name: "DNA",
    caption: "A DNA double helix is about 2 nm across.",
    glyph: "helix",
  },
  virus: {
    exponent: -8,
    metres: 3e-8,
    name: "Cold virus",
    caption: "A cold virus is about 30 nm across.",
    glyph: "virus",
  },
  bacterium: {
    exponent: -7,
    metres: 3e-7,
    name: "Mycoplasma",
    caption: "Mycoplasma, among the smallest bacteria, is about 0.3 μm across.",
    glyph: "bacterium",
  },
  cell: {
    exponent: -6,
    metres: 7.5e-6,
    name: "Red blood cell",
    caption: "A human red blood cell is about 7.5 μm across.",
    glyph: "cell",
  },
  hair: {
    exponent: -5,
    metres: 8e-5,
    name: "Human hair",
    caption: "A human hair is about 80 μm thick.",
    glyph: "hair",
  },
  sand: {
    exponent: -4,
    metres: 2e-4,
    name: "Grain of sand",
    caption: "A grain of fine sand is about 0.2 mm across.",
    glyph: "sand",
  },
  ant: {
    exponent: -3,
    metres: 4e-3,
    name: "Pavement ant",
    caption: "A pavement ant is about 4 mm long.",
    glyph: "ant",
  },
  dollar: {
    exponent: -2,
    metres: 0.08,
    name: "Sand dollar",
    caption: "A sand dollar on a San Diego beach is about 8 cm across.",
    glyph: "dollar",
  },
  mouse: {
    exponent: -1,
    metres: 0.18,
    name: "House mouse",
    caption: "A house mouse is about 18 cm from nose to tail tip.",
    glyph: "mouse",
  },
  person: {
    exponent: 0,
    metres: 1.7,
    name: "A person",
    caption: "A person about 1.7 m tall stands at Ocean Beach, San Diego (32.75°N, 117.25°W).",
    glyph: "person",
  },
  seagull: {
    exponent: 1,
    metres: 1.4,
    name: "Western gull, Ocean Beach",
    caption:
      "A western gull at Ocean Beach, San Diego (32.75°N, 117.25°W) spans about 1.4 m across this ten-metre place, a scale marker, not a map of the beach.",
    glyph: "gull",
  },
  park: {
    exponent: 2,
    metres: 120,
    name: "A park",
    caption: "A neighborhood park is about 120 m across.",
    glyph: "park",
  },
  downtown: {
    exponent: 3,
    metres: 9100,
    name: "Ocean Beach to downtown",
    caption: "Ocean Beach to downtown San Diego is about 9 km.",
    glyph: "blocks",
  },
  city: {
    exponent: 4,
    metres: 50_000,
    name: "San Diego",
    caption: "The city of San Diego is about 50 km across.",
    glyph: "skyline",
  },
  "south-coast": {
    exponent: 5,
    metres: 180_000,
    name: "San Diego to Los Angeles",
    caption: "San Diego to Los Angeles is about 180 km.",
    glyph: "span",
  },
  moon: {
    exponent: 6,
    metres: MOON_RADIUS_KM * 2 * 1000,
    name: "The Moon",
    caption: `The Moon is ${MOON_DIAMETER_KM.toLocaleString("en-US")} km across.`,
    glyph: "moon",
  },
  earth: {
    exponent: 7,
    metres: EARTH_DIAMETER_KM * 1000,
    name: "Earth",
    caption: `Earth is ${EARTH_DIAMETER_KM.toLocaleString("en-US")} km across.`,
    glyph: "earth",
  },
  "earth-moon": {
    exponent: 8,
    metres: MOON_DISTANCE_KM * 1000,
    name: "Earth and Moon",
    caption: `The gap from Earth to the Moon is ${MOON_DISTANCE_KM.toLocaleString("en-US")} km.`,
    glyph: null,
  },
  sun: {
    exponent: 9,
    metres: SUN_DIAMETER_KM * 1000,
    name: "The Sun",
    caption: `The Sun is ${SUN_DIAMETER_KM.toLocaleString("en-US")} km across.`,
    glyph: null,
  },
  mercury: {
    exponent: 10,
    metres: 0.387 * AU_M,
    name: "Mercury's orbit",
    caption: "Mercury's orbit lies about 0.39 AU from the Sun.",
    glyph: null,
  },
  "earth-orbit": {
    exponent: 11,
    metres: AU_M,
    name: "Earth's orbit",
    caption: "Earth's orbit is 1 AU from the Sun.",
    glyph: null,
  },
  neptune: {
    exponent: 12,
    metres: 30 * AU_M,
    name: "Neptune's orbit",
    caption: "Neptune's orbit, the planetary edge of the solar system, lies about 30 AU from the Sun.",
    glyph: null,
  },
  heliopause: {
    exponent: 13,
    metres: 120 * AU_M,
    name: "Heliopause",
    caption: "The heliopause, where the solar wind yields to interstellar space, sits about 120 AU out.",
    glyph: null,
  },
  "oort-inner": {
    exponent: 14,
    metres: 2000 * AU_M,
    name: "Inner Oort cloud",
    caption: "The inner Oort cloud begins near 2,000 AU.",
    glyph: null,
  },
  "oort-outer": {
    exponent: 15,
    metres: 50_000 * AU_M,
    name: "Outer Oort cloud",
    caption: "The outer Oort cloud reaches about 50,000 AU.",
    glyph: null,
  },
  proxima: {
    exponent: 16,
    metres: 4.24 * LIGHT_YEAR_M,
    name: "Proxima Centauri",
    caption: "Proxima Centauri, the nearest star, is 4.24 light years away.",
    glyph: null,
  },
  vega: {
    exponent: 17,
    metres: 25 * LIGHT_YEAR_M,
    name: "Vega",
    caption: "Vega is about 25 light years away.",
    glyph: null,
  },
  pleiades: {
    exponent: 18,
    metres: 440 * LIGHT_YEAR_M,
    name: "The Pleiades",
    caption: "The Pleiades lie about 440 light years away.",
    glyph: null,
  },
  orion: {
    exponent: 19,
    metres: 3500 * LIGHT_YEAR_M,
    name: "Orion spur",
    caption: "The Orion spur is about 3,500 light years across.",
    glyph: null,
  },
  "galactic-center": {
    exponent: 20,
    metres: SUN_GALACTIC_RADIUS_LY * LIGHT_YEAR_M,
    name: "Galactic center",
    caption: `The Sun sits about ${SUN_GALACTIC_RADIUS_LY.toLocaleString("en-US")} light years from the galactic center.`,
    glyph: null,
  },
  galaxy: {
    exponent: 21,
    metres: GALAXY_DIAMETER_LY * LIGHT_YEAR_M,
    name: "Milky Way",
    caption: `The Milky Way is about ${GALAXY_DIAMETER_LY.toLocaleString("en-US")} light years across, a schematic rather than a star catalog.`,
    glyph: null,
  },
  andromeda: {
    exponent: 22,
    metres: 2.5e6 * LIGHT_YEAR_M,
    name: "Andromeda",
    caption: "Andromeda lies about 2.5 million light years from the Milky Way.",
    glyph: "andromeda",
  },
  "local-group": {
    exponent: 23,
    metres: 1e7 * LIGHT_YEAR_M,
    name: "Local Group",
    caption: "The Local Group of galaxies is about 10 million light years across.",
    glyph: "group",
  },
  coma: {
    exponent: 24,
    metres: 3.2e8 * LIGHT_YEAR_M,
    name: "Coma cluster",
    caption: "The Coma cluster of galaxies lies about 320 million light years away.",
    glyph: "cluster",
  },
  sloan: {
    exponent: 25,
    metres: 1.4e9 * LIGHT_YEAR_M,
    name: "Sloan Great Wall",
    caption: "The Sloan Great Wall stretches about 1.4 billion light years.",
    glyph: "wall",
  },
  universe: {
    exponent: 26,
    metres: 46.5e9 * LIGHT_YEAR_M,
    name: "Observable universe",
    caption: "The observable universe, a schematic, has a radius of about 46 billion light years.",
    glyph: null,
  },
}

function row(stop: ScaleStop): ScaleRow {
  return ROWS[stop]
}

/** Decade label, the power of ten in metres. */
export function scaleExponent(stop: ScaleStop): number {
  return row(stop).exponent
}

/** Real size of this stop's object, in metres. */
export function scaleMetres(stop: ScaleStop): number {
  return row(stop).metres
}

export function scaleStopName(stop: ScaleStop): string {
  return row(stop).name
}

/** One sentence. The galaxy line is a schematic, not a catalog. */
export function tourCaption(stop: ScaleStop): string {
  return row(stop).caption
}

/**
 * Silhouette for a full-frame card. Chart decades return null: the glass
 * already draws that body, or the Milky Way step mounts `GalaxySchematic`.
 */
export function scaleGlyph(stop: ScaleStop): ScaleGlyph | null {
  return row(stop).glyph
}

export type ScaleImageKey = "moon" | "earth" | "person" | "gull" | "city"

const SCALE_IMAGE: Partial<Record<ScaleStop, ScaleImageKey>> = {
  person: "person",
  seagull: "gull",
  city: "city",
  moon: "moon",
  earth: "earth",
}

/**
 * Picture for a full-frame card. Moon and Earth are photographs.
 * Person, gull, and city are original drawings. Null is a schematic.
 */
export function scaleImageKey(stop: ScaleStop): ScaleImageKey | null {
  return SCALE_IMAGE[stop] ?? null
}

export type ScalePictureKind = "photo" | "scene" | "schematic"

/** Photo, original drawing, or schematic. Galaxy and the 10^26 m card are schematics. */
export function scalePictureKind(stop: ScaleStop): ScalePictureKind {
  if (stop === "moon" || stop === "earth") return "photo"
  if (stop === "person" || stop === "seagull" || stop === "city") return "scene"
  return "schematic"
}

/** Maps already in the repo. The card prefers a projected globe when one is painted. */
export const SCALE_PHOTO_SRC = {
  moon: "/planets/moon.jpg",
  earth: "/planets/earth.jpg",
} as const

/**
 * Width of the card at the start of this decade, in metres.
 * `scaleFlightZoom` then pulls that frame back by ten.
 */
export function scaleFrameMetres(stop: ScaleStop): number {
  return 10 ** scaleExponent(stop)
}

/** CSS scale for the one flight element. 1 at the open of the decade, 0.1 at the handoff. */
export function scaleFlightZoom(blend: number): number {
  return 10 ** -clamp01(blend)
}

/**
 * Where `mark` sits while `focus` is the decade on screen, in metres.
 * The gull stands a few metres from the person. The Moon and Earth share
 * a center so the disks compare. Any other earlier object sits just beside
 * the one in focus.
 */
export function scaleMarkAnchor(mark: ScaleStop, focus: ScaleStop): { x: number; y: number } {
  const beach = focus === "person" || focus === "seagull"
  if (beach && mark === "person") return { x: 0, y: 0 }
  if (beach && mark === "seagull") return { x: 2.6, y: -0.15 }
  const worlds = focus === "moon" || focus === "earth"
  if (worlds && (mark === "moon" || mark === "earth")) return { x: 0, y: 0 }
  if (mark === focus) return { x: 0, y: 0 }
  return { x: -(scaleMetres(focus) + scaleMetres(mark)) * 0.56, y: 0 }
}

/**
 * Objects on this full-frame card, largest first.
 * The beach pair and the Moon–Earth pair stay in both decades, so the
 * zoom across that boundary is the same picture.
 */
export function scaleFrameCast(stop: ScaleStop): ScaleStop[] {
  if (stop === "universe") return []
  const i = SCALE_STOPS.indexOf(stop)
  const want = new Set<ScaleStop>([stop])
  const prev = i > 0 ? SCALE_STOPS[i - 1] : null
  if (prev && scaleCaptionFrame(prev)) want.add(prev)
  if (stop === "person" || stop === "seagull") {
    want.add("person")
    want.add("seagull")
  }
  if (stop === "moon" || stop === "earth") {
    want.add("moon")
    want.add("earth")
  }
  const view = scaleFrameMetres(stop)
  const cast = [...want].filter((item) => {
    if (!scaleCaptionFrame(item)) return false
    if (item === stop) return true
    const visual = scaleMetres(item) / view
    return visual >= 0.012 && visual <= 20
  })
  cast.sort((a, b) => scaleMetres(b) - scaleMetres(a))
  return cast
}

/**
 * Chart magnifier for this decade.
 *
 * Knots reuse `zoomFactor`: Earth–Moon, Earth's orbit, the solar system
 * (Neptune, factor 1), Proxima, and the Milky Way. Decades below the
 * Earth–Moon knot sit above the Moon factor. Decades past the Milky Way
 * sit below the galaxy factor. The chart clamps both; the card shows them.
 */
export function scaleZoomFactor(stop: ScaleStop): number {
  return factorAtExponent(scaleExponent(stop))
}

const KNOTS: readonly { exponent: number; factor: number }[] = [
  { exponent: 8, factor: zoomFactor("moon") },
  { exponent: 11, factor: zoomFactor("earth") },
  { exponent: 12, factor: zoomFactor("system") },
  { exponent: 16, factor: zoomFactor("stars") },
  { exponent: 21, factor: zoomFactor("galaxy") },
]

function factorAtExponent(exponent: number): number {
  const first = KNOTS[0]
  const last = KNOTS[KNOTS.length - 1]
  if (exponent <= first.exponent) return first.factor * 10 ** (first.exponent - exponent)
  if (exponent >= last.exponent) return last.factor / 10 ** (exponent - last.exponent)
  let hi = 1
  while (KNOTS[hi].exponent < exponent) hi += 1
  const lo = KNOTS[hi - 1]
  const t = (exponent - lo.exponent) / (KNOTS[hi].exponent - lo.exponent)
  if (t <= 0) return lo.factor
  if (t >= 1) return KNOTS[hi].factor
  return Math.exp(Math.log(lo.factor) + (Math.log(KNOTS[hi].factor) - Math.log(lo.factor)) * t)
}

/** True when this decade's factor lies inside the chart clamp, Moon through galaxy. */
export function scaleOnChart(stop: ScaleStop): boolean {
  const factor = scaleZoomFactor(stop)
  return factor <= zoomFactor("moon") && factor >= zoomFactor("galaxy")
}

/** Full-frame card. The chart would clamp, and the object would not read. */
export function scaleCaptionFrame(stop: ScaleStop): boolean {
  return !scaleOnChart(stop)
}

function clamp01(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0
  if (t >= 1) return 1
  return t
}

/**
 * Where `t` sits on the ladder. 0 is the proton, 1 is the observable
 * universe. Each decade owns an equal share, including a dwell on the last.
 */
export function tourPlace(t: number): { index: number; blend: number; stop: ScaleStop } {
  const n = SCALE_STOPS.length
  if (!Number.isFinite(t) || t <= 0) return { index: 0, blend: 0, stop: SCALE_STOPS[0] }
  if (t >= 1) return { index: n - 1, blend: 0, stop: SCALE_STOPS[n - 1] }
  const p = clamp01(t) * n
  const index = Math.min(n - 1, Math.floor(p + 1e-9))
  const blend = index === n - 1 ? 0 : Math.min(1, Math.max(0, p - index))
  return { index, blend, stop: SCALE_STOPS[index] }
}

/**
 * Factor the chart should hold along the tour.
 * Outside the clamp this is the near end (Moon or galaxy), so the glass
 * does not go blank. Inside the clamp this is `approachZoom` from the
 * current decade toward the next.
 */
export function tourChartFactor(t: number): number {
  const { index, blend, stop } = tourPlace(t)
  const moon = zoomFactor("moon")
  const galaxy = zoomFactor("galaxy")
  const clampF = (factor: number) => Math.min(moon, Math.max(galaxy, factor))
  const next = SCALE_STOPS[Math.min(index + 1, SCALE_STOPS.length - 1)]
  return approachZoom(clampF(scaleZoomFactor(stop)), clampF(scaleZoomFactor(next)), blend)
}
