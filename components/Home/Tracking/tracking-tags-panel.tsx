/**
 * components/Home/Tracking/tracking-tags-panel.tsx — Tag library
 *
 * Shown under the pen tray when **Tags** is latched. Tags live above scopes:
 * one tag can sit on an Activity pen and a Location pen at once, and daily
 * habits link tags rather than pens, so renaming or recoloring here keeps
 * every link intact.
 *
 * The well is the same steel plate language as DETAIL / SHOW AS — raised
 * keys, a color bead, name, pen count — not pastel islands on the tray photo.
 */
"use client"

import { useState } from "react"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Link2, Pencil, Plus, Trash2 } from "lucide-react"
import { useTimeTrackingStore, type TrackTag } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { penIdsForTags } from "@/lib/tracked-time"
import "./tracking-chrome.css"
import "./tracking-tags-well.css"

export function TrackingTagsPanel() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const addTag = useTimeTrackingStore((s) => s.addTag)
  const updateTag = useTimeTrackingStore((s) => s.updateTag)
  const removeTag = useTimeTrackingStore((s) => s.removeTag)
  const habits = useHabitsStore((s) => s.tasks)

  const [newTag, setNewTag] = useState("")
  const [editing, setEditing] = useState<TrackTag | null>(null)

  const habitsForTag = (tagId: string) =>
    habits.filter((habit) => activeTrackingLink(habit)?.tagIds.includes(tagId)).map((h) => h.name)

  const submitNew = () => {
    if (addTag(newTag)) setNewTag("")
  }

  return (
    <div
      className="trk-tags-well"
      data-ui-name="Tag library"
      data-ui-docs="components/Home/Tracking/README.md"
      role="region"
      aria-label="Tag library"
    >
      <span className="trk-silk">Tags</span>
      <span className="trk-tags-hint">Shared across views. Habits link tags to auto-count time.</span>

      <div className="trk-tags-keys" role="list">
        {tags.length === 0 && (
          <span className="trk-tags-empty" role="status">
            No tags yet.
          </span>
        )}
        {tags.map((tag) => {
          const penCount = penIdsForTags(scopes, [tag.id]).size
          const linked = habitsForTag(tag.id)
          const title = [
            `${penCount} pen${penCount === 1 ? "" : "s"}`,
            linked.length ? `feeds ${linked.join(", ")}` : "no habit linked",
          ].join(" · ")
          return (
            <span key={tag.id} role="listitem" title={title} className="trk-tag-key">
              <span className="trk-tag-bead" style={{ background: tag.color }} aria-hidden />
              <span className="trk-tag-name">{tag.name}</span>
              <span className="trk-tag-meta">
                {penCount} pen{penCount === 1 ? "" : "s"}
              </span>
              {linked.length > 0 && <Link2 className="trk-tag-link" aria-hidden />}
              <button
                type="button"
                onClick={() => setEditing({ ...tag })}
                className="trk-micro"
                aria-label={`Edit tag ${tag.name}`}
              >
                <Pencil />
              </button>
              <button
                type="button"
                onClick={() => {
                  const warn = linked.length
                    ? `Delete tag "${tag.name}"? ${linked.length} habit(s) will stop auto-counting this time.`
                    : `Delete tag "${tag.name}"?`
                  if (confirm(warn)) removeTag(tag.id)
                }}
                className="trk-micro trk-micro-danger"
                aria-label={`Delete tag ${tag.name}`}
              >
                <Trash2 />
              </button>
            </span>
          )
        })}
      </div>

      {editing ? (
        <div className="trk-tag-add">
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            aria-label="Tag name"
          />
          <ColorSwatch
            value={editing.color}
            onChange={(color) => setEditing({ ...editing, color })}
            aria-label="Tag color"
            size="sm"
          />
          <button
            type="button"
            onClick={() => {
              if (editing.name.trim()) updateTag({ ...editing, name: editing.name.trim() })
              setEditing(null)
            }}
          >
            Save tag
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="trk-tag-add">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submitNew()
              }
            }}
            placeholder="New tag"
            aria-label="New tag name"
          />
          <button type="button" disabled={!newTag.trim()} onClick={submitNew}>
            <Plus /> Add tag
          </button>
        </div>
      )}
    </div>
  )
}
