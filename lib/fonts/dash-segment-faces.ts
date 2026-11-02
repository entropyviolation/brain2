/**
 * lib/fonts/dash-segment-faces.ts — Silkscreen and DotGothic16
 *
 * Dash digits, the session popup, the task card's stat figures, and To Do's
 * screen title. One next/font call each, shared by those screens.
 * DotGothic16 is also a house face: the root layout puts `--font-dotgothic`
 * on `<html>` (`dotGothicFace`), so any screen, web or Electron, can use it.
 */
import { DotGothic16, Silkscreen } from "next/font/google"

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
  display: "swap",
})

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
})

export const dashSegmentFaces = `${silkscreen.variable} ${dotGothic.variable}`

/** DotGothic16 alone, for the root `<html>`. */
export const dotGothicFace = dotGothic.variable
