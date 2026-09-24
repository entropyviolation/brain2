/**
 * lib/pcb-backdrop.ts — Photoreal PCB desktop modes
 *
 * The app-level field behind every window. Classic Win95 teal (no photo) is
 * the fresh default; photographed plates from `designrefs/` (copied to
 * `public/pcb/`) stay available. Settings writes `pcbMode` on `theme-store`
 * and pins it on `brain2-pcb-mode` so a refresh cannot lose a saved plate if
 * the theme blob is overwritten with seed teal before rehydrate.
 * A plate picked this page is also remembered on `brain2-pcb-pick` (sessionStorage)
 * so Fast Refresh / a late hub rehydrate cannot roll the desktop back.
 * `app/pcb-backdrop.tsx` stamps `data-pcb-mode` / `data-pcb-ink` on `<html>`.
 * CSS paints the field. Existing ceramic (or other) picks are never migrated
 * onto teal.
 */

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const PCB_MODES = ["teal", "ceramic", "mint", "ice", "xray", "fr4"] as const

export type PcbMode = (typeof PCB_MODES)[number]

export type PcbInk = "light" | "dark"

/** Fresh installs and Reset. Saved blobs keep their own `pcbMode`. */
export const DEFAULT_PCB_MODE: PcbMode = "teal"

/** Pre-teal seed. Persist blobs that never stored `pcbMode` stay on this plate. */
export const LEGACY_DEFAULT_PCB_MODE: PcbMode = "ceramic"

/** Classic Win95 desktop — the field PCB photos replaced. */
export const TEAL_DESK = "#008080"

/** Tiny pin next to the theme blob — boot script reads this first. */
export const PCB_MODE_STORAGE_KEY = persistKey("pcb-mode")

export type PcbModeMeta = {
  id: PcbMode
  label: string
  hint: string
  /** Header / gutter ink on this plate. Light ink = white on a dark board. */
  ink: PcbInk
  plate: string
  desk: string
}

export const PCB_MODE_META: Record<PcbMode, PcbModeMeta> = {
  teal: {
    id: "teal",
    label: "Teal",
    hint: "Classic Win95 desktop — plain teal, no photograph",
    ink: "dark",
    plate: "",
    desk: TEAL_DESK,
  },
  ceramic: {
    id: "ceramic",
    label: "Ceramic",
    hint: "Silver traces on white ceramic — BGA, via arrays, cream pads",
    ink: "dark",
    plate: "/pcb/ceramic.jpg",
    desk: "#e6e1d8",
  },
  mint: {
    id: "mint",
    label: "Snowflake",
    hint: "Pale mint substrate, sparse silver traces ending in snowflake nodes",
    ink: "dark",
    plate: "/pcb/mint.jpg",
    desk: "#c5ddd4",
  },
  ice: {
    id: "ice",
    label: "Ice",
    hint: "Inverted icy-blue board, dense photoreal traces and via fields",
    ink: "dark",
    plate: "/pcb/ice.jpg",
    desk: "#7ea8c4",
  },
  xray: {
    id: "xray",
    label: "X-ray",
    hint: "Black substrate, lime traces, via constellation",
    ink: "light",
    plate: "/pcb/xray.jpg",
    desk: "#050806",
  },
  fr4: {
    id: "fr4",
    label: "FR4",
    hint: "Classic dark-green solder mask, copper vias, dense routing",
    ink: "light",
    plate: "/pcb/fr4.jpg",
    desk: "#0c2a18",
  },
}

export function isPcbMode(value: unknown): value is PcbMode {
  return typeof value === "string" && (PCB_MODES as readonly string[]).includes(value)
}

export function parsePcbMode(value: unknown): PcbMode {
  return isPcbMode(value) ? value : DEFAULT_PCB_MODE
}

export function readStoredPcbMode(): PcbMode | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = readAliasedLocal(PCB_MODE_STORAGE_KEY)
    return isPcbMode(raw) ? raw : null
  } catch {
    return null
  }
}

/** This tab's last Desktop pick. Survives Fast Refresh; boot script clears it on a real load. */
export const PCB_MODE_SESSION_KEY = "brain2-pcb-pick"

export function readSessionPcbMode(): PcbMode | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PCB_MODE_SESSION_KEY)
    return isPcbMode(raw) ? raw : null
  } catch {
    return null
  }
}

function rememberSessionPcbMode(mode: PcbMode) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(PCB_MODE_SESSION_KEY, mode)
  } catch {
    /* session pick is best-effort */
  }
}

/**
 * Pin the plate. `session: false` syncs the pin from disk without treating it
 * as a live gesture (rehydrate must not clobber a pick made this page).
 */
export function writeStoredPcbMode(value: unknown, opts?: { session?: boolean }): PcbMode {
  const mode = parsePcbMode(value)
  if (opts?.session !== false) rememberSessionPcbMode(mode)
  if (typeof localStorage === "undefined") return mode
  try {
    writeAliasedLocal(PCB_MODE_STORAGE_KEY, mode)
  } catch {
    /* pin is best-effort; theme-store persist is the other copy */
  }
  return mode
}

export function pcbInkFor(mode: PcbMode): PcbInk {
  return PCB_MODE_META[parsePcbMode(mode)].ink
}

export function applyPcbBackdrop(root: HTMLElement, mode: unknown): PcbMode {
  const parsed = parsePcbMode(mode)
  root.setAttribute("data-pcb-mode", parsed)
  root.setAttribute("data-pcb-ink", pcbInkFor(parsed))
  root.style.setProperty("--pcb-desk", PCB_MODE_META[parsed].desk)
  return parsed
}

/** Blocking first-paint script: pin key first, then the theme blob. */
export const PCB_BACKDROP_BOOT_SCRIPT = `(function(){try{try{sessionStorage.removeItem(${JSON.stringify(PCB_MODE_SESSION_KEY)});sessionStorage.removeItem("brain2-led-pick");}catch(e0){}var inkMap=${JSON.stringify(
  Object.fromEntries(PCB_MODES.map((mode) => [mode, PCB_MODE_META[mode].ink])),
)};var deskMap=${JSON.stringify(
  Object.fromEntries(PCB_MODES.map((mode) => [mode, PCB_MODE_META[mode].desk])),
)};var ok=${JSON.stringify([...PCB_MODES])};var m=${JSON.stringify(DEFAULT_PCB_MODE)};var demo=localStorage.getItem("brain2-data-profile")==="demo";var pin=demo?localStorage.getItem("brain2-demo-pcb-mode"):(localStorage.getItem(${JSON.stringify(PCB_MODE_STORAGE_KEY)})||localStorage.getItem("cogs-pcb-mode"));if(ok.indexOf(pin)>=0)m=pin;else{var raw=demo?localStorage.getItem("brain2-demo-theme-store"):(localStorage.getItem("brain2-theme-store")||localStorage.getItem("cogs-theme-store"));if(raw){var j=JSON.parse(raw);var v=j&&j.state&&j.state.pcbMode;if(ok.indexOf(v)>=0)m=v;else if(j&&j.state)m=${JSON.stringify(LEGACY_DEFAULT_PCB_MODE)};}}var r=document.documentElement;r.setAttribute("data-pcb-mode",m);r.setAttribute("data-pcb-ink",inkMap[m]||"dark");if(deskMap[m])r.style.setProperty("--pcb-desk",deskMap[m]);}catch(e){}})();`
