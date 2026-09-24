"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { GridEntry, IconPickerTarget } from "@/components/Lists/types"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import {
  freezeVelvetPositions,
  inferIconLayoutMode,
  layoutVelvetIconGrid,
  positionsForLocation,
  resolveVelvetIconPositions,
  velvetGridColumns,
  VELVET_GRID_FALLBACK_WIDTH,
  VELVET_ICON_CELL,
  type IconLayoutMode,
} from "@/components/Lists/lib/velvet-icon-grid"
import "./folder-view-icons-trail.css"

function renderEntryIcon(entry: GridEntry, px: number) {
  if ((entry.kind === "folder" || entry.kind === "folder-all") && !entry.icon)
    return <FolderGlyph size={px} color={entry.color} />
  const src = entry.kind === "smart" || entry.kind === "habits" || entry.kind === "objectives" ? orbFor(entry.id) : iconFor(entry.id, entry.icon)
  return <img className="fm-icon-img" src={src} alt="" draggable={false} loading="lazy" decoding="async" style={{ maxWidth: px, maxHeight: px }} />
}

function iconPosKey(entry: GridEntry) {
  return `${entry.kind}-${entry.id}`
}

type Pos = { x: number; y: number }
type PosMap = Record<string, Pos>

// --- Motion-trail tuning (cursor-angel / snowflake circuitry) ----------------
/** Discrete stamps behind each moving icon — not a full-window field. */
const NUM_STAMPS = 7
/** Spatial step between stamps along the path (px). */
const TRAIL_SPACING_PX = 16
/** Max trail length behind head (px). */
const MAX_TRAIL_DIST_PX = 112
/** Peak stamp opacity before age + trail fade. */
const STAMP_PEAK_OPACITY = 0.72
const MOVE_MS = 2100
/** Extra fade after icons land — stamps dissolve, then canvas clears. */
const TAIL_MS = 480
/** Stagger each icon's launch (ms). */
const STAGGER_MS = 38

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function posAtProgress(from: Pos, to: Pos, p: number): Pos {
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) }
}

/** True when the OS asks to skip decorative motion. Exported for tests. */
export function prefersOrganizeTrailReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface IconTrailState {
  delayMs: number
}

function stampOpacity(ageT: number, trailAlpha: number): number {
  return STAMP_PEAK_OPACITY * Math.pow(1 - clamp01(ageT), 2.2) * trailAlpha
}

/**
 * Walk backward along the eased spatial path from `headP`, placing samples
 * every TRAIL_SPACING_PX. Works at any velocity — no frame-history gaps.
 */
function buildSpatialTrail(
  from: Pos,
  to: Pos,
  headP: number,
  count: number,
): { pos: Pos; ageT: number; index: number }[] {
  if (headP <= 0.0001) return []
  const head = posAtProgress(from, to, headP)
  const out: { pos: Pos; ageT: number; index: number }[] = []

  for (let g = 0; g < count; g++) {
    const targetDist = (g + 1) * TRAIL_SPACING_PX
    if (targetDist > MAX_TRAIL_DIST_PX) break

    let lo = 0
    let hi = headP
    for (let iter = 0; iter < 24; iter++) {
      const mid = (lo + hi) * 0.5
      const pos = posAtProgress(from, to, mid)
      const d = Math.hypot(head.x - pos.x, head.y - pos.y)
      if (d < targetDist) lo = mid
      else hi = mid
    }

    const pos = posAtProgress(from, to, hi)
    const actualDist = Math.hypot(head.x - pos.x, head.y - pos.y)
    if (actualDist < 0.4) break
    out.push({ pos, ageT: actualDist / MAX_TRAIL_DIST_PX, index: g })
  }
  return out
}

/**
 * Classic Win95 arrow cursor (black outline, white fill) — cursor-angel register.
 * Hotspot at tip; drawn in device pixels so it stays crisp.
 */
function drawPixelCursor(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
  const tipX = Math.round(x + 28)
  const tipY = Math.round(y + 28)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(tipX, tipY)
  // Outline
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 15)
  ctx.lineTo(4, 12)
  ctx.lineTo(7, 18)
  ctx.lineTo(9, 17)
  ctx.lineTo(6, 11)
  ctx.lineTo(11, 11)
  ctx.closePath()
  ctx.fillStyle = "#000"
  ctx.fill()
  // Fill inset
  ctx.beginPath()
  ctx.moveTo(1, 2)
  ctx.lineTo(1, 13)
  ctx.lineTo(4, 11)
  ctx.lineTo(7, 16)
  ctx.lineTo(8, 15.5)
  ctx.lineTo(5, 10)
  ctx.lineTo(10, 10)
  ctx.closePath()
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.restore()
}

/**
 * Six-point snowflake pad — snowflake-circuitry register (sparse nodes, not a storm).
 */
function drawSnowflakeStamp(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
  const cx = Math.round(x + 30)
  const cy = Math.round(y + 30)
  const r = 7
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = "rgba(210, 235, 255, 0.95)"
  ctx.fillStyle = "rgba(180, 220, 255, 0.55)"
  ctx.lineWidth = 1
  ctx.lineCap = "square"
  // Hub pad
  ctx.beginPath()
  ctx.arc(cx, cy, 1.6, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    const x2 = cx + Math.cos(a) * r
    const y2 = cy + Math.sin(a) * r
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    // Tiny pad at tip
    ctx.beginPath()
    ctx.arc(x2, y2, 1.1, 0, Math.PI * 2)
    ctx.fill()
    // Mid spur
    const mx = cx + Math.cos(a) * (r * 0.55)
    const my = cy + Math.sin(a) * (r * 0.55)
    const perp = a + Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(mx - Math.cos(perp) * 2.2, my - Math.sin(perp) * 2.2)
    ctx.lineTo(mx + Math.cos(perp) * 2.2, my + Math.sin(perp) * 2.2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawTrailStamp(
  ctx: CanvasRenderingContext2D,
  pos: Pos,
  ageT: number,
  trailAlpha: number,
  stampIndex: number,
) {
  const op = stampOpacity(ageT, trailAlpha)
  if (op < 0.02) return
  // Alternate cursor-angel / snowflake circuitry along the path.
  if (stampIndex % 2 === 0) drawPixelCursor(ctx, pos.x, pos.y, op)
  else drawSnowflakeStamp(ctx, pos.x, pos.y, op)
}

/**
 * Organize motion: brief anticipation, then smooth deceleration into slot.
 * No overshoot — animation must end exactly at destination.
 */
function organizeProgress(rawT: number): number {
  const t = clamp01(rawT)
  const ANT = 0.07
  if (t < ANT) {
    return -0.012 * Math.sin((t / ANT) * Math.PI)
  }
  const p = (t - ANT) / (1 - ANT)
  return 1 - Math.pow(1 - p, 4)
}

export interface FolderViewIconsProps {
  location: string
  entries: GridEntry[]
  isHome: boolean
  selectMode: boolean
  selectedCategories: string[]
  activeIconId: string | null
  dropTargetId: string | null
  homePinned: string[]
  iconPositions: Record<string, { x: number; y: number }>
  /** Persisted auto vs freeform for this location. Missing infers from coords. */
  iconLayoutMode?: IconLayoutMode
  organizeEpoch?: number
  organizeFromSnapshot?: PosMap | null
  onOrganizeAnimationEnd?: () => void
  setIconPosition: (location: string, key: string, x: number, y: number) => void
  /** Persist a full snapshot and set auto/freeform without a layout-mode fight. */
  commitIconLayout?: (location: string, positions: PosMap, mode: IconLayoutMode) => void
  setActiveIconId: (id: string) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setDropTargetId: React.Dispatch<React.SetStateAction<string | null>>
  openEntry: (entry: GridEntry) => void
  onFileCategoryOnEntry: (categoryId: string, target: GridEntry) => void
  toggleHomePin: (id: string) => void
  setIconPickerFor: (target: IconPickerTarget) => void
  openNewCategoryDialog: () => void
  onCanvasWidth?: (width: number) => void
}

interface ActiveDrag {
  key: string
  kind: GridEntry["kind"]
  id: string
  startX: number
  startY: number
  origX: number
  origY: number
}

interface OrganizeAnim {
  entries: { entry: GridEntry; index: number }[]
  from: PosMap
  to: PosMap
}

interface TrailNode {
  head: HTMLDivElement | null
}

export function FolderViewIcons({
  location,
  entries,
  isHome,
  selectMode,
  selectedCategories,
  activeIconId,
  dropTargetId,
  homePinned,
  iconPositions,
  iconLayoutMode,
  organizeEpoch = 0,
  organizeFromSnapshot = null,
  onOrganizeAnimationEnd,
  setIconPosition,
  commitIconLayout,
  setActiveIconId,
  setSelectedCategories,
  setDropTargetId,
  openEntry,
  onFileCategoryOnEntry,
  toggleHomePin,
  setIconPickerFor,
  openNewCategoryDialog,
  onCanvasWidth,
}: FolderViewIconsProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(VELVET_GRID_FALLBACK_WIDTH)

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const apply = () => {
      // clientWidth excludes the scrollbar — that's the packing width.
      const w = Math.round(el.clientWidth)
      const next = w >= 80 ? w : VELVET_GRID_FALLBACK_WIDTH
      setCanvasWidth(next)
      onCanvasWidth?.(next)
    }
    apply()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onCanvasWidth])

  const entryKeys = useMemo(() => entries.map((e) => iconPosKey(e)), [entries])
  const savedHere = useMemo(
    () => positionsForLocation(iconPositions, location, entryKeys),
    [iconPositions, location, entryKeys],
  )
  const layoutMode = inferIconLayoutMode(entryKeys, savedHere, iconLayoutMode)

  // Live freeze while a drag is in flight — siblings never go back through auto-pack.
  const [dragFreeze, setDragFreeze] = useState<PosMap | null>(null)
  const dragFreezeRef = useRef<PosMap | null>(null)
  dragFreezeRef.current = dragFreeze

  const packingWidth = canvasWidth
  const positions = useMemo<PosMap>(() => {
    if (dragFreeze) return dragFreeze
    return resolveVelvetIconPositions(entryKeys, packingWidth, savedHere, layoutMode)
  }, [entryKeys, savedHere, packingWidth, layoutMode, dragFreeze])

  // Previous render's positions — the "from" of an auto-organize sweep.
  const prevPositionsRef = useRef<PosMap>(positions)

  // --- Pointer-based free dragging (all icon kinds) -------------------------
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<Pos | null>(null)
  const dragRef = useRef<ActiveDrag | null>(null)
  const movedRef = useRef(false)
  const dropTargetRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragPosRef = useRef<Pos | null>(null)
  dragPosRef.current = dragPos

  const handleIconClick = useCallback(
    (entry: GridEntry, isSel: boolean) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      clickTimerRef.current = setTimeout(() => {
        setActiveIconId(entry.id)
        if (selectMode && entry.kind === "list") {
          setSelectedCategories((prev) => (isSel ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]))
        }
        clickTimerRef.current = null
      }, 220)
    },
    [selectMode, setActiveIconId, setSelectedCategories],
  )

  const handleIconDoubleClick = useCallback(
    (entry: GridEntry) => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
      if (!selectMode) openEntry(entry)
    },
    [openEntry, selectMode],
  )

  const beginPointerDrag = useCallback(
    (entry: GridEntry, e: React.MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest(".fm-icon-pin, .fm-icon-edit")) return
      if (selectMode && entry.kind === "list") return

      const key = iconPosKey(entry)
      const origin = positions[key] ?? { x: 16, y: 16 }
      dragRef.current = {
        key,
        kind: entry.kind,
        id: entry.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: origin.x,
        origY: origin.y,
      }
      movedRef.current = false
      dropTargetRef.current = null

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const dx = ev.clientX - drag.startX
        const dy = ev.clientY - drag.startY
        if (!movedRef.current) {
          if (Math.hypot(dx, dy) <= 4) return
          movedRef.current = true
          setDragKey(drag.key)
          // Freeze EVERY icon at its current visual slot, then move only this one.
          // Auto-pack / CSS-grid must not reflow siblings for the rest of the drag.
          const originMap = { ...positions }
          const first = { x: Math.max(0, drag.origX + dx), y: Math.max(0, drag.origY + dy) }
          const frozen = freezeVelvetPositions(originMap, drag.key, first)
          dragFreezeRef.current = frozen
          setDragFreeze(frozen)
          commitIconLayout?.(location, frozen, "freeform")
        }
        const next = { x: Math.max(0, drag.origX + dx), y: Math.max(0, drag.origY + dy) }
        setDragPos(next)

        if (drag.kind === "list") {
          const under =
            typeof document.elementFromPoint === "function"
              ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-icon-entry]")
              : null
          const targetKind = under?.dataset.kind
          const targetId = under?.dataset.id ?? null
          if (under && (targetKind === "folder" || targetKind === "folder-all") && targetId !== drag.id) {
            dropTargetRef.current = targetId
            setDropTargetId(targetId)
          } else {
            dropTargetRef.current = null
            setDropTargetId(null)
          }
        }
      }

      const onUp = () => {
        const drag = dragRef.current
        if (drag && movedRef.current) {
          suppressClickRef.current = true
          const target = dropTargetRef.current
          if (drag.kind === "list" && target) {
            const targetEntry = entries.find(
              (en) => en.id === target && (en.kind === "folder" || en.kind === "folder-all"),
            )
            if (targetEntry) {
              onFileCategoryOnEntry(drag.id, targetEntry)
            } else if (dragPosRef.current) {
              setIconPosition(location, drag.key, dragPosRef.current.x, dragPosRef.current.y)
            }
          } else if (dragPosRef.current) {
            setIconPosition(location, drag.key, dragPosRef.current.x, dragPosRef.current.y)
          }
        }
        dragRef.current = null
        dropTargetRef.current = null
        setDragKey(null)
        setDragPos(null)
        setDragFreeze(null)
        dragFreezeRef.current = null
        setDropTargetId(null)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }

      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [commitIconLayout, entries, location, onFileCategoryOnEntry, positions, selectMode, setDropTargetId, setIconPosition],
  )

  // --- Auto-organize: cursor/snowflake canvas trace + DOM heads -------------
  const [organize, setOrganize] = useState<OrganizeAnim | null>(null)
  const trailNodesRef = useRef<Record<string, TrailNode>>({})
  const trailStateRef = useRef<Record<string, IconTrailState>>({})
  const trailCanvasRef = useRef<HTMLCanvasElement>(null)
  const onOrganizeEndRef = useRef(onOrganizeAnimationEnd)
  onOrganizeEndRef.current = onOrganizeAnimationEnd

  useEffect(() => {
    if (!organizeEpoch) return
    const from = organizeFromSnapshot ?? { ...prevPositionsRef.current }
    const keys = entries.map((e) => iconPosKey(e))
    const to = layoutVelvetIconGrid(keys, canvasWidth)
    const moving = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        const key = iconPosKey(entry)
        const a = from[key]
        const b = to[key]
        return a && b && (Math.abs(a.x - b.x) >= 1 || Math.abs(a.y - b.y) >= 1)
      })
    // Final grid already committed by the parent — reduced motion skips the trace only.
    if (moving.length === 0 || prefersOrganizeTrailReduced()) {
      onOrganizeEndRef.current?.()
      return
    }
    trailNodesRef.current = {}
    trailStateRef.current = {}
    setOrganize({ entries: moving, from, to })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizeEpoch])

  useLayoutEffect(() => {
    if (!organize) return
    let raf = 0
    let cancelled = false
    const start = performance.now()
    const canvas = trailCanvasRef.current
    const grid = canvas?.parentElement
    if (!canvas || !grid) return

    const rect = grid.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.ceil(rect.width * dpr)
    canvas.height = Math.ceil(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // Crisp pixel cursors — no image smoothing on stamps.
    ctx.imageSmoothingEnabled = false

    for (const { entry, index } of organize.entries) {
      const key = iconPosKey(entry)
      trailStateRef.current[key] = {
        delayMs: index * STAGGER_MS,
      }
    }

    const maxT = MOVE_MS + TAIL_MS + organize.entries.length * STAGGER_MS

    const frame = (now: number) => {
      if (cancelled) return
      const t = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.imageSmoothingEnabled = false

      for (const { entry } of organize.entries) {
        const key = iconPosKey(entry)
        const node = trailNodesRef.current[key]
        const state = trailStateRef.current[key]
        if (!node || !state) continue

        const from = organize.from[key]
        const to = organize.to[key]
        const localT = t - state.delayMs
        if (localT < 0) continue

        const moveT = clamp01(localT / MOVE_MS)
        const trailAlpha = localT <= MOVE_MS ? 1 : clamp01(1 - (localT - MOVE_MS) / TAIL_MS)
        const p = organizeProgress(moveT)
        const head = posAtProgress(from, to, p)

        const trail = buildSpatialTrail(from, to, p, NUM_STAMPS)
        for (let i = trail.length - 1; i >= 0; i--) {
          const { pos, ageT, index } = trail[i]
          drawTrailStamp(ctx, pos, ageT, trailAlpha, index)
        }

        if (node.head) {
          node.head.style.transform = `translate3d(${head.x}px, ${head.y}px, 0)`
        }
      }

      if (t < maxT) {
        raf = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height)
        setOrganize(null)
        onOrganizeEndRef.current?.()
      }
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [organize])

  useEffect(() => {
    prevPositionsRef.current = positions
  }, [positions])

  const organizingKeys = useMemo(() => {
    if (!organize) return null
    const set = new Set<string>()
    for (const entry of organize.entries) set.add(iconPosKey(entry.entry))
    return set
  }, [organize])

  const getRenderPosition = (entry: GridEntry): Pos => {
    const key = iconPosKey(entry)
    if (dragKey === key && dragPos) return dragPos
    return positions[key] ?? { x: 16, y: 16 }
  }

  const rows = Math.max(1, Math.ceil(entries.length / velvetGridColumns(canvasWidth)))
  const gridMinHeight = Math.max(480, rows * VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2)
  const paintMode: IconLayoutMode = dragFreeze || dragKey ? "freeform" : layoutMode

  return (
    <div
      ref={canvasRef}
      key={`icons-${location}`}
      className="fm-sunken fm-desktop velvet fm-icon-canvas"
      data-icon-pack={paintMode}
    >
      <div
        className="fm-icon-grid fm-icon-grid-free"
        style={{ position: "relative", minHeight: gridMinHeight, width: "100%" }}
      >
        {/* Ephemeral cursor / snowflake stamps along the sweep — not layout. */}
        {organize && (
          <canvas ref={trailCanvasRef} className="fm-organize-trace" aria-hidden data-organize-trace />
        )}

        {organize &&
          organize.entries.map(({ entry }) => {
            const key = iconPosKey(entry)
            const from = organize.from[key]
            if (!trailNodesRef.current[key]) trailNodesRef.current[key] = { head: null }
            const node = trailNodesRef.current[key]
            return (
              <div key={`trail-${key}`} aria-hidden>
                <div
                  ref={(el) => {
                    node.head = el
                  }}
                  className="fm-organize-trace-head"
                  style={{ transform: `translate3d(${from.x}px, ${from.y}px, 0)` }}
                >
                  <div className="fm-icon-img-wrap">{renderEntryIcon(entry, 60)}</div>
                </div>
              </div>
            )
          })}

        {entries.map((entry) => {
          const pos = getRenderPosition(entry)
          const key = iconPosKey(entry)
          const isSel = selectedCategories.includes(entry.id)
          const isActive = activeIconId === entry.id
          const pinned = homePinned.includes(entry.id)
          const isDragging = dragKey === key
          const hiddenForTrail = !!organizingKeys?.has(key)
          return (
            <div
              key={`${entry.kind}-${entry.id}`}
              data-icon-entry
              data-kind={entry.kind}
              data-id={entry.id}
              className={`fm-icon fm-icon-free${isDragging ? " fm-icon-dragging" : ""}${isActive || isSel ? " selected" : ""}${dropTargetId === entry.id ? " drop-target" : ""}`}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                visibility: hiddenForTrail ? "hidden" : undefined,
              }}
              onMouseDown={(e) => beginPointerDrag(entry, e)}
              title={`${entry.name} (drag to move, double-click to open)`}
              onClick={() => handleIconClick(entry, isSel)}
              onDoubleClick={() => handleIconDoubleClick(entry)}
            >
              {entry.kind !== "smart" && entry.kind !== "folder-all" && (
                <button
                  className={`fm-icon-pin${pinned ? " pinned" : ""}`}
                  title={pinned ? "Remove from Home" : "Add to Home"}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleHomePin(entry.id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ★
                </button>
              )}
              {entry.kind === "list" && (
                <button
                  className="fm-icon-edit"
                  title="Change icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIconPickerFor({ kind: "category", id: entry.id })
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ✎
                </button>
              )}
              {entry.kind === "folder" && (
                <button
                  className="fm-icon-edit"
                  title="Change icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIconPickerFor({ kind: "folder", id: entry.id })
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ✎
                </button>
              )}
              <div className="fm-icon-img-wrap">
                {renderEntryIcon(entry, 60)}
                {entry.color && entry.kind !== "folder-all" && <span className="fm-icon-swatch" style={{ background: entry.color }} />}
              </div>
              <span className="fm-icon-label">
                {entry.name}
                {entry.count > 0 ? ` (${entry.count})` : ""}
              </span>
            </div>
          )
        })}
        {entries.length === 0 && (
          <div className="fm-empty" style={{ color: "#fff", textShadow: "0 1px 2px #000" }}>
            <FolderGlyph size={48} />
            <p>{isHome ? "Pin lists/folders here, or create one." : "This location is empty."}</p>
            <button className="fm-btn fm-btn-sm" onClick={openNewCategoryDialog}>
              Create a list
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
