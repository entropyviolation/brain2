/**
 * components/Home/widgets/dash-face-registry.ts — Where Dash faces plug in
 *
 * The Dash style draws each kind with its own small face (`components/Home/
 * dash/`). Faces register here by kind id. A kind with no Dash face falls
 * back to its Milled tile, restyled. The face is only the glance: the cell
 * keeps the kind's tile mounted out of sight, so its detail dialog, gear,
 * and guide work the same in both styles.
 */
"use client"

import type { ComponentType } from "react"
import type { WidgetCopy, WidgetSettings, WidgetSize } from "@/lib/widgets/types"

export type DashFaceProps = {
  size: WidgetSize
  currentDate: Date
  settings: WidgetSettings
  copy: Pick<WidgetCopy, "id" | "kind" | "key" | "title" | "lamp" | "showFoot">
}

const FACES = new Map<string, ComponentType<DashFaceProps>>()

export function registerDashFaces(faces: Record<string, ComponentType<DashFaceProps>>): void {
  for (const [kind, face] of Object.entries(faces)) FACES.set(kind, face)
}

export function dashFaceFor(kind: string): ComponentType<DashFaceProps> | undefined {
  return FACES.get(kind)
}
