/**
 * lib/baby-animals.ts — Cute-name roster for the desktop CRT-nest companion
 *
 * Roster + cute-name shapes for the in-app **today’s friend** CRT nest.
 */

import { hashString } from "./string-utils"
import { persistKey } from "./storage-keys"

export type BabyAnimal = {
  id: string
  /** One-word species: Crow, Puppy, Seal */
  short: string
  /** Creature word, may be two words: "kitten", "seal pup", "fox kit" */
  young: string
  /** Wikipedia title for a photo fallback */
  wiki: string
  popular?: boolean
}

export const BABY_ANIMALS: readonly BabyAnimal[] = [
  { id: "crow", short: "crow", young: "crow", wiki: "Crow" },
  { id: "otter", short: "otter", young: "otter pup", wiki: "Otter" },
  { id: "hedgehog", short: "hedgehog", young: "hedgehog", wiki: "Hedgehog" },
  { id: "fox", short: "fox", young: "fox kit", wiki: "Red_fox" },
  { id: "owl", short: "owl", young: "owlet", wiki: "Owl" },
  { id: "seal", short: "seal", young: "seal pup", wiki: "Harbor_seal", popular: true },
  { id: "duckling", short: "duckling", young: "duckling", wiki: "Duck", popular: true },
  { id: "lamb", short: "lamb", young: "lamb", wiki: "Sheep", popular: true },
  { id: "fawn", short: "fawn", young: "fawn", wiki: "Deer" },
  { id: "chick", short: "chick", young: "chick", wiki: "Chicken", popular: true },
  { id: "puppy", short: "puppy", young: "puppy", wiki: "Puppy", popular: true },
  { id: "bunny", short: "bunny", young: "bunny", wiki: "Rabbit", popular: true },
  { id: "kitten", short: "kitten", young: "kitten", wiki: "Kitten", popular: true },
  { id: "piglet", short: "piglet", young: "piglet", wiki: "Pig" },
  { id: "penguin", short: "penguin", young: "penguin chick", wiki: "Penguin" },
  { id: "capybara", short: "capybara", young: "capybara", wiki: "Capybara" },
  { id: "raccoon", short: "raccoon", young: "raccoon kit", wiki: "Raccoon" },
  { id: "mouse", short: "mouse", young: "mouse", wiki: "Mouse" },
  { id: "goat", short: "goat", young: "goat kid", wiki: "Goat" },
  { id: "axolotl", short: "axolotl", young: "axolotl", wiki: "Axolotl" },
  { id: "cub", short: "cub", young: "bear cub", wiki: "Brown_bear" },
  { id: "foal", short: "foal", young: "foal", wiki: "Foal" },
  { id: "gosling", short: "gosling", young: "gosling", wiki: "Goose" },
  { id: "wolf", short: "wolf", young: "wolf pup", wiki: "Wolf" },
  { id: "skunk", short: "skunk", young: "skunk", wiki: "Skunk" },
]

export const NAME_SHAPES = [
  "baby-short",
  "little-baby-short",
  "cute-small-young",
  "tiny-baby-young",
  "baby-young",
  "itty-bitty-short",
  "sweet-little-young",
  "small-young",
  "little-young",
  "the-cutest-short",
] as const

export type NameShape = (typeof NAME_SHAPES)[number]

export type PickedBabyAnimal = {
  animal: BabyAnimal
  shape: NameShape
  displayName: string
  portraitSrc: string
}


export const COMPANION_STORAGE_KEY = persistKey("desktop-companion")

export type DesktopCompanion = {
  day: string
  salt: number
  id: string
  displayName: string
}

export function titleWords(value: string): string {
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function formatBabyAnimalName(animal: BabyAnimal, shape: NameShape): string {
  const short = titleWords(animal.short)
  const youngTitle = titleWords(animal.young)
  switch (shape) {
    case "baby-short":
      return `Baby ${short}`
    case "little-baby-short":
      return `Little Baby ${short}`
    case "cute-small-young":
      return `cute small ${animal.young}`
    case "tiny-baby-young":
      return `tiny baby ${animal.young}`
    case "baby-young":
      return `baby ${animal.young}`
    case "itty-bitty-short":
      return `Itty-Bitty ${short}`
    case "sweet-little-young":
      return `sweet little ${animal.young}`
    case "small-young":
      return `Small ${youngTitle}`
    case "little-young":
      return `Little ${animal.young}`
    case "the-cutest-short":
      return `The Cutest ${short}`
  }
}

export function babyAnimalPortraitSrc(id: string): string {
  return `/baby-animals/${id}.svg`
}

export function animalById(id: string): BabyAnimal | undefined {
  return BABY_ANIMALS.find((animal) => animal.id === id)
}

export function slugFriendId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug || "friend"
}

export function shuffleCompanion(exclude?: string | readonly string[], random = Math.random): PickedBabyAnimal {
  const blocked = new Set(
    (Array.isArray(exclude) ? exclude : exclude ? [exclude] : [])
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean),
  )
  const pool = BABY_ANIMALS.filter((animal) => !blocked.has(animal.id.toLowerCase()))
  const list = pool.length > 0 ? pool : BABY_ANIMALS
  const animal = list[Math.floor(random() * list.length)]!
  const shape = NAME_SHAPES[Math.floor(random() * NAME_SHAPES.length)]!
  return {
    animal,
    shape,
    displayName: formatBabyAnimalName(animal, shape),
    portraitSrc: babyAnimalPortraitSrc(animal.id),
  }
}

function mixedIndex(hash: number, shift: number, modulo: number): number {
  const n = (hash >>> shift) + (hash & 0xffff)
  return Math.abs(n) % modulo
}

export function pickBabyAnimalFromKey(key: string): PickedBabyAnimal {
  const hash = hashString(key)
  const animal = BABY_ANIMALS[mixedIndex(hash, 0, BABY_ANIMALS.length)]!
  const shape = NAME_SHAPES[mixedIndex(hash, 8, NAME_SHAPES.length)]!
  return {
    animal,
    shape,
    displayName: formatBabyAnimalName(animal, shape),
    portraitSrc: babyAnimalPortraitSrc(animal.id),
  }
}

export function localDayKey(at: Date): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, "0")
  const d = String(at.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Local Monday (week starts Monday) as YYYY-MM-DD. Auto-shuffle uses this, not every refresh. */
export function localMondayKey(at: Date = new Date()): string {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  const dow = day.getDay()
  const delta = dow === 0 ? -6 : 1 - dow
  day.setDate(day.getDate() + delta)
  return localDayKey(day)
}

export function pickCompanion(day: string, salt: number): PickedBabyAnimal {
  return pickBabyAnimalFromKey(`companion:${day}:${salt}`)
}

export function parseCompanion(raw: string | null, today: string): DesktopCompanion | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DesktopCompanion>
    if (
      typeof parsed.day !== "string" ||
      typeof parsed.salt !== "number" ||
      typeof parsed.id !== "string" ||
      typeof parsed.displayName !== "string"
    ) {
      return null
    }
    if (parsed.day !== today) return null
    if (!BABY_ANIMALS.some((animal) => animal.id === parsed.id)) return null
    return {
      day: parsed.day,
      salt: parsed.salt,
      id: parsed.id,
      displayName: parsed.displayName,
    }
  } catch {
    return null
  }
}

export function companionRecord(picked: PickedBabyAnimal, day: string, salt: number): DesktopCompanion {
  return {
    day,
    salt,
    id: picked.animal.id,
    displayName: picked.displayName,
  }
}
