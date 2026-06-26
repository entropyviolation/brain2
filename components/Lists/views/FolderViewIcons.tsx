"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { GridEntry, IconPickerTarget } from "@/components/Lists/types"
import { PRESET_ICON_POSITIONS } from "@/components/Lists/constants"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { hashIconSlot } from "@/lib/string-utils"
import { computeIconGridPositions } from "@/lib/lists-icon-grid"

function renderEntryIcon(entry: GridEntry, px: number) {
  if ((entry.kind === "folder" || entry.kind === "folder-all") && !entry.icon)
    return <FolderGlyph size={px} color={entry.color} />
  const src = entry.kind === "smart" || entry.kind === "habits" || entry.kind === "objectives" ? orbFor(entry.id) : iconFor(entry.id, entry.icon)
  return <img className="fm-icon-img" src={src} alt="" draggable={false} style={{ maxWidth: px, maxHeight: px }} />
}

function iconPosKey(entry: GridEntry) {
  return `${entry.kind}-${entry.id}`
}

type Pos = { x: number; y: number }
type PosMap = Record<string, Pos>

// --- Motion-trail tuning -----------------------------------------------------
const NUM_GHOSTS = 22
/** Spatial step between smear samples — sub-icon overlap for fusion. */
const TRAIL_SPACING_PX = 1
/** Max smear length behind head (px). */
const MAX_TRAIL_DIST_PX = 22
/** Peak per-stamp opacity — canvas alpha blends accumulate into smear. */
const GHOST_PEAK_OPACITY = 0.055
const MOVE_MS = 2100
const TAIL_MS = 120
/** Stagger each icon's launch (ms). */
const STAGGER_MS = 38
const ICON_DRAW = 56

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function posAtProgress(from: Pos, to: Pos, p: number): Pos {
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) }
}


interface IconTrailState {
  delayMs: number
}

function rasterIconSrc(entry: GridEntry): string {
  if (entry.kind === "smart" || entry.kind === "habits" || entry.kind === "objectives") return orbFor(entry.id)
  return iconFor(entry.id, entry.icon)
}

async function loadIconImages(entryList: GridEntry[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  await Promise.all(
    entryList.map(async (entry) => {
      const key = iconPosKey(entry)
      const img = new Image()
      img.src = rasterIconSrc(entry)
      try {
        await img.decode()
      } catch {
        /* ignore broken image */
      }
      map.set(key, img)
    }),
  )
  return map
}

/** Steep smear falloff — tail vanishes almost immediately. */
function ghostOpacity(ageT: number, trailAlpha: number): number {
  return GHOST_PEAK_OPACITY * Math.pow(1 - clamp01(ageT), 6) * trailAlpha
}

/**
 * Walk backward along the eased spatial path from `headP`, placing samples
 * every TRAIL_SPACING_PX. Works at any velocity — no frame-history gaps.
 */
function buildSpatialSmear(
  from: Pos,
  to: Pos,
  headP: number,
  count: number,
): { pos: Pos; ageT: number }[] {
  if (headP <= 0.0001) return []
  const head = posAtProgress(from, to, headP)
  const out: { pos: Pos; ageT: number }[] = []

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
    out.push({ pos, ageT: actualDist / MAX_TRAIL_DIST_PX })
  }
  return out
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
  organizeEpoch?: number
  organizeFromSnapshot?: PosMap | null
  onOrganizeAnimationEnd?: () => void
  setIconPosition: (location: string, key: string, x: number, y: number) => void
  setActiveIconId: (id: string) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setDropTargetId: React.Dispatch<React.SetStateAction<string | null>>
  openEntry: (entry: GridEntry) => void
  onFileCategoryOnEntry: (categoryId: string, target: GridEntry) => void
  toggleHomePin: (id: string) => void
  setIconPickerFor: (target: IconPickerTarget) => void
  openNewCategoryDialog: () => void
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
  organizeEpoch = 0,
  organizeFromSnapshot = null,
  onOrganizeAnimationEnd,
  setIconPosition,
  setActiveIconId,
  setSelectedCategories,
  setDropTargetId,
  openEntry,
  onFileCategoryOnEntry,
  toggleHomePin,
  setIconPickerFor,
  openNewCategoryDialog,
}: FolderViewIconsProps) {
  // Resolved position for every entry at the current location.
  const positions = useMemo<PosMap>(() => {
    const map: PosMap = {}
    for (const entry of entries) {
      const key = iconPosKey(entry)
      map[key] = iconPositions[`${location}:${key}`] ?? PRESET_ICON_POSITIONS[key] ?? hashIconSlot(key)
    }
    return map
  }, [entries, iconPositions, location])

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
        }
        const next = { x: Math.max(0, drag.origX + dx), y: Math.max(0, drag.origY + dy) }
        setDragPos(next)

        if (drag.kind === "list") {
          const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-icon-entry]")
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
        setDropTargetId(null)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }

      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [entries, location, onFileCategoryOnEntry, positions, selectMode, setDropTargetId, setIconPosition],
  )

  // --- Auto-organize: canvas smear + DOM heads ------------------------------
  const [organize, setOrganize] = useState<OrganizeAnim | null>(null)
  const trailNodesRef = useRef<Record<string, TrailNode>>({})
  const trailStateRef = useRef<Record<string, IconTrailState>>({})
  const smearCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!organizeEpoch) return
    const from = organizeFromSnapshot ?? { ...prevPositionsRef.current }
    const entryKeys = entries.map((e) => iconPosKey(e))
    const to = computeIconGridPositions(entryKeys)
    const moving = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        const key = iconPosKey(entry)
        const a = from[key]
        const b = to[key]
        return a && b && (Math.abs(a.x - b.x) >= 1 || Math.abs(a.y - b.y) >= 1)
      })
    if (moving.length === 0) return
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
    const canvas = smearCanvasRef.current
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

      for (const { entry } of organize.entries) {
        const key = iconPosKey(entry)
        const node = trailNodesRef.current[key]
        const state = trailStateRef.current[key]
        const img = iconImages.get(key)
        if (!node || !state || !img) continue

        const from = organize.from[key]
        const to = organize.to[key]
        const localT = t - state.delayMs
        if (localT < 0) continue

        const moveT = clamp01(localT / MOVE_MS)
        const trailAlpha = localT <= MOVE_MS ? 1 : clamp01(1 - (localT - MOVE_MS) / TAIL_MS)
        const p = organizeProgress(moveT)
        const head = posAtProgress(from, to, p)

        const smear = buildSpatialSmear(from, to, p, NUM_GHOSTS)
        for (let i = smear.length - 1; i >= 0; i--) {
          const { pos, ageT } = smear[i]
          const op = ghostOpacity(ageT, trailAlpha)
          if (op < 0.002) continue
          ctx.save()
          ctx.globalAlpha = op
          ctx.filter = `blur(${0.35 + ageT * 2}px)`
          ctx.translate(pos.x + 4, pos.y + 4)
          ctx.drawImage(img, 0, 0, ICON_DRAW, ICON_DRAW)
          ctx.restore()
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
        onOrganizeAnimationEnd?.()
      }
    }

    let iconImages = new Map<string, HTMLImageElement>()
    void loadIconImages(organize.entries.map((e) => e.entry)).then((imgs) => {
      if (cancelled) return
      iconImages = imgs
      raf = requestAnimationFrame(frame)
    })

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

  return (
    <div key={`icons-${location}`} className="fm-sunken fm-desktop velvet fm-icon-canvas">
      <div
        className="fm-icon-grid fm-icon-grid-free"
        style={{ position: "relative", minHeight: Math.max(480, Math.ceil(entries.length / 8) * 100 + 32), width: "100%" }}
      >
        {/* Canvas smear layer — alpha-blended draws fuse into motion streak. */}
        {organize && <canvas ref={smearCanvasRef} className="fm-trail-canvas" aria-hidden />}

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
                  className="fm-trail-head"
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
