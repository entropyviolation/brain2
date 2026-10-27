/**
 * components/Home/Plan/use-plan-rail-drag.ts — Rail press + HTML5 drag
 *
 * HTML5 `dragstart` still writes `lib/plan-drag.ts`. If the host never starts
 * a native drag, pointer move + up drops onto `[data-plan-drop]` instead of
 * looking like a no-op.
 */
"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import {
  beginPlanDrag,
  consumePlanDragClick,
  finishPlanPointerDrag,
  notePlanPointerMove,
  onPlanPointerDrop,
  type PlanDragKind,
  type PlanPointerDropHandler,
  writePlanDrag,
} from "@/lib/plan-drag"

export function usePlanPointerDrop(handler: PlanPointerDropHandler): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => onPlanPointerDrop((...args) => handlerRef.current(...args)), [])
}

export function planRailDragProps(kind: Extract<PlanDragKind, "task" | "habit">, id: string, label: string) {
  return {
    draggable: true as const,
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
      writePlanDrag(e.dataTransfer, kind, id, label)
    },
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      beginPlanDrag(kind, id, label)
      const originX = e.clientX
      const originY = e.clientY
      const onMove = (ev: PointerEvent) => {
        notePlanPointerMove(ev.clientX, ev.clientY, originX, originY)
      }
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
        finishPlanPointerDrag(ev.clientX, ev.clientY)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    },
  }
}

export function ifNotPlanDragClick(fn: () => void): () => void {
  return () => {
    if (consumePlanDragClick()) return
    fn()
  }
}
