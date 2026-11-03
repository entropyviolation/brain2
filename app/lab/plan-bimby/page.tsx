/**
 * app/lab/plan-bimby/page.tsx — Say a short-term plan, confirm it, play it through
 *
 * A standalone route, like `/lab/lists-helper`. See `lib/plan-bimby/README.md`.
 */
"use client"

import { PlanBimbyPanel } from "@/components/Lab/PlanBimby/PlanBimbyPanel"

export default function PlanBimbyLabPage() {
  return (
    <div className="relative z-50 mx-auto min-h-screen max-w-3xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <PlanBimbyPanel />
    </div>
  )
}
