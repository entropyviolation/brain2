/**
 * components/ui/clock-picker/clock-dials.ts — Dial paintings
 *
 * The list is `backgrounds/manifest.json` (`id`, `file`, `label`). Ceramic is
 * the rim (`../ceramic-face.png`) and the default. The other files are
 * transparent center paintings. Hide and restore are per browser; the PNGs
 * stay on disk.
 */
import manifest from "./backgrounds/manifest.json"
import ceramicFace from "./ceramic-face.png"
import cherubTwins from "./backgrounds/cherub-twins.png"
import latticeRabbit from "./backgrounds/lattice-rabbit.png"
import loveTripKitty from "./backgrounds/love-trip-kitty.png"
import motherOfPearl from "./backgrounds/mother-of-pearl.png"
import opalescentBirds from "./backgrounds/opalescent-birds.png"
import pearlBlossom from "./backgrounds/pearl-blossom.png"
import pearlFlower from "./backgrounds/pearl-flower.png"
import pearlStarButton from "./backgrounds/pearl-star-button.png"
import rabbitPortrait from "./backgrounds/rabbit-portrait.png"
import silverBat from "./backgrounds/silver-bat.png"
import silverFloralLocket from "./backgrounds/silver-floral-locket.png"
import silverSphere from "./backgrounds/silver-sphere.png"
import silverSpiral from "./backgrounds/silver-spiral.png"
import tealPearl from "./backgrounds/teal-pearl.png"
import umbrellaCats from "./backgrounds/umbrella-cats.png"
import wingedCherub from "./backgrounds/winged-cherub.png"
import wingedKitten from "./backgrounds/winged-kitten.png"

export const DEFAULT_DIAL_ID = "ceramic"
/** Selected dial id for this browser. */
export const CLOCK_DIAL_STORAGE_KEY = "brain2.clock-dial"
/** JSON array of painting ids hidden for this browser. Ceramic is never stored. */
export const CLOCK_DIAL_HIDDEN_KEY = "brain2.clock-dial-hidden"

type Picture = { src: string } | string

type ManifestEntry = { id: string; file: string; label: string }

export type ClockDial = {
  id: string
  label: string
  src: string
  /** The ceramic rim is the whole face. A painting sits in its center. */
  placement: "face" | "center"
}

/** Manifest `file` → bundled asset. Keys match `backgrounds/manifest.json`. */
const SOURCES: Record<string, Picture> = {
  "../ceramic-face.png": ceramicFace,
  "cherub-twins.png": cherubTwins,
  "lattice-rabbit.png": latticeRabbit,
  "love-trip-kitty.png": loveTripKitty,
  "mother-of-pearl.png": motherOfPearl,
  "opalescent-birds.png": opalescentBirds,
  "pearl-blossom.png": pearlBlossom,
  "pearl-flower.png": pearlFlower,
  "pearl-star-button.png": pearlStarButton,
  "rabbit-portrait.png": rabbitPortrait,
  "silver-bat.png": silverBat,
  "silver-floral-locket.png": silverFloralLocket,
  "silver-sphere.png": silverSphere,
  "silver-spiral.png": silverSpiral,
  "teal-pearl.png": tealPearl,
  "umbrella-cats.png": umbrellaCats,
  "winged-cherub.png": wingedCherub,
  "winged-kitten.png": wingedKitten,
}

function assetSrc(asset: Picture): string {
  return typeof asset === "string" ? asset : asset.src
}

export function clockDials(): ClockDial[] {
  const entries = manifest as ManifestEntry[]
  const dials: ClockDial[] = []
  for (const entry of entries) {
    const asset = SOURCES[entry.file]
    if (!asset || !entry.id) continue
    dials.push({
      id: entry.id,
      label: entry.label,
      src: assetSrc(asset),
      placement: entry.id === DEFAULT_DIAL_ID ? "face" : "center",
    })
  }
  if (!dials.some((dial) => dial.id === DEFAULT_DIAL_ID)) {
    dials.unshift({
      id: DEFAULT_DIAL_ID,
      label: "Ceramic",
      src: assetSrc(ceramicFace),
      placement: "face",
    })
  }
  return dials
}

export function visibleDials(dials: readonly ClockDial[], hidden: readonly string[]): ClockDial[] {
  const hiddenSet = new Set(hidden)
  const visible = dials.filter((dial) => dial.id === DEFAULT_DIAL_ID || !hiddenSet.has(dial.id))
  if (visible.length > 0) return visible
  return dials.filter((dial) => dial.id === DEFAULT_DIAL_ID)
}

export function readHiddenDialIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CLOCK_DIAL_HIDDEN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string" && id !== DEFAULT_DIAL_ID)
  } catch {
    return []
  }
}

export function writeHiddenDialIds(ids: readonly string[]) {
  const next = ids.filter((id) => id !== DEFAULT_DIAL_ID)
  window.localStorage.setItem(CLOCK_DIAL_HIDDEN_KEY, JSON.stringify(next))
}

export function readSelectedDialId(visibleIds: readonly string[]): string {
  if (typeof window === "undefined") return DEFAULT_DIAL_ID
  const stored = window.localStorage.getItem(CLOCK_DIAL_STORAGE_KEY)
  if (stored && visibleIds.includes(stored)) return stored
  return DEFAULT_DIAL_ID
}

export function writeSelectedDialId(id: string) {
  window.localStorage.setItem(CLOCK_DIAL_STORAGE_KEY, id)
}
