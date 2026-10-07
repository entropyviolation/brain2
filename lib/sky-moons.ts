/** Mean circular moon orbits for the close-up. Not a planetary ephemeris. */

export type MoonSpec = {
  id: string
  name: string
  radiusKm: number
  /** Mean orbital radius, kilometres. */
  orbitKm: number
  periodDays: number
  /** Set when the moon travels against the planet’s spin sense. Period stays positive. */
  retrograde?: boolean
}

const DAY_MS = 86_400_000

const MOONS: Record<string, readonly MoonSpec[]> = {
  mercury: [],
  venus: [],
  earth: [{ id: "moon", name: "Moon", radiusKm: 1737.4, orbitKm: 384400, periodDays: 27.32 }],
  mars: [
    { id: "phobos", name: "Phobos", radiusKm: 11.1, orbitKm: 9376, periodDays: 0.319 },
    { id: "deimos", name: "Deimos", radiusKm: 6.2, orbitKm: 23458, periodDays: 1.263 },
  ],
  jupiter: [
    { id: "io", name: "Io", radiusKm: 1821.6, orbitKm: 421700, periodDays: 1.769 },
    { id: "europa", name: "Europa", radiusKm: 1560.8, orbitKm: 671100, periodDays: 3.551 },
    { id: "ganymede", name: "Ganymede", radiusKm: 2634.1, orbitKm: 1070400, periodDays: 7.155 },
    { id: "callisto", name: "Callisto", radiusKm: 2410.3, orbitKm: 1882700, periodDays: 16.689 },
  ],
  saturn: [
    { id: "mimas", name: "Mimas", radiusKm: 198.2, orbitKm: 185539, periodDays: 0.942 },
    { id: "enceladus", name: "Enceladus", radiusKm: 252.1, orbitKm: 238042, periodDays: 1.37 },
    { id: "tethys", name: "Tethys", radiusKm: 531.1, orbitKm: 294619, periodDays: 1.888 },
    { id: "dione", name: "Dione", radiusKm: 561.4, orbitKm: 377396, periodDays: 2.737 },
    { id: "rhea", name: "Rhea", radiusKm: 763.8, orbitKm: 527108, periodDays: 4.518 },
    { id: "titan", name: "Titan", radiusKm: 2574.7, orbitKm: 1221870, periodDays: 15.945 },
  ],
  uranus: [
    { id: "miranda", name: "Miranda", radiusKm: 235.8, orbitKm: 129390, periodDays: 1.413 },
    { id: "ariel", name: "Ariel", radiusKm: 578.9, orbitKm: 191020, periodDays: 2.52 },
    { id: "umbriel", name: "Umbriel", radiusKm: 584.7, orbitKm: 266300, periodDays: 4.144 },
    { id: "titania", name: "Titania", radiusKm: 788.9, orbitKm: 435910, periodDays: 8.706 },
    { id: "oberon", name: "Oberon", radiusKm: 761.4, orbitKm: 583520, periodDays: 13.463 },
  ],
  neptune: [
    {
      id: "triton",
      name: "Triton",
      radiusKm: 1353.4,
      orbitKm: 354759,
      periodDays: 5.877,
      retrograde: true,
    },
  ],
}

/** Major moons on mean circular orbits. Mercury and Venus return none. */
export function moonsOf(planetId: string): MoonSpec[] {
  return [...(MOONS[planetId] ?? [])]
}

/**
 * Mean anomaly in radians at a simulation instant.
 * Prograde increases. Retrograde decreases by the same amount.
 */
export function moonAngle(periodDays: number, simMs: number, retrograde?: boolean): number {
  if (!(periodDays > 0)) return 0
  const turns = simMs / (periodDays * DAY_MS)
  const signed = retrograde ? -turns : turns
  return signed * 2 * Math.PI
}

const FACTS: Record<string, { title: string; lines: string[] }> = {
  sun: {
    title: "Sun",
    lines: [
      "Name. The Romans called the Sun Sol. The Greeks called the god Helios.",
      "Name. Helios drove a chariot of fire from the eastern sea to the west.",
      "Seen. No one discovered it. Every ancient record of the sky already had the Sun.",
      "Science. It is a star, fusing hydrogen into helium, and that light warms the planets.",
    ],
  },
  mercury: {
    title: "Mercury",
    lines: [
      "Name. Mercury is the Roman messenger of the gods, named for his speed.",
      "Name. The Greeks called that god Hermes.",
      "Seen. Mesopotamian astronomers recorded it as the star of Nabu.",
      "Science. Almost no air remains, so day scorches and night freezes. No life is known.",
    ],
  },
  venus: {
    title: "Venus",
    lines: [
      "Name. Venus is the Roman goddess of love.",
      "Name. The Greeks knew her as Aphrodite.",
      "Seen. Babylonian astronomers recorded it as Ishtar’s star, morning and evening.",
      "Science. A runaway greenhouse of carbon dioxide makes the surface hotter than Mercury.",
    ],
  },
  earth: {
    title: "Earth",
    lines: [
      "Name. Earth is the old word for the ground.",
      "Name. Rome called the goddess Terra, and Greece called her Gaia.",
      "Seen. It was never discovered. People have always lived on it.",
      "Science. It is the only world known to hold life, with liquid water open to the sky.",
    ],
  },
  mars: {
    title: "Mars",
    lines: [
      "Name. Mars is the Roman god of war.",
      "Name. The Greeks called him Ares, and the red color was read as blood.",
      "Seen. Babylonian astronomers recorded the red wanderer as Nergal, god of war and plague.",
      "Science. Ancient rivers and lake beds show water once flowed. No life has been confirmed.",
    ],
  },
  jupiter: {
    title: "Jupiter",
    lines: [
      "Name. Jupiter is king of the Roman gods.",
      "Name. The Greeks called that king Zeus.",
      "Seen. Babylonian astronomers tracked it as the star of Marduk.",
      "Science. Europa hides an ocean under ice. That ocean is a candidate, and no life has been found.",
    ],
  },
  saturn: {
    title: "Saturn",
    lines: [
      "Name. Saturn is the Roman god of agriculture.",
      "Name. The Greeks identified him with Cronus, father of Zeus.",
      "Seen. Babylonian astronomers recorded it, the slowest planet a naked eye can follow.",
      "Science. Enceladus vents a hidden ocean. It is an ocean candidate, and no life has been found.",
    ],
  },
  uranus: {
    title: "Uranus",
    lines: [
      "Name. Uranus is the Latin name of Ouranos, the Greek god of the sky.",
      "Name. Johann Bode chose that name. Herschel had wanted Georgium Sidus.",
      "Seen. William Herschel discovered it in 1781. Earlier charts had marked it as a star.",
      "Science. It is an ice giant tipped nearly on its side. No life is known there.",
    ],
  },
  neptune: {
    title: "Neptune",
    lines: [
      "Name. Neptune is the Roman god of the sea.",
      "Name. The Greeks called him Poseidon.",
      "Seen. Johann Galle saw it in 1846 from Urbain Le Verrier’s prediction.",
      "Seen. John Couch Adams had predicted a planet there on his own.",
      "Science. It is an ice giant of water, ammonia, and methane. No life is known there.",
    ],
  },
  moon: {
    title: "Moon",
    lines: [
      "Name. The Romans called her Luna, and the Greeks called her Selene.",
      "Name. The English Moon is that same light, and the word is kin to month.",
      "Seen. The Moon has always been known. No one had to discover it.",
      "Science. One face stays toward Earth. Ice sits in craters that never see the Sun.",
    ],
  },
}

/** Short Name, Seen, and Science lines for the close-up card, including the Moon. */
export function planetFacts(planetId: string): { title: string; lines: string[] } {
  const facts = FACTS[planetId]
  if (!facts) return { title: planetId, lines: [] }
  return { title: facts.title, lines: [...facts.lines] }
}
