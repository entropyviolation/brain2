/**
 * lib/corner-mix.ts — Bouba/Kiki default corner snapshot
 *
 * Named preset `default` is the chrome corner radii measured before any
 * Bouba/Kiki edit (2026-10-09). Mix 50 writes those literals back. Mix 0
 * (bouba) lifts each length by 12px. Mix 100 (kiki) takes each length to 0.
 * The default sits on the slider as the recorded values, not as the average
 * of the two poles — piecewise interpolation passes through the literal at 50.
 *
 * Circles, pills, and hairline lamps are not in this map (`CORNERS_LEFT_ALONE`).
 * Rem lengths use a 16px root only when a mix other than 50 must become px.
 * At mix 50 the rem literal is what gets written.
 */

export const DEFAULT_CORNER_PRESET = "default" as const

/** Slider position that restores `DEFAULT_CORNER_RADII`. */
export const DEFAULT_CORNER_MIX = 50

/** Extra radius at full bouba (mix 0), in px. Full kiki (mix 100) is 0. */
export const BOUBA_LIFT_PX = 12

/** Root used only to convert rem → px away from the default mix. */
export const CORNER_REM_PX = 16

/**
 * Token → radius, as written in the stylesheets on the snapshot day.
 *
 * | Token | Literal | Where it was measured |
 * |-------|---------|------------------------|
 * | `--radius` | `0.75rem` | `app/globals.css` (`:root`). Tailwind `rounded-lg`. |
 * | `--r-tw` | `0.25rem` | Tailwind `rounded` (config does not override `DEFAULT`). Also the five `0.25rem` literals in itinerary CSS. |
 * | `--r-0` … `--r-18` | those px | Chrome `border-radius` literals. Census below. |
 * | `--r-11` | `11px` | GradSearch mark and search field. The first CSS census missed this file (the sheet lives in a TS string). |
 * | `--r-20px` | `20px` | GradSearch chips. Not `--r-20`, which is already `0.2rem`. |
 * | `--r-375` | `0.375rem` | Itinerary documents (9). |
 * | `--r-half` | `0.5rem` | Itinerary documents (5). |
 * | `--r-30` | `0.3rem` | Trip activities (5). |
 * | `--r-20` | `0.2rem` | Itinerary documents (3). |
 * | `--r-35` | `0.35rem` | Itinerary document (1). |
 *
 * Derived, not stored as their own poles — they follow `--radius`:
 * `rounded-md` = `calc(var(--radius) - 2px)`, `rounded-sm` = `calc(var(--radius) - 4px)`.
 * Tailwind `rounded-xl` is `0.75rem` today (1 use), the same length as `--radius`.
 *
 * CSS `border-radius` census (`app`, `components`, `lib`, tests excluded),
 * counted before this preset existed:
 *
 * | Literal | Count | In the preset |
 * |---------|------:|:--------------|
 * | `2px` | 258 | `--r-2` |
 * | `3px` | 102 | `--r-3` |
 * | `50%` | 100 | left alone (circles: lamps, radios) |
 * | `0` | 76 | `--r-0` |
 * | `8px` | 38 | `--r-8` |
 * | `999px` | 24 | left alone (pills) |
 * | `1px` | 19 | `--r-1` |
 * | `6px` | 18 | `--r-6` |
 * | `0 !important` | 10 | `--r-0` |
 * | `4px` | 10 | `--r-4` |
 * | `0.375rem` | 9 | `--r-375` |
 * | `2px !important` | 8 | `--r-2` |
 * | `3px !important` | 7 | `--r-3` |
 * | `10px` | 6 | `--r-10` |
 * | `7px` | 6 | `--r-7` |
 * | `0.5rem` | 5 | `--r-half` |
 * | `0.25rem` | 5 | `--r-tw` |
 * | `0.3rem` | 5 | `--r-30` |
 * | `14px` | 4 | `--r-14` |
 * | `5px` | 4 | `--r-5` |
 * | `99px` | 4 | left alone (near-pill) |
 * | `18px` | 3 | `--r-18` |
 * | `12px` | 3 | `--r-12` |
 * | `16px` | 3 | `--r-16` |
 * | `0.2rem` | 3 | `--r-20` |
 * | `9px` | 2 | `--r-9` |
 * | `0.35rem` | 1 | `--r-35` |
 *
 * `app/win95.css` fascia bays are the 2px / 3px pair named in
 * `docs/DESIGN_STYLE.md` (“Radius 2–3px”). Square `0` / `0 !important` is the
 * Win95 chrome that beats Tailwind’s `--radius`.
 *
 * A later pass routed corners the census did not see as literals: GradSearch
 * (shadow root; its local `--radius: 14px` had been freezing that token),
 * Tidy’s local `--r: 10px`, the header tracking color swatch (`1px`), and
 * Tailwind `rounded-none` (hardcoded `0`, now `--r-0` under `body.win95-app`).
 * `11px` and `20px` were not in the first census, so they joined the snapshot
 * at those exact literals (`--r-11`, `--r-20px`).
 */
export const DEFAULT_CORNER_RADII = {
  "--radius": "0.75rem",
  "--r-tw": "0.25rem",
  "--r-0": "0px",
  "--r-1": "1px",
  "--r-2": "2px",
  "--r-3": "3px",
  "--r-4": "4px",
  "--r-5": "5px",
  "--r-6": "6px",
  "--r-7": "7px",
  "--r-8": "8px",
  "--r-9": "9px",
  "--r-10": "10px",
  "--r-11": "11px",
  "--r-12": "12px",
  "--r-14": "14px",
  "--r-16": "16px",
  "--r-18": "18px",
  "--r-20px": "20px",
  "--r-375": "0.375rem",
  "--r-half": "0.5rem",
  "--r-30": "0.3rem",
  "--r-20": "0.2rem",
  "--r-35": "0.35rem",
} as const

export type CornerToken = keyof typeof DEFAULT_CORNER_RADII

/** Shapes that are not chrome corners. Do not route these through the mix. */
export const CORNERS_LEFT_ALONE = ["50%", "999px", "99px", "0.5px", "inherit", "50% / 42%"] as const

export function clampCornerMix(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CORNER_MIX
  return Math.min(100, Math.max(0, value))
}

/** Px length of a snapshot literal. Rem uses `CORNER_REM_PX`. */
export function cornerLiteralPx(literal: string): number {
  const v = literal.trim()
  if (v === "0") return 0
  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(v)
  if (px) return Number(px[1])
  const rem = /^(-?\d+(?:\.\d+)?)rem$/.exec(v)
  if (rem) return Number(rem[1]) * CORNER_REM_PX
  return 0
}

/**
 * Radius in px at `mix`. 0 = bouba (literal + 12px), 50 = the literal’s px,
 * 100 = kiki (0).
 */
export function cornerRadiusPx(literal: string, mix: number): number {
  const base = cornerLiteralPx(literal)
  const m = clampCornerMix(mix)
  const bouba = base + BOUBA_LIFT_PX
  if (m <= DEFAULT_CORNER_MIX) {
    const t = m / DEFAULT_CORNER_MIX
    return bouba + (base - bouba) * t
  }
  const t = (m - DEFAULT_CORNER_MIX) / (100 - DEFAULT_CORNER_MIX)
  return base + (0 - base) * t
}

function formatPx(px: number): string {
  const n = Math.round(px * 100) / 100
  if (Object.is(n, -0) || n === 0) return "0px"
  const text = n.toFixed(2).replace(/\.?0+$/, "")
  return `${text}px`
}

/** CSS value for one token. Mix 50 is the stored literal, including rem. */
export function cornerTokenValue(token: CornerToken, mix: number): string {
  const literal = DEFAULT_CORNER_RADII[token]
  // The cosine round-trip sits a hair off 50. That still is the snapshot.
  if (Math.abs(clampCornerMix(mix) - DEFAULT_CORNER_MIX) < 0.05) return literal
  return formatPx(cornerRadiusPx(literal, mix))
}

/** Every preset token at `mix`. Mix 50 deep-equals `DEFAULT_CORNER_RADII`. */
export function cornerTokens(mix: number = DEFAULT_CORNER_MIX): Record<CornerToken, string> {
  const out = {} as Record<CornerToken, string>
  for (const token of Object.keys(DEFAULT_CORNER_RADII) as CornerToken[]) {
    out[token] = cornerTokenValue(token, mix)
  }
  return out
}

export function applyCornerMix(
  el: { style: { setProperty: (name: string, value: string) => void } },
  mix: number = DEFAULT_CORNER_MIX,
): Record<CornerToken, string> {
  const tokens = cornerTokens(mix)
  for (const [name, value] of Object.entries(tokens)) {
    el.style.setProperty(name, value)
  }
  el.style.setProperty("--corner-mix", clampCornerMix(mix).toFixed(2))
  return tokens
}
