/**
 * components/ItemDetail/ItemTagChip.tsx — Item-tag chip (string value)
 *
 * Item tags stay free-text strings. When `normalizeTag(name)` matches a
 * Tracking catalog tag, the chip shows that tag’s color bead. Double-click
 * opens tag settings (match → id; no match → create-from-name).
 */

"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { normalizeTag } from "@/lib/links"
import {
  openTagSettings,
  openTagSettingsFromName,
  TAG_OPEN_TITLE,
} from "@/components/Home/Tracking/open-tag-settings"

export function matchCatalogTag(
  name: string,
  tags: readonly { id: string; name: string; color: string }[],
) {
  const want = normalizeTag(name)
  if (!want) return undefined
  return tags.find((tag) => normalizeTag(tag.name) === want)
}

export function ItemTagChip({
  name,
  trailing,
  className = "id-tag-chip",
}: {
  name: string
  trailing?: ReactNode
  className?: string
}) {
  const catalog = useTimeTrackingStore((s) => s.tags)
  const match = matchCatalogTag(name, catalog)

  return (
    <Badge
      variant="secondary"
      className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer ${className}`}
      title={TAG_OPEN_TITLE}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (match) openTagSettings(match.id)
        else openTagSettingsFromName(name)
      }}
    >
      {match ? (
        <span className="id-tag-bead" style={{ background: match.color }} aria-hidden />
      ) : null}
      {name}
      {trailing}
    </Badge>
  )
}
