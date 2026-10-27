/**
 * components/Home/Tracking/pen-tray-bg.ts — Photographed pen-well plates
 *
 * Curated stills from designrefs/ copied to public/pen-tray/. The velvet
 * well is gone; default is Cat traces (navy gold board). View settings
 * picks one. Ink tells the selected-pen strip whether names should be
 * cream on dark or dark on nacre.
 */
export const PEN_TRAY_IDS = ["cat", "pewter", "jewel", "bloom", "fr4", "xray"] as const

export type PenTrayId = (typeof PEN_TRAY_IDS)[number]

export type PenTrayInk = "light" | "dark"

export const DEFAULT_PEN_TRAY: PenTrayId = "cat"

export type PenTrayMeta = {
  id: PenTrayId
  label: string
  hint: string
  /** Selected-pen caption ink. Light ink = cream on a dark plate. */
  ink: PenTrayInk
  plate: string
  fallback: string
}

export const PEN_TRAY_META: Record<PenTrayId, PenTrayMeta> = {
  cat: {
    id: "cat",
    label: "Cat traces",
    hint: "Navy solder mask, gold cat circuit — dark tray, pens stay bright",
    ink: "light",
    plate: "/pen-tray/cat.jpg",
    fallback: "#0b1c36",
  },
  pewter: {
    id: "pewter",
    label: "Pewter",
    hint: "Baroque silver-book cover — jewelry-case metal under the beads",
    ink: "light",
    plate: "/pen-tray/pewter.jpg",
    fallback: "#3a3a38",
  },
  jewel: {
    id: "jewel",
    label: "Jewel PCB",
    hint: "Pearl nacre board with rhinestone solder — pale tray, dark names",
    ink: "dark",
    plate: "/pen-tray/jewel.jpg",
    fallback: "#d8d4cc",
  },
  bloom: {
    id: "bloom",
    label: "Bloom",
    hint: "Oil-slick enamel flower — gunmetal troughs, iridescent well",
    ink: "light",
    plate: "/pen-tray/bloom.jpg",
    fallback: "#2a3038",
  },
  fr4: {
    id: "fr4",
    label: "FR4",
    hint: "Classic dark-green solder mask — even instrument plate",
    ink: "light",
    plate: "/pen-tray/fr4.jpg",
    fallback: "#0c2a18",
  },
  xray: {
    id: "xray",
    label: "X-ray",
    hint: "Black substrate, lime traces — high-contrast constellation",
    ink: "light",
    plate: "/pen-tray/xray.jpg",
    fallback: "#050806",
  },
}

export function isPenTrayId(value: unknown): value is PenTrayId {
  return typeof value === "string" && (PEN_TRAY_IDS as readonly string[]).includes(value)
}

export function parsePenTray(value: unknown): PenTrayId {
  return isPenTrayId(value) ? value : DEFAULT_PEN_TRAY
}

export function penTrayInkFor(id: unknown): PenTrayInk {
  return PEN_TRAY_META[parsePenTray(id)].ink
}

export function penTrayStyle(id: unknown): {
  ["--pen-tray-photo"]: string
  ["--pen-tray-fallback"]: string
} {
  const meta = PEN_TRAY_META[parsePenTray(id)]
  return {
    "--pen-tray-photo": `url("${meta.plate}")`,
    "--pen-tray-fallback": meta.fallback,
  }
}
