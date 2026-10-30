/**
 * components/ui/clock-picker/clock-dials.ts — Dial paintings
 *
 * The list is `backgrounds/manifest.json` (`id`, `file`, `label`). Ceramic is
 * the rim (`../ceramic-face.png`) and the default. The other files are
 * transparent center paintings. Hide and restore are per browser; the PNGs
 * stay on disk.
 *
 * Each painting is a dynamic `import()` of that file only. Nothing here
 * statically imports the set, so the dev compiler does not walk every PNG
 * with this module. `loadDial` fetches the one id the open panel is showing.
 */
import manifest from "./backgrounds/manifest.json"

export const DEFAULT_DIAL_ID = "ceramic"
/** Selected dial id for this browser. */
export const CLOCK_DIAL_STORAGE_KEY = "brain2.clock-dial"
/** JSON array of painting ids hidden for this browser. Ceramic is never stored. */
export const CLOCK_DIAL_HIDDEN_KEY = "brain2.clock-dial-hidden"

type Picture = { src: string } | string
type PictureModule = { default: Picture }

type ManifestEntry = { id: string; file: string; label: string }

export type ClockDial = {
  id: string
  label: string
  /** Bundled URL after `loadDial` for this id. Empty until then. */
  src: string
  /** The ceramic rim is the whole face. A painting sits in its center. */
  placement: "face" | "center"
}

const srcCache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

/** One static specifier per dial so the bundler emits a separate chunk. */
function loaderFor(id: string): (() => Promise<PictureModule>) | null {
  switch (id) {
    case "ceramic":
      return () => import("./ceramic-face.png")
    case "cherub-twins":
      return () => import("./backgrounds/cherub-twins.png")
    case "lattice-rabbit":
      return () => import("./backgrounds/lattice-rabbit.png")
    case "love-trip-kitty":
      return () => import("./backgrounds/love-trip-kitty.png")
    case "mother-of-pearl":
      return () => import("./backgrounds/mother-of-pearl.png")
    case "opalescent-birds":
      return () => import("./backgrounds/opalescent-birds.png")
    case "pearl-blossom":
      return () => import("./backgrounds/pearl-blossom.png")
    case "pearl-flower":
      return () => import("./backgrounds/pearl-flower.png")
    case "pearl-star-button":
      return () => import("./backgrounds/pearl-star-button.png")
    case "rabbit-portrait":
      return () => import("./backgrounds/rabbit-portrait.png")
    case "silver-bat":
      return () => import("./backgrounds/silver-bat.png")
    case "silver-floral-locket":
      return () => import("./backgrounds/silver-floral-locket.png")
    case "silver-sphere":
      return () => import("./backgrounds/silver-sphere.png")
    case "silver-spiral":
      return () => import("./backgrounds/silver-spiral.png")
    case "teal-pearl":
      return () => import("./backgrounds/teal-pearl.png")
    case "umbrella-cats":
      return () => import("./backgrounds/umbrella-cats.png")
    case "winged-cherub":
      return () => import("./backgrounds/winged-cherub.png")
    case "winged-kitten":
      return () => import("./backgrounds/winged-kitten.png")
    default:
      return null
  }
}

function assetSrc(asset: Picture): string {
  return typeof asset === "string" ? asset : asset.src
}

export function clockDials(): ClockDial[] {
  const entries = manifest as ManifestEntry[]
  const dials: ClockDial[] = []
  for (const entry of entries) {
    if (!entry.id || !loaderFor(entry.id)) continue
    dials.push({
      id: entry.id,
      label: entry.label,
      src: srcCache.get(entry.id) ?? "",
      placement: entry.id === DEFAULT_DIAL_ID ? "face" : "center",
    })
  }
  if (!dials.some((dial) => dial.id === DEFAULT_DIAL_ID)) {
    dials.unshift({
      id: DEFAULT_DIAL_ID,
      label: "Ceramic",
      src: srcCache.get(DEFAULT_DIAL_ID) ?? "",
      placement: "face",
    })
  }
  return dials
}

/** Load one dial's image. Other dials stay unloaded. */
export function loadDial(id: string): Promise<string | null> {
  const cached = srcCache.get(id)
  if (cached) return Promise.resolve(cached)
  const inflight = pending.get(id)
  if (inflight) return inflight
  const load = loaderFor(id)
  if (!load) return Promise.resolve(null)
  const promise = load()
    .then((mod) => {
      const src = assetSrc(mod.default)
      if (!src) return null
      srcCache.set(id, src)
      return src
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(id)
    })
  pending.set(id, promise)
  return promise
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
