/**
 * components/Home/Tracking/entry-dialog/entry-tags.tsx — Tags on this block
 *
 * A block tag is not a pen tag: these minutes can count as something the pen
 * does not always count as. No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CatalogTagChip } from "@/components/Home/Tracking/catalog-tag-chip"
import { TAG_OPEN_TITLE } from "@/components/Home/Tracking/open-tag-settings"
import type { TrackPen, TrackTag } from "@/lib/time-tracking-store"

export function EntryTags({
  tags,
  penTagIds,
  tagIds,
  assignedPens,
  penTags,
  newTag,
  pen,
  extraTagIds,
  extraTagNames,
  onToggleTag,
  onNewTag,
  onCreateTag,
  onPromote,
}: {
  tags: TrackTag[]
  penTagIds: string[]
  tagIds: string[]
  assignedPens: TrackPen[]
  penTags: TrackTag[]
  newTag: string
  pen: TrackPen | undefined
  extraTagIds: string[]
  extraTagNames: string
  onToggleTag: (tagId: string, always: boolean) => void
  onNewTag: (value: string) => void
  onCreateTag: () => void
  onPromote: () => void
}) {
  return (
    // A tag on a block, not on the pen: four hours at the zoo were also
    // four hours of walking, without every zoo visit becoming exercise.
    <div className="trk-section space-y-1.5">
      <Label className="trk-section-title">Also counts as</Label>
      <p className="trk-help">
        Tags decide which habits this time feeds, across every scope.{" "}
        {assignedPens.length
          ? assignedPens.map((p) => p.name).join(" + ")
          : "This block"}{" "}
        always counts as {penTags.length ? penTags.map((t) => t.name).join(", ") : "nothing yet"}.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const always = penTagIds.includes(tag.id)
          const on = always || tagIds.includes(tag.id)
          return (
            <CatalogTagChip
              key={tag.id}
              tag={tag}
              pressed={on}
              aria-label={`Tag: ${tag.name}`}
              title={always ? `Assigned pens always count as ${tag.name}. ${TAG_OPEN_TITLE}` : TAG_OPEN_TITLE}
              className={`trk-tag${always ? " opacity-85" : ""}`}
              onClick={() => onToggleTag(tag.id, always)}
              mark={always ? <span className="trk-tag-always">always</span> : undefined}
            />
          )
        })}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={newTag}
          onChange={(e) => onNewTag(e.target.value)}
          placeholder="New tag…"
          aria-label="New tag for this block"
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            onCreateTag()
          }}
        />
        <button type="button" className="trk-entry-key is-compact" data-no95="" onClick={onCreateTag} disabled={!newTag.trim()}>
          Add tag
        </button>
      </div>
      {pen && extraTagIds.length > 0 && (
        <button
          type="button"
          className="trk-entry-key is-compact"
          data-no95=""
          onClick={onPromote}
        >
          Always tag {pen.name} as {extraTagNames}
        </button>
      )}
    </div>
  )
}
