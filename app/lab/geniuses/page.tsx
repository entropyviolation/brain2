/**
 * app/lab/geniuses/page.tsx — The geniuses lab: talk back, council meetings, prompts, memory
 *
 * A standalone route, like `/lab/overcome`. See `lib/geniuses/README.md`.
 */
"use client"

import { GeniusesLab } from "@/components/Lab/Geniuses/GeniusesLab"

export default function GeniusesLabPage() {
  return (
    <div className="relative z-50 mx-auto min-h-screen max-w-3xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <GeniusesLab />
    </div>
  )
}
