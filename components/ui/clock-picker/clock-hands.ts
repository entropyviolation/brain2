/**
 * components/ui/clock-picker/clock-hands.ts — Hand pairs
 *
 * Chrome hand pairs cut from the hand sheets. `hands/manifest.json` lists
 * `{ id, hour, minute, label }`. Each PNG is 480px square, transparent, hand
 * pointing at 12 with the pivot at the center. The built-in filigree hands
 * (drawn in `clock-picker.tsx`) are the default. The selected id persists in
 * `localStorage`.
 */
import manifest from "./hands/manifest.json"
import chrome01Hour from "./hands/chrome-01-hour.png"
import chrome01Minute from "./hands/chrome-01-minute.png"
import chrome02Hour from "./hands/chrome-02-hour.png"
import chrome02Minute from "./hands/chrome-02-minute.png"
import chrome03Hour from "./hands/chrome-03-hour.png"
import chrome03Minute from "./hands/chrome-03-minute.png"
import chrome04Hour from "./hands/chrome-04-hour.png"
import chrome04Minute from "./hands/chrome-04-minute.png"
import chrome05Hour from "./hands/chrome-05-hour.png"
import chrome05Minute from "./hands/chrome-05-minute.png"
import chrome06Hour from "./hands/chrome-06-hour.png"
import chrome06Minute from "./hands/chrome-06-minute.png"
import chrome07Hour from "./hands/chrome-07-hour.png"
import chrome07Minute from "./hands/chrome-07-minute.png"
import chrome08Hour from "./hands/chrome-08-hour.png"
import chrome08Minute from "./hands/chrome-08-minute.png"
import chrome09Hour from "./hands/chrome-09-hour.png"
import chrome09Minute from "./hands/chrome-09-minute.png"
import chrome10Hour from "./hands/chrome-10-hour.png"
import chrome10Minute from "./hands/chrome-10-minute.png"
import chrome11Hour from "./hands/chrome-11-hour.png"
import chrome11Minute from "./hands/chrome-11-minute.png"
import chrome12Hour from "./hands/chrome-12-hour.png"
import chrome12Minute from "./hands/chrome-12-minute.png"
import chrome13Hour from "./hands/chrome-13-hour.png"
import chrome13Minute from "./hands/chrome-13-minute.png"
import chrome14Hour from "./hands/chrome-14-hour.png"
import chrome14Minute from "./hands/chrome-14-minute.png"
import chrome15Hour from "./hands/chrome-15-hour.png"
import chrome15Minute from "./hands/chrome-15-minute.png"
import chrome16Hour from "./hands/chrome-16-hour.png"
import chrome16Minute from "./hands/chrome-16-minute.png"
import chrome17Hour from "./hands/chrome-17-hour.png"
import chrome17Minute from "./hands/chrome-17-minute.png"
import chrome18Hour from "./hands/chrome-18-hour.png"
import chrome18Minute from "./hands/chrome-18-minute.png"
import chrome19Hour from "./hands/chrome-19-hour.png"
import chrome19Minute from "./hands/chrome-19-minute.png"
import chrome20Hour from "./hands/chrome-20-hour.png"
import chrome20Minute from "./hands/chrome-20-minute.png"
import chrome21Hour from "./hands/chrome-21-hour.png"
import chrome21Minute from "./hands/chrome-21-minute.png"
import chrome22Hour from "./hands/chrome-22-hour.png"
import chrome22Minute from "./hands/chrome-22-minute.png"

export const DEFAULT_HANDS_ID = "filigree"
export const CLOCK_HANDS_STORAGE_KEY = "brain2.clock-hands"

type Picture = { src: string } | string
type ManifestEntry = { id: string; hour: string; minute: string; label: string }

export type HandPair = { id: string; label: string; hour: string; minute: string }

const SOURCES: Record<string, Picture> = {
  "chrome-01-hour.png": chrome01Hour,
  "chrome-01-minute.png": chrome01Minute,
  "chrome-02-hour.png": chrome02Hour,
  "chrome-02-minute.png": chrome02Minute,
  "chrome-03-hour.png": chrome03Hour,
  "chrome-03-minute.png": chrome03Minute,
  "chrome-04-hour.png": chrome04Hour,
  "chrome-04-minute.png": chrome04Minute,
  "chrome-05-hour.png": chrome05Hour,
  "chrome-05-minute.png": chrome05Minute,
  "chrome-06-hour.png": chrome06Hour,
  "chrome-06-minute.png": chrome06Minute,
  "chrome-07-hour.png": chrome07Hour,
  "chrome-07-minute.png": chrome07Minute,
  "chrome-08-hour.png": chrome08Hour,
  "chrome-08-minute.png": chrome08Minute,
  "chrome-09-hour.png": chrome09Hour,
  "chrome-09-minute.png": chrome09Minute,
  "chrome-10-hour.png": chrome10Hour,
  "chrome-10-minute.png": chrome10Minute,
  "chrome-11-hour.png": chrome11Hour,
  "chrome-11-minute.png": chrome11Minute,
  "chrome-12-hour.png": chrome12Hour,
  "chrome-12-minute.png": chrome12Minute,
  "chrome-13-hour.png": chrome13Hour,
  "chrome-13-minute.png": chrome13Minute,
  "chrome-14-hour.png": chrome14Hour,
  "chrome-14-minute.png": chrome14Minute,
  "chrome-15-hour.png": chrome15Hour,
  "chrome-15-minute.png": chrome15Minute,
  "chrome-16-hour.png": chrome16Hour,
  "chrome-16-minute.png": chrome16Minute,
  "chrome-17-hour.png": chrome17Hour,
  "chrome-17-minute.png": chrome17Minute,
  "chrome-18-hour.png": chrome18Hour,
  "chrome-18-minute.png": chrome18Minute,
  "chrome-19-hour.png": chrome19Hour,
  "chrome-19-minute.png": chrome19Minute,
  "chrome-20-hour.png": chrome20Hour,
  "chrome-20-minute.png": chrome20Minute,
  "chrome-21-hour.png": chrome21Hour,
  "chrome-21-minute.png": chrome21Minute,
  "chrome-22-hour.png": chrome22Hour,
  "chrome-22-minute.png": chrome22Minute,
}

const src = (asset: Picture) => (typeof asset === "string" ? asset : asset.src)

export function handPairs(): HandPair[] {
  const pairs: HandPair[] = []
  for (const entry of manifest as ManifestEntry[]) {
    const hour = SOURCES[entry.hour]
    const minute = SOURCES[entry.minute]
    if (!hour || !minute) continue
    pairs.push({ id: entry.id, label: entry.label, hour: src(hour), minute: src(minute) })
  }
  return pairs
}

export function readSelectedHandsId(ids: readonly string[]): string {
  if (typeof window === "undefined") return DEFAULT_HANDS_ID
  try {
    const stored = window.localStorage.getItem(CLOCK_HANDS_STORAGE_KEY)
    if (stored && ids.includes(stored)) return stored
  } catch {}
  return DEFAULT_HANDS_ID
}

export function writeSelectedHandsId(id: string) {
  try {
    window.localStorage.setItem(CLOCK_HANDS_STORAGE_KEY, id)
  } catch {}
}
