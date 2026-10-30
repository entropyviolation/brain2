/**
 * lib/fonts/fraunces.ts — Task card names and figures
 *
 * Variable axes match the root layout this face used to live in.
 */
import { Fraunces } from "next/font/google"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
})

export const frauncesFace = fraunces.variable
