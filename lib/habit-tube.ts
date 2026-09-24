/**
 * lib/habit-tube.ts — Noble-gas grade-tube color
 *
 * Week / Span grade and Perfect output each keep a discharge hue. Glass and
 * vacuum stay photoreal; only the plasma column tints. Defaults match the
 * Home overview gradient (week-grade green / perfect-output navy) until the
 * user picks. Percent math is untouched.
 */

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const DEFAULT_GRADE_TUBE_COLOR = "#508b51"
export const DEFAULT_OUTPUT_TUBE_COLOR = "#25366a"

export const GRADE_TUBE_COLOR_STORAGE_KEY = persistKey("habit-grade-tube")
export const OUTPUT_TUBE_COLOR_STORAGE_KEY = persistKey("habit-output-tube")

const HEX6 = /^#[0-9a-fA-F]{6}$/

export function sanitizeTubeColor(value: unknown, fallback: string): string {
  const fb = HEX6.test(fallback) ? fallback.toLowerCase() : DEFAULT_GRADE_TUBE_COLOR
  if (typeof value === "string" && HEX6.test(value.trim())) {
    return value.trim().toLowerCase()
  }
  return fb
}

export function readStoredTubeColor(key: string): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = readAliasedLocal(key)
    return typeof raw === "string" && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : null
  } catch {
    return null
  }
}

export function writeStoredTubeColor(key: string, value: unknown, fallback: string): string {
  const hex = sanitizeTubeColor(value, fallback)
  if (typeof localStorage === "undefined") return hex
  try {
    writeAliasedLocal(key, hex)
  } catch {
    /* pin is best-effort */
  }
  return hex
}

export type DischargePaint = {
  core: string
  mid: string
  halo: string
  volume: string
  residual: string
  residualHi: string
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.round(clamp01(n / 255) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
  else if (max === gg) h = ((bb - rr) / d + 2) / 6
  else h = ((rr - gg) / d + 4) / 6
  return { h, s, l }
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

/** Soft discharge swatches from a picked hue — glass stays clear. */
export function dischargePaint(hex: string, fallback = DEFAULT_GRADE_TUBE_COLOR): DischargePaint {
  const rgb = hexToRgb(sanitizeTubeColor(hex, fallback)) ?? hexToRgb(fallback)!
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const at = (s: number, l: number) => {
    const c = hslToRgb(hsl.h, clamp01(s), clamp01(l))
    return rgbToHex(c.r, c.g, c.b)
  }
  return {
    halo: rgbToHex(rgb.r, rgb.g, rgb.b),
    mid: at(Math.min(1, hsl.s * 0.78), Math.min(0.62, hsl.l * 0.42 + 0.32)),
    core: at(Math.min(0.28, hsl.s * 0.32), 0.86),
    volume: at(Math.min(0.92, hsl.s * 0.82), Math.max(0.2, hsl.l * 0.38)),
    residual: at(Math.min(0.38, hsl.s * 0.42), 0.055),
    residualHi: at(Math.min(0.34, hsl.s * 0.38), 0.12),
  }
}

export function defaultTubeColorForGas(gas: "argon" | "xenon" | "krypton"): string {
  if (gas === "xenon") return DEFAULT_OUTPUT_TUBE_COLOR
  if (gas === "krypton") return "#9888ff"
  return DEFAULT_GRADE_TUBE_COLOR
}
