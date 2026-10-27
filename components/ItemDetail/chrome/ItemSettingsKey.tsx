/**
 * components/ItemDetail/chrome/ItemSettingsKey.tsx — Chrome gear for item settings
 *
 * The brushed gear, with no keycap around it. The hit target matches the
 * neighboring window keys (26px). On the popup it sits in the title row
 * with Minimize and Close. The page uses it in the fascia.
 * _Last mapped: 2026-10-24_
 */
"use client"

import { cn } from "@/lib/utils"

export function ItemSettingsKey({ className, onClick }: { className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn("id-settings-key", className)}
      data-no95=""
      aria-label="Item settings"
      title="Item settings"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <img src="/ui/settings-gear.png" alt="" width={26} height={26} draggable={false} />
    </button>
  )
}
