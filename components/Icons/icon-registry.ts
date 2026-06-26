/**
 * Central registry for the icon/orb system.
 *
 * Source-of-truth data lives in `lib/orbs-manifest.ts` (auto-generated PNG list)
 * and `lib/lists-icon-grid.ts` (freeform grid layout). They are re-exported here
 * so that `components/Icons` is the single import surface for the icon system
 * while keeping the auto-generated manifest untouched (zero behavioral change).
 */
export { ORB_IMAGES, ORB_PATHS } from "@/lib/orbs-manifest"
export { computeIconGridPositions } from "@/lib/lists-icon-grid"
