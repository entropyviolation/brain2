/**
 * app/lab/baby-gens/page.tsx — Baby game generation log
 *
 * ComfyUI outputs with their recipes, likes and notes. See `components/BabyGame/gens/README.md`.
 */
"use client"

import { GensLog } from "@/components/BabyGame/gens/GensLog"

export default function BabyGensPage() {
  return (
    <div className="relative z-50 mx-auto min-h-screen max-w-7xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <GensLog />
    </div>
  )
}
