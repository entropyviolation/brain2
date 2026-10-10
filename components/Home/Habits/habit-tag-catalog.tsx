/**
 * components/Home/Habits/habit-tag-catalog.tsx — Shared Tracking tag chips
 *
 * The Tags row (one name, each done task counts as 1) and Auto-fill from
 * Tracking (many ids, painted minutes) both render this catalog. Selection
 * stays with the caller. Create stays here. Edit and double-click open
 * `openTagSettings` (the app-mounted tag settings dialog writes the store
 * via `commitCatalogTagEdit`). When the dialog publishes an edit,
 * `onEdited` runs so open forms can retarget a pressed name. Without a
 * subscriber, the dialog still writes the store directly.
 */
"use client"

import { useEffect, useId, useState } from "react"
import { catalogDisplayName, type CatalogTagEdit } from "@/lib/catalog-tag"
import {
  openTagSettings,
  subscribeTagCatalogEdit,
  TAG_OPEN_TITLE,
  tagColorDoubleClick,
} from "@/components/Home/Tracking/open-tag-settings"
import type { TrackTag } from "@/lib/time-tracking-store"

export function HabitTagCatalog({
  tags,
  groupLabel,
  pressed,
  emptyHint,
  newTagAriaLabel,
  pressedMark,
  onToggle,
  onCreate,
  onEdited,
}: {
  tags: readonly TrackTag[]
  groupLabel: string
  pressed: (tag: TrackTag) => boolean
  emptyHint?: string
  newTagAriaLabel: string
  /** Quiet mark shown next to the name when pressed (e.g. "counts" / "minutes"). */
  pressedMark?: string
  onToggle: (tag: TrackTag) => void
  onCreate: (name: string) => void
  /** Optional; dialog writes the store, then publishes so this can retarget. */
  onEdited?: (result: CatalogTagEdit) => void
}) {
  const fieldId = useId()
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (!onEdited) return
    return subscribeTagCatalogEdit(onEdited)
  }, [onEdited])

  const create = () => {
    const name = catalogDisplayName(draft)
    if (!name) return
    onCreate(name)
    setDraft("")
  }

  return (
    <div role="group" aria-label={groupLabel}>
      {tags.length === 0 && emptyHint ? <p className="habit95-hint">{emptyHint}</p> : null}
      {tags.length > 0 ? (
        <div className="habit95-tags">
          {tags.map((tag) => {
            const on = pressed(tag)
            const label = on && pressedMark ? `${tag.name}, ${pressedMark}` : tag.name
            return (
              <span key={tag.id} className="habit95-tag-line">
                <button
                  type="button"
                  className="habit95-tag"
                  aria-pressed={on}
                  aria-label={label}
                  title={TAG_OPEN_TITLE}
                  onClick={() => onToggle(tag)}
                  onDoubleClick={tagColorDoubleClick(tag.id)}
                >
                  <span className="habit95-tag-dot" style={{ background: tag.color }} />
                  {tag.name}
                  {on && pressedMark ? (
                    <span className="habit95-tag-mark" aria-hidden>
                      {pressedMark}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="habit95-tag habit95-tag-edit"
                  aria-label={`Edit tag ${tag.name}`}
                  onClick={() => openTagSettings(tag.id)}
                >
                  Edit
                </button>
              </span>
            )
          })}
        </div>
      ) : null}

      <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
        <div className="habit95-field">
          <label htmlFor={fieldId}>New tag</label>
          <input
            id={fieldId}
            className="habit95-input"
            value={draft}
            placeholder="Deep work"
            aria-label={newTagAriaLabel}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                create()
              }
            }}
          />
        </div>
        <div className="habit95-field">
          <button type="button" className="habit95-btn" onClick={create} disabled={!draft.trim()}>
            Create tag
          </button>
        </div>
      </div>
    </div>
  )
}
