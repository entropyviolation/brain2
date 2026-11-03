/**
 * lib/fonts/dm-mono.ts — Task card labels and item detail mono
 */
import { DM_Mono } from "next/font/google"

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dmmono",
  display: "swap",
})

export const dmMonoFace = dmMono.variable
