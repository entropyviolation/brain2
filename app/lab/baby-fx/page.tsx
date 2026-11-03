/**
 * app/lab/baby-fx/page.tsx — Baby game effects lab
 *
 * A standalone route, like `/lab/overcome`. See `components/Lab/BabyFx/README.md`.
 */
"use client"

import { BabyFxLab } from "@/components/Lab/BabyFx/BabyFxLab"

export default function BabyFxLabPage() {
  return (
    <div className="relative z-50 mx-auto min-h-screen max-w-4xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <BabyFxLab />
    </div>
  )
}
