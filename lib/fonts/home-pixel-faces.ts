/**
 * lib/fonts/home-pixel-faces.ts — Faces the Home dashboard paints
 *
 * Pixelify Sans is the Needs Attention reason key. Silkscreen and DotGothic16
 * come from `dash-segment-faces.ts` (Dash, and the lab bench).
 */
import { Pixelify_Sans } from "next/font/google"
import { dashSegmentFaces } from "@/lib/fonts/dash-segment-faces"

const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixelify",
  display: "swap",
})

export const homePixelFaces = `${pixelify.variable} ${dashSegmentFaces}`
