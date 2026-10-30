/**
 * lib/fonts/analytics-type.ts — Data studio type
 *
 * Bricolage Grotesque (`--font-an-display`) for titles and values.
 * Instrument Sans (`--font-an-text`) for prose, keys, labels, and ticks.
 */
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google"

const anDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-an-display",
  display: "swap",
})

const anText = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-an-text",
  display: "swap",
})

export const analyticsTypeFaces = `${anDisplay.variable} ${anText.variable}`
