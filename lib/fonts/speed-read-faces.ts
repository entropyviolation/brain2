/**
 * lib/fonts/speed-read-faces.ts — the Speed Read typefaces
 *
 * Eight reading faces for the RSVP stage, one next/font call each. `preload` is
 * off so the rest of the app does not fetch them; a face downloads when the
 * stage first paints in it. The variables go on the view's root element.
 */
import {
  Atkinson_Hyperlegible,
  DotGothic16,
  EB_Garamond,
  Fraunces,
  Instrument_Serif,
  Lexend,
  Literata,
  Space_Mono,
} from "next/font/google"

const fraunces = Fraunces({ subsets: ["latin"], variable: "--sr-fraunces", display: "swap", preload: false })
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--sr-garamond", display: "swap", preload: false })
const literata = Literata({ subsets: ["latin"], variable: "--sr-literata", display: "swap", preload: false })
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--sr-instrument",
  display: "swap",
  preload: false,
})
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--sr-atkinson",
  display: "swap",
  preload: false,
})
const lexend = Lexend({ subsets: ["latin"], variable: "--sr-lexend", display: "swap", preload: false })
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--sr-spacemono",
  display: "swap",
  preload: false,
})
const dotGothic = DotGothic16({
  subsets: ["latin"],
  weight: "400",
  variable: "--sr-dotgothic",
  display: "swap",
  preload: false,
})

export const speedReadFaces = [
  fraunces,
  garamond,
  literata,
  instrument,
  atkinson,
  lexend,
  spaceMono,
  dotGothic,
]
  .map((f) => f.variable)
  .join(" ")

export interface SpeedReadFont {
  id: string
  label: string
  note: string
  family: string
}

export const SPEED_READ_FONTS: SpeedReadFont[] = [
  { id: "fraunces", label: "Fraunces", note: "soft, warm serif", family: "var(--sr-fraunces), Georgia, serif" },
  { id: "garamond", label: "Garamond", note: "old-book calm", family: "var(--sr-garamond), Georgia, serif" },
  { id: "literata", label: "Literata", note: "made for long reading", family: "var(--sr-literata), Georgia, serif" },
  { id: "instrument", label: "Instrument", note: "tall, editorial", family: "var(--sr-instrument), Georgia, serif" },
  { id: "atkinson", label: "Atkinson", note: "built for legibility", family: "var(--sr-atkinson), system-ui, sans-serif" },
  { id: "lexend", label: "Lexend", note: "wide, easy tracking", family: "var(--sr-lexend), system-ui, sans-serif" },
  { id: "spacemono", label: "Space Mono", note: "even letter width", family: "var(--sr-spacemono), ui-monospace, monospace" },
  { id: "dotgothic", label: "DotGothic", note: "house pixel face", family: "var(--sr-dotgothic), var(--font-dotgothic), monospace" },
]
