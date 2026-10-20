/**
 * components/Home/widgets/copy-context.tsx — The installed copy a tile is drawing
 *
 * The Visual dashboard wraps each tile in `WidgetCopyProvider`, so the tile,
 * its × key, and its detail dialog (gear, guide, title) all read the same
 * copy. Outside the dashboard (the gallery's samples, older tests) there is
 * no copy, and every hook falls back to the kind's defaults, so a tile still
 * draws exactly as it did before copies existed.
 */
"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { widgetKind } from "@/lib/widgets/kinds"
import type { DashboardStyle, WidgetCopy, WidgetSettings, WidgetSize } from "@/lib/widgets/types"

export type WidgetCopyFrame = {
  copy: WidgetCopy
  style: DashboardStyle
  /** Dash cells, or null on Milled's own footprint. */
  size: WidgetSize | null
  editing: boolean
}

const WidgetCopyContext = createContext<WidgetCopyFrame | null>(null)

export function WidgetCopyProvider({ frame, children }: { frame: WidgetCopyFrame; children: ReactNode }) {
  return <WidgetCopyContext.Provider value={frame}>{children}</WidgetCopyContext.Provider>
}

/** The copy being drawn, or null outside the dashboard. */
export function useWidgetFrame(): WidgetCopyFrame | null {
  return useContext(WidgetCopyContext)
}

/**
 * One setting of the copy being drawn, with the kind's default as fallback.
 * Reads the live store so the face changes the moment the gear saves.
 */
export function useCopySetting<T extends string | number | boolean>(key: string, fallback: T): T {
  const frame = useContext(WidgetCopyContext)
  const live = useDashboardStore((s) =>
    frame ? s.copies.find((copy) => copy.id === frame.copy.id)?.settings[key] : undefined,
  )
  const value = live ?? frame?.copy.settings[key]
  if (value === undefined) {
    const field = frame ? widgetKind(frame.copy.kind)?.settings.find((entry) => entry.key === key) : undefined
    return (field?.default as T | undefined) ?? fallback
  }
  return typeof value === typeof fallback ? (value as T) : fallback
}

/** Save settings on the copy being drawn. A no-op outside the dashboard. */
export function useCopySettingsWriter(): (patch: WidgetSettings) => void {
  const frame = useContext(WidgetCopyContext)
  const update = useDashboardStore((s) => s.updateCopySettings)
  return (patch) => {
    if (frame) update(frame.copy.id, patch)
  }
}

/** The face's caption: the copy's own title when it has one, else the tile's default. */
export function CopyCaption({ children }: { children: ReactNode }) {
  const frame = useContext(WidgetCopyContext)
  const title = useDashboardStore((s) =>
    frame ? s.copies.find((copy) => copy.id === frame.copy.id)?.title : undefined,
  )
  const own = (title ?? frame?.copy.title ?? "").trim()
  return <>{own || children}</>
}

/** True when the face should show its footer line. */
export function useCopyShowsFoot(): boolean {
  const frame = useContext(WidgetCopyContext)
  const live = useDashboardStore((s) =>
    frame ? s.copies.find((copy) => copy.id === frame.copy.id)?.showFoot : undefined,
  )
  return live ?? frame?.copy.showFoot ?? true
}
