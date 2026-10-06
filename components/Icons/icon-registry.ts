/**
 * Central registry for the icon/orb system.
 *
 * Source-of-truth data lives in `lib/orbs-manifest.ts` and
 * `lib/folders-manifest.ts` (auto-generated PNG lists) and
 * `lib/lists-icon-grid.ts` (freeform grid layout). They are re-exported here
 * so that `components/Icons` is the single import surface for the icon system
 * while keeping the auto-generated manifest untouched (zero behavioral change).
 *
 * Named UI glyphs (Rituals sun/moon) are also registered here so chrome can
 * import from `@/components/Icons` instead of reaching into lucide directly.
 */
export { ORB_IMAGES, ORB_PATHS } from "@/lib/orbs-manifest"
export { FOLDER_IMAGES, FOLDER_PATHS } from "@/lib/folders-manifest"
export { computeIconGridPositions } from "@/lib/lists-icon-grid"

/** Rituals — day morning (sun) and night (moon). */
export { Sun as RitualSunIcon, Moon as RitualMoonIcon } from "lucide-react"
