/**
 * components/Home/widgets/dashboard-cell.tsx — One copy's place on the dashboard
 *
 * The cell sets the copy's footprint, its lamp color, and whether the footer
 * shows. On Milled with no size picked, the cell steps aside (`display:
 * contents`) and the tile keeps today's CSS footprint exactly.
 *
 * Edit mode only: drag the grip (or the face) onto another face to move it,
 * pull the corner to resize (it snaps to the sizes the kind can draw), and ×
 * hides it. Keyboard: arrows move the focused copy, Shift+arrows resize.
 * A click on the face does not open the detail while editing.
 */
"use client"

import { useRef, useState, type ComponentType, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import type { DashFaceProps } from "@/components/Home/widgets/dash-face-registry"
import { parseSize, snapWidgetSize, widgetKind } from "@/lib/widgets/kinds"
import type { DashboardStyle, MilledSize, WidgetCopy, WidgetSize } from "@/lib/widgets/types"
import { cn } from "@/lib/utils"

type DragState = { kind: "move" | "resize"; startX: number; startY: number; width: number; height: number }

export function DashboardCell({
  copy,
  style,
  size,
  editing,
  index,
  onMoveTo,
  onStep,
  onResize,
  dashFace: DashFace,
  currentDate,
  onHide,
  children,
}: {
  copy: WidgetCopy
  style: DashboardStyle
  /** Dash cells, or the Milled size ("auto" keeps today's footprint). */
  size: WidgetSize | MilledSize
  editing: boolean
  index: number
  onMoveTo: (id: string, before: string | null, after: boolean) => void
  onStep: (direction: -1 | 1) => void
  onResize: (size: WidgetSize) => void
  /** The kind's Dash face; the tile then stays mounted out of sight for its detail. */
  dashFace?: ComponentType<DashFaceProps>
  currentDate?: Date
  /** Hide key for a Dash face, whose tile × sits out of sight. */
  onHide?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<WidgetSize | null>(null)
  const [dragging, setDragging] = useState(false)
  const kind = widgetKind(copy.kind)
  const footprint: WidgetSize | null =
    size === "auto" ? (editing ? (kind?.milledSize ?? "1x2") : null) : (size as WidgetSize)
  const shown = preview ?? footprint
  const [cols, rows] = shown ? parseSize(shown) : [0, 0]

  const unit = () => {
    const rect = ref.current?.getBoundingClientRect()
    const grid = ref.current?.parentElement
    const gap = grid ? parseFloat(getComputedStyle(grid).columnGap || "0") || 0 : 0
    const rowGap = grid ? parseFloat(getComputedStyle(grid).rowGap || "0") || 0 : 0
    if (!rect || !footprint) return { w: 100, h: 70, gap, rowGap }
    const [c, r] = parseSize(footprint)
    return { w: (rect.width - gap * (c - 1)) / c, h: (rect.height - rowGap * (r - 1)) / r, gap, rowGap }
  }

  const sizeFor = (dx: number, dy: number, start: DragState): WidgetSize => {
    const u = unit()
    const c = Math.max(1, Math.min(3, Math.round((start.width + dx + u.gap) / (u.w + u.gap))))
    const r = Math.max(1, Math.min(3, Math.round((start.height + dy + u.rowGap) / (u.h + u.rowGap))))
    if (style === "milled") {
      const want = `${c}x${r}`
      return (["1x1", "2x1", "1x2", "2x2", "3x1", "3x2", "1x3"] as WidgetSize[]).includes(want as WidgetSize)
        ? (want as WidgetSize)
        : snapWidgetSize(copy.kind, want)
    }
    return snapWidgetSize(copy.kind, `${c}x${r}`)
  }

  const begin = (event: PointerEvent<HTMLElement>, mode: DragState["kind"]) => {
    if (!editing || event.button !== 0) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    drag.current = { kind: mode, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height }
    if (mode === "move") setDragging(true)
  }

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current
    if (!state) return
    if (state.kind === "resize") {
      setPreview(sizeFor(event.clientX - state.startX, event.clientY - state.startY, state))
      return
    }
    const target = targetCell(event.clientX, event.clientY, copy.id)
    document.querySelectorAll(".vd-cell[data-drop]").forEach((node) => node.removeAttribute("data-drop"))
    if (target) target.el.setAttribute("data-drop", target.after ? "after" : "before")
  }

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current
    drag.current = null
    setDragging(false)
    document.querySelectorAll(".vd-cell[data-drop]").forEach((node) => node.removeAttribute("data-drop"))
    if (!state) return
    if (state.kind === "resize") {
      const next = sizeFor(event.clientX - state.startX, event.clientY - state.startY, state)
      setPreview(null)
      if (next !== footprint) onResize(next)
      return
    }
    const target = targetCell(event.clientX, event.clientY, copy.id)
    if (target) onMoveTo(copy.id, target.id, target.after)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editing || event.target !== event.currentTarget) return
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const step = arrows[event.key]
    if (!step) return
    event.preventDefault()
    if (event.shiftKey) {
      const [c, r] = parseSize(footprint ?? kind?.defaultSize ?? "1x1")
      const want = `${Math.max(1, Math.min(3, c + step[0]))}x${Math.max(1, Math.min(3, r + step[1]))}`
      const next = snapWidgetSize(copy.kind, want)
      if (next !== footprint) onResize(next)
      else if (style === "milled") onResize(want as WidgetSize)
      return
    }
    onStep(step[0] + step[1] < 0 ? -1 : 1)
    window.requestAnimationFrame(() => ref.current?.focus())
  }

  const name = copy.title.trim() || kind?.name || copy.kind

  return (
    <div
      ref={ref}
      className={cn("vd-cell", footprint == null && "is-auto", dragging && "is-dragging", preview && "is-resizing")}
      data-copy-id={copy.id}
      data-kind={copy.kind}
      data-size={shown ?? "auto"}
      data-lamp={copy.lamp}
      data-foot={copy.showFoot ? "on" : "off"}
      data-index={index}
      style={footprint ? { gridColumn: `span ${cols}`, gridRow: `span ${rows}` } : undefined}
      tabIndex={editing ? 0 : undefined}
      aria-label={editing ? `${name}. Arrows move, Shift and arrows resize.` : undefined}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (!editing) return
        const target = event.target as HTMLElement
        if (target.closest(".vd-edit-key, .home-tile-hide")) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (!editing || target.closest(".vd-edit-key, .home-tile-hide, .vd-resize")) return
        begin(event, "move")
      }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        setPreview(null)
      }}
    >
      {DashFace && shown ? (
        <>
          <button
            type="button"
            className="vd-face"
            aria-label={`Open ${name}`}
            onClick={() => {
              const host = ref.current?.querySelector(".vd-host")
              host?.querySelector<HTMLButtonElement>(".home-tile-open, .home-weather-open")?.click()
            }}
          >
            <DashFace
              size={shown}
              currentDate={currentDate ?? new Date()}
              settings={copy.settings}
              copy={{ id: copy.id, kind: copy.kind, key: copy.key, title: copy.title, lamp: copy.lamp, showFoot: copy.showFoot }}
            />
          </button>
          <div className="vd-host" hidden>
            {children}
          </div>
        </>
      ) : (
        children
      )}
      {editing ? (
        <>
          <span className="vd-grip" aria-hidden="true" title="Drag to move">
            ⠿
          </span>
          <span
            className="vd-resize vd-edit-key"
            role="presentation"
            title="Drag to resize"
            onPointerDown={(event) => begin(event, "resize")}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
          />
          {preview ? <span className="vd-size-badge">{preview}</span> : null}
          {DashFace && onHide ? (
            <button type="button" className="vd-hide vd-edit-key" aria-label={`Hide ${name}`} onClick={onHide}>
              ×
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** The cell under the pointer, and whether the drop lands after it. */
function targetCell(x: number, y: number, selfId: string): { id: string; el: HTMLElement; after: boolean } | null {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") return null
  for (const node of document.elementsFromPoint(x, y)) {
    const el = (node as HTMLElement).closest?.(".vd-cell") as HTMLElement | null
    if (!el) continue
    const id = el.dataset.copyId
    if (!id || id === selfId) continue
    const rect = el.getBoundingClientRect()
    return { id, el, after: x > rect.left + rect.width / 2 }
  }
  return null
}
