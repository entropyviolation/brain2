/**
 * components/Home/Tracking/entry-dialog/entry-pen-block.tsx — Pens on this block
 *
 * The root is `BlockPenSection`. Naming a Company group switches the pen,
 * clears secondaries, and ticks the member variants in the same turn, reading
 * the store after `addPenGroup`. No hooks.
 */
"use client"

import { BlockPenSection } from "@/components/Home/Tracking/block-editor/block-pen-section"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { useTimeTrackingStore, type TimeEntry, type TrackScope, type TrackTag } from "@/lib/time-tracking-store"
import type { PenSortMode } from "@/lib/pen-sort"

export function EntryPenBlock({
  scope,
  entry,
  tags,
  penId,
  secondaryPenIds,
  penSort,
  onPrimary,
  onSecondaries,
  onCreate,
  addPenGroup,
  onNamedGroup,
}: {
  scope: TrackScope
  entry: TimeEntry
  tags: TrackTag[]
  penId: string
  secondaryPenIds: string[]
  penSort: PenSortMode
  onPrimary: (id: string) => void
  onSecondaries: (ids: string[]) => void
  onCreate: (name: string, color: string) => string | void
  addPenGroup: (scopeId: string, name: string, color: string, memberIds: string[]) => string | void
  onNamedGroup: (groupId: string, ticked: string[]) => void
}) {
  return (
    <BlockPenSection
      pens={scope.pens}
      tags={tags}
      primaryId={penId}
      secondaryPenIds={secondaryPenIds}
      onPrimary={onPrimary}
      onSecondaries={onSecondaries}
      onCreate={onCreate}
      onOpenPen={(id) => openPenSettings(entry.scopeId, id)}
      sortMode={penSort}
      onNameGroup={
        entry.scopeId === COMPANY_SCOPE_ID
          ? (name, color, memberIds) => {
              const groupId = addPenGroup(scope.id, name, color, memberIds)
              if (!groupId) return
              const group = useTimeTrackingStore
                .getState()
                .scopes.find((s) => s.id === scope.id)
                ?.pens.find((p) => p.id === groupId)
              const ticked = (group?.variants ?? [])
                .filter((v) => v.penId && memberIds.includes(v.penId))
                .map((v) => v.id)
              onNamedGroup(groupId, ticked)
            }
          : undefined
      }
    />
  )
}
