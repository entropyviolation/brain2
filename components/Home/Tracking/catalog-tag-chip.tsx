/**
 * components/Home/Tracking/catalog-tag-chip.tsx — One Tracking-tag chip language
 *
 * Catalog tag = color bead + name. Toggle chips (pen settings, block editor)
 * keep single-click selection; double-click opens tag settings. Display chips
 * (activity log, day log, working-now) are spans so they can sit inside a row
 * button without nesting controls.
 */

"use client"

import type { ReactNode } from "react"
import { TAG_OPEN_TITLE, tagColorDoubleClick } from "@/components/Home/Tracking/open-tag-settings"

export type CatalogTagRef = { id: string; name: string; color: string }

/** Toggle / select a catalog tag. Single-click toggles; double-click opens settings. */
export function CatalogTagChip({
  tag,
  pressed,
  onClick,
  disabled,
  mark,
  className = "trk-tag",
  "aria-label": ariaLabel,
  title,
}: {
  tag: CatalogTagRef
  pressed?: boolean
  onClick?: () => void
  disabled?: boolean
  mark?: ReactNode
  className?: string
  "aria-label"?: string
  title?: string
}) {
  const on = Boolean(pressed)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed === undefined ? undefined : on}
      aria-label={ariaLabel ?? tag.name}
      title={title ?? TAG_OPEN_TITLE}
      onClick={onClick}
      onDoubleClick={tagColorDoubleClick(tag.id)}
      className={className}
      style={on ? { background: tag.color, borderColor: tag.color, color: "#fff" } : undefined}
    >
      <span className="trk-tag-bead" style={{ background: tag.color }} aria-hidden />
      <span className="trk-tag-name">{tag.name}</span>
      {mark}
    </button>
  )
}

/** Bead + name for read-only surfaces. Double-click opens tag settings. */
export function CatalogTagLabel({
  tag,
  suffix,
  className = "trk-catalog-chip",
}: {
  tag: CatalogTagRef
  /** Extra copy after the name, e.g. "(this block)". */
  suffix?: string
  className?: string
}) {
  return (
    <span
      className={className}
      title={TAG_OPEN_TITLE}
      onDoubleClick={tagColorDoubleClick(tag.id)}
    >
      <span className="trk-tag-bead" style={{ background: tag.color }} aria-hidden />
      <span className="trk-tag-name">
        {tag.name}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </span>
  )
}
