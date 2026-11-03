/**
 * app/lab/overcome/page.tsx — Say what you cannot start; get logged and pushed
 *
 * A standalone route, like `/lab/plan-bimby`. See `lib/overcome-bimby/README.md`.
 */
"use client"

import { OvercomeBimbyPanel } from "@/components/Lab/OvercomeBimby/OvercomeBimbyPanel"

export default function OvercomeLabPage() {
  return (
    <div className="relative z-50 mx-auto min-h-screen max-w-3xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <OvercomeBimbyPanel />
    </div>
  )
}
