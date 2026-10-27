/**
 * components/Home/Tracking/ghost-layers.ts — Ghost (superimpose) layers for the plots
 *
 * Day, Week, and Infinite each draw zero or more faint other views under the
 * active one. Single mode is at most one; Multi mode is this view's list.
 * `opacity` is set only while Advanced is on. This file resolves the scopes and
 * names a ghost block for the hover probe. It does not paint or write entries.
 */
"use client"

import { useMemo } from "react"
import { displayedPen, type TimeEntry, type TrackScope } from "@/lib/time-tracking-store"
import { entryDisplayName } from "@/lib/time-entries"
import { useSuperimposeLayers } from "@/components/Home/Tracking/tracking-view-prefs"
import type { ProbeLayer } from "@/components/Home/Tracking/trk-instrument"

export type GhostScope = {
  scope: TrackScope
  /** Wash opacity while Advanced is on. Undefined keeps the stock wash. */
  opacity?: number
}

export function useGhostScopes(scope: TrackScope | undefined, scopes: readonly TrackScope[]): GhostScope[] {
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])
  const layers = useSuperimposeLayers(scope?.id, scopeIds)
  return useMemo(() => {
    const out: GhostScope[] = []
    for (const layer of layers) {
      const ghost = scopes.find((s) => s.id === layer.scopeId)
      if (ghost) out.push({ scope: ghost, opacity: layer.opacity })
    }
    return out
  }, [layers, scopes])
}

/** `data-superimpose` value: ghost ids joined by a space, or undefined when off. */
export function ghostAttr(ghosts: readonly GhostScope[]): string | undefined {
  return ghosts.length ? ghosts.map((ghost) => ghost.scope.id).join(" ") : undefined
}

/** One probe line for a block on a view: `Location: Home 8:00 AM–12:00 PM`. */
export function probeLayerFor(view: TrackScope, entry: TimeEntry | null | undefined): ProbeLayer | null {
  if (!entry) return null
  const leaf = view.pens.find((pen) => pen.id === entry.penId)
  const shown = displayedPen(view, entry.penId)
  return {
    view: view.name,
    name: entryDisplayName(entry, leaf?.name || shown?.name),
    startMin: entry.startMin,
    endMin: entry.endMin,
  }
}
