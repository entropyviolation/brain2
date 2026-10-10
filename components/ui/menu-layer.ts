import type { CSSProperties } from "react"

/**
 * One layer for dropdown and select menus.
 *
 * The list is portaled to `document.body`. A z-index inside a scrolled well
 * stays in that well's stacking context, so a frozen header paints over it.
 * 280 clears the app pin (40), the miss-reason scrim (120), and From Notes
 * (200). Nameplates stay at 310. Do not lower this from a single widget.
 */
export const MENU_LAYER_Z = 280

/** Literal class so Tailwind emits the layer. Matches `MENU_LAYER_Z`. */
export const MENU_LAYER_CLASS = "z-[280]"

/** Inline z-index, because a portaled popper copies the computed value onto its wrapper. */
export function menuLayerStyle(style?: CSSProperties): CSSProperties {
  return { ...style, zIndex: MENU_LAYER_Z, pointerEvents: "auto" }
}
