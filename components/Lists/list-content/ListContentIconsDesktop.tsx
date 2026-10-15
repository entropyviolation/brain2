"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type React from "react"
import { HabitBarRocker } from "@/components/Home/Habits/habit-led-switch"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import {
  easePileCamera,
  pileCameraCss,
  pileCameraTarget,
  pilePointerToWorld,
  pileSettleScrollTop,
  type PileCamera,
  type PileCameraPhase,
  PILE_CAMERA_IDENTITY,
} from "@/components/Lists/lib/list-icon-pile-camera"
import {
  accumulateIconPile,
  applyPileContainer,
  compactHeapPositions,
  finalizeIconPile,
  listIconPileContainerHeight,
  listItemsIconLocation,
  LIST_ICON_PILE_FLING_SPEED,
  LIST_ICON_PILE_FLING_WAKE_MS,
  LIST_ICON_PILE_INTERACT_MS,
  LIST_ICON_PILE_MAX_MS,
  makePileBodies,
  makePileBodiesFromPositions,
  makePileWorld,
  pileBodiesToIconPositions,
  pileClearMotionAfterCommit,
  pileContainerNeedsReshape,
  pileDragBody,
  pileGrabBody,
  pileHitTest,
  pileIsSettled,
  pileRadiusForCount,
  pileThrowBody,
  prefersIconPileReducedMotion,
  type PileContainer,
} from "@/components/Lists/lib/list-icon-pile"
import type { WillpowerBody, WillpowerWorld } from "@/lib/willpower-physics"
import {
  beginGravitySettle,
  buildGravityEdges,
  clearGravitySnapshot,
  DEFAULT_GRAVITY_FIELD_PARAMS,
  dragGravityBody,
  GRAVITY_SIM,
  grabGravityBody,
  gravityBodiesToIconPositions,
  gravityBoundsFor,
  gravityCommitMs,
  gravityIsLargeN,
  gravityIsSettled,
  gravityPaintMs,
  gravitySourcesSignature,
  makeGravityBodies,
  nodeGlowLevel,
  prefersGravityReducedMotion,
  releaseGravityBody,
  remassGravityBodies,
  restoreGravitySnapshot,
  sanitizeGravityFieldParams,
  settleGravityFieldSlice,
  settleGravityReduced,
  stepGravity,
  stirGravityField,
  takeGravitySnapshot,
  tasksToGravityItems,
  type GravityBody,
  type GravityEdge,
  type GravityFieldParams,
  type GravitySettleProgress,
} from "@/components/Lists/lib/list-icon-gravity"
import {
  clearGravityNodeChrome,
  paintGravityNodeChrome,
} from "@/components/Lists/lib/list-icon-gravity-paint"
import { ListIconPhysicsJuice } from "@/components/Lists/lib/list-icon-physics-juice"
import { FLING_JUICE } from "@/components/Lists/lib/list-icon-fling-juice"
import "@/components/Lists/lib/list-icon-gravity.css"
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
  type IconPos,
} from "@/components/Lists/lib/velvet-icon-grid"
import { itemTitle } from "@/lib/item-utils"
import { useListsUiStore } from "@/lib/lists-ui-store"
import type { Task } from "@/lib/types"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentIconsProps } from "./types"

const CULL_AT = 60
const ORGANIZE_MS = 520
/** Overview zoom-out window before the camera starts tracking the fall. */
const OVERVIEW_MS = 420
/** Ease back to identity after settle so desktop icons stay native size. */
const SETTLE_CAM_MS = 520
/** Do not settle before this — user must see a real fall. */
const MIN_PILE_VISIBLE_MS = 900
/** Above this, compact heap only (keeps the click path freeze-free). */
const PHYSICS_N_CAP = 110

type PileLiveSession = {
  active: boolean
  interactive: boolean
  bodies: WillpowerBody[]
  world: WillpowerWorld
  bounds: PileContainer
  ids: string[]
  radius: number
  boxWidth: number
  boxHeight: number
  grabId: string | null
  /** Keep the sim alive while the user is playing with the heap. */
  keepAlive: boolean
}

function smoothstep(t: number) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

function pileCentroidY(bodies: Array<{ y: number }>): number {
  if (bodies.length === 0) return 0
  let sum = 0
  for (const body of bodies) sum += body.y
  return sum / bodies.length
}

/** Small habit-bar rocker. Shown on the list inspector while Display is Icons. */
export function ListIconsDesktopSwitch({ targetKey, show }: { targetKey: string; show: boolean }) {
  const checked = useListsUiStore((s) => !!s.listIconsDesktop?.[targetKey])
  const setListIconsDesktop = useListsUiStore((s) => s.setListIconsDesktop)
  if (!show || !targetKey) return null
  return (
    <div className="fm-inspector-desktop">
      <HabitBarRocker
        id={`list-icons-desktop-${targetKey}`}
        checked={checked}
        onCheckedChange={(on) => setListIconsDesktop(targetKey, on)}
        label="Desktop"
      />
    </div>
  )
}

type DragState = {
  key: string
  id: string
  startX: number
  startY: number
  origX: number
  origY: number
}

export function ListContentIconsDesktop({
  tasks,
  onTaskSelect,
  onIconPickerOpen,
  selectMode,
  selectedTaskIds,
  onToggleTaskSelect,
  openTargetKey,
  organizeEpoch = 0,
  pileEpoch = 0,
  gravityResetEpoch = 0,
  gravitySettleEpoch = 0,
}: ListContentIconsProps & {
  openTargetKey: string
  organizeEpoch?: number
  pileEpoch?: number
  gravityResetEpoch?: number
  gravitySettleEpoch?: number
}) {
  const location = listItemsIconLocation(openTargetKey)
  const iconPositions = useListsUiStore((s) => s.iconPositions)
  const storedMode = useListsUiStore((s) => s.iconLayoutMode?.[location])
  const setIconPosition = useListsUiStore((s) => s.setIconPosition)
  const commitIconLayout = useListsUiStore((s) => s.commitIconLayout)
  const gravityOn = useListsUiStore((s) => !!s.listIconsGravity?.[openTargetKey])
  const setListIconsGravity = useListsUiStore((s) => s.setListIconsGravity)
  const gravityFieldRaw = useListsUiStore((s) => s.listIconsGravityField)
  const gravityField = sanitizeGravityFieldParams(gravityFieldRaw)
  const gravitySourcesKey = gravitySourcesSignature(gravityField.sources)

  const canvasRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(VELVET_GRID_FALLBACK_WIDTH)
  /** Live velvet viewport height — grid minHeight never goes below this (floor pin). */
  const [canvasHeight, setCanvasHeight] = useState(0)
  const [motionPos, setMotionPos] = useState<Record<string, IconPos> | null>(null)
  const [piling, setPiling] = useState(false)
  const [gravitying, setGravitying] = useState(false)
  /** Edges for force-link juice (React); bodies stay in refs for the sim. */
  const [gravityEdges, setGravityEdges] = useState<GravityEdge[]>([])
  /** Locked playfield min-height for the pile box — set once per run, updated only on resize. */
  const [pileMin, setPileMin] = useState(0)
  const [scrollBand, setScrollBand] = useState({ top: 0, height: 900 })

  const widthRef = useRef(canvasWidth)
  widthRef.current = canvasWidth
  const canvasHeightRef = useRef(canvasHeight)
  canvasHeightRef.current = canvasHeight
  const locationRef = useRef(location)
  locationRef.current = location
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const aliveRef = useRef(true)
  const rafRef = useRef(0)
  const generation = useRef(0)
  const pilingRef = useRef(false)
  const gravityingRef = useRef(false)
  /** Abort in-flight PILE UP (location change / unmount / Strict Mode remount). */
  const pileAbortRef = useRef<(() => void) | null>(null)
  /** Abort in-flight Gravity sim. */
  const gravityAbortRef = useRef<(() => void) | null>(null)
  /** Abort in-flight Skip to stable (time-sliced settle). */
  const gravitySettleAbortRef = useRef<(() => void) | null>(null)
  /** Snapshot taken once per Gravity session (Reset restores it). */
  const gravitySessionRef = useRef(false)
  /** Live Gravity bodies / edges for grab-throw while rAF runs. */
  const gravityBodiesRef = useRef<GravityBody[] | null>(null)
  const gravityEdgesRef = useRef<GravityEdge[]>([])
  /** Live field knobs — read each tick; never restart the Gravity session. */
  const gravityParamsRef = useRef<GravityFieldParams>(DEFAULT_GRAVITY_FIELD_PARAMS)
  gravityParamsRef.current = gravityField
  const gravityHotIdRef = useRef<string | null>(null)
  const seenOrganize = useRef<number | null>(null)
  const seenGravityReset = useRef<number | null>(null)
  const seenGravitySettle = useRef<number | null>(null)
  /** After Skip to stable, keep the living field on idle damp (quieter swirl). */
  const gravityIdleRef = useRef(false)
  /**
   * After Skip to stable: do not step physics (idle swirl/springs would re-jitter).
   * Cleared on grab / stir so the field can live again. Gravity stays on; cords stay.
   */
  const gravityFrozenRef = useRef(false)
  /** True while time-sliced Skip settle is in flight (settings rebuild edges, do not unfreeze). */
  const gravitySettlingRef = useRef(false)
  /** Live poses painted via DOM during the fall — avoids React scale storms. */
  const livePosRef = useRef<Record<string, IconPos> | null>(null)
  const cameraRef = useRef<PileCamera>({ ...PILE_CAMERA_IDENTITY })
  /** Live PILE UP session — grab/throw mutates bodies while the rAF loop runs. */
  const pileLiveRef = useRef<PileLiveSession | null>(null)
  /** Abort a short post-settle fling wake. */
  const flingAbortRef = useRef<(() => void) | null>(null)
  const [pileHeldId, setPileHeldId] = useState<string | null>(null)

  const entryKeys = useMemo(() => tasks.map((task) => task.id), [tasks])
  const savedHere = useMemo(
    () => positionsForLocation(iconPositions, location, entryKeys),
    [iconPositions, location, entryKeys],
  )
  const layoutMode = inferIconLayoutMode(entryKeys, savedHere, storedMode)

  const [dragFreeze, setDragFreeze] = useState<Record<string, IconPos> | null>(null)
  const dragFreezeRef = useRef<Record<string, IconPos> | null>(null)
  dragFreezeRef.current = dragFreeze
  const [dragKey, setDragKey] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragPosRef = useRef<IconPos | null>(null)
  const movedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const detachDragRef = useRef<(() => void) | null>(null)

  const positions = useMemo(() => {
    if (dragFreeze) return dragFreeze
    return resolveVelvetIconPositions(entryKeys, canvasWidth, savedHere, layoutMode)
  }, [canvasWidth, dragFreeze, entryKeys, layoutMode, savedHere])

  const shown = motionPos ?? positions
  const shownRef = useRef(shown)
  shownRef.current = shown

  const applyCamera = useCallback((cam: PileCamera) => {
    cameraRef.current = cam
    const el = flightRef.current
    if (el) el.style.transform = pileCameraCss(cam)
  }, [])

  const clearCamera = useCallback(() => {
    cameraRef.current = { ...PILE_CAMERA_IDENTITY }
    const el = flightRef.current
    if (el) el.style.transform = ""
  }, [])

  const paintDom = useCallback((ids: string[], next: Record<string, IconPos>) => {
    const root = canvasRef.current
    if (!root) return
    // One querySelectorAll + map — per-id querySelector is O(n·DOM) and freezes large lists.
    const nodes = root.querySelectorAll<HTMLElement>("[data-icon-entry][data-id]")
    const byId = new Map<string, HTMLElement>()
    for (const node of nodes) {
      const id = node.getAttribute("data-id")
      if (id) byId.set(id, node)
    }
    for (const id of ids) {
      const pos = next[id]
      const node = byId.get(id)
      if (!pos || !node) continue
      node.style.left = `${pos.x}px`
      node.style.top = `${pos.y}px`
    }
  }, [])

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const apply = () => {
      const w = Math.round(el.clientWidth)
      const next = w >= 80 ? w : VELVET_GRID_FALLBACK_WIDTH
      setCanvasWidth((prev) => (prev === next ? prev : next))
      const h = Math.round(el.clientHeight)
      if (h > 0) setCanvasHeight((prev) => (prev === h ? prev : h))
    }
    apply()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [location])

  // Re-apply live DOM poses after React paints during PILE UP / Gravity (cull / remount).
  // Use refs — React `piling` state can lag a frame behind the sim.
  useLayoutEffect(() => {
    if ((!pilingRef.current && !gravityingRef.current) || !livePosRef.current) return
    const ids = tasksRef.current.map((task) => task.id)
    paintDom(ids, livePosRef.current)
    if (pilingRef.current) applyCamera(cameraRef.current)
  })

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      pileAbortRef.current?.()
      gravityAbortRef.current?.()
      gravitySettleAbortRef.current?.()
      flingAbortRef.current?.()
      cancelAnimationFrame(rafRef.current)
      detachDragRef.current?.()
      pilingRef.current = false
      gravityingRef.current = false
      pileLiveRef.current = null
    }
  }, [])

  useEffect(() => {
    generation.current += 1
    pileAbortRef.current?.()
    gravityAbortRef.current?.()
    gravitySettleAbortRef.current?.()
    flingAbortRef.current?.()
    cancelAnimationFrame(rafRef.current)
    detachDragRef.current?.()
    pilingRef.current = false
    gravityingRef.current = false
    setPiling(false)
    setGravitying(false)
    gravitySessionRef.current = false
    setMotionPos(null)
    livePosRef.current = null
    pileLiveRef.current = null
    setPileHeldId(null)
    setPileMin(0)
    clearCamera()
    setDragFreeze(null)
    setDragKey(null)
    dragRef.current = null
    // Only reset on location change — clearCamera must not be a dep (HMR/identity aborts PILE UP).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  useEffect(() => {
    if (seenOrganize.current === null) {
      seenOrganize.current = organizeEpoch
      return
    }
    if (organizeEpoch === seenOrganize.current || pilingRef.current) {
      seenOrganize.current = organizeEpoch
      return
    }
    seenOrganize.current = organizeEpoch
    gravityAbortRef.current?.()
    gravitySettleAbortRef.current?.()
    flingAbortRef.current?.()
    const ids = tasksRef.current.map((task) => task.id)
    const width = widthRef.current
    const from = { ...shownRef.current }
    const laid = layoutVelvetIconGrid(ids, width)
    commitIconLayout(locationRef.current, laid, "auto")
    setPileMin(0)
    clearCamera()
    if (prefersIconPileReducedMotion()) {
      setMotionPos(null)
      livePosRef.current = null
      return
    }
    const gen = generation.current
    const start = performance.now()
    const frame = (now: number) => {
      if (!aliveRef.current || generation.current !== gen) return
      const t = Math.min(1, (now - start) / ORGANIZE_MS)
      const e = smoothstep(t)
      const next: Record<string, IconPos> = {}
      for (const id of ids) {
        const a = from[id] ?? laid[id] ?? { x: VELVET_ICON_CELL.pad, y: VELVET_ICON_CELL.pad }
        const b = laid[id] ?? a
        next[id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      }
      setMotionPos(t < 1 ? next : null)
      if (t < 1) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitIconLayout, organizeEpoch])

  useEffect(() => {
    if (!pileEpoch) return

    /**
     * Local cancel flag — required for React Strict Mode. The old pattern
     * (shared rafRef + seenPile skip) let the mount cleanup kill the first
     * rAF, then the remount early-returned and never restarted, so the UI
     * jumped straight to whatever commit landed with no visible fall.
     */
    let cancelled = false
    let finished = false
    let raf = 0
    const ids = tasksRef.current.map((task) => task.id)
    if (ids.length === 0) return

    const startWidth = Math.max(widthRef.current, canvasRef.current?.clientWidth || 0, VELVET_ICON_CELL.w)
    // Prefer live canvas height (layout) over a stale 480 fallback — short viewport
    // locks left a mid-velvet shelf that then “rose” when the real height arrived.
    const startViewport =
      canvasRef.current?.clientHeight || canvasHeightRef.current || 480
    // Lock box size for the whole run — resizing mid-sim via React minHeight was a jump source.
    const lockedHeight = listIconPileContainerHeight(startWidth, ids.length, startViewport)
    let boxWidth = startWidth
    let boxHeight = lockedHeight
    const loc = locationRef.current
    const radius = pileRadiusForCount(ids.length)

    gravityAbortRef.current?.()
    gravitySettleAbortRef.current?.()
    flingAbortRef.current?.()
    pileAbortRef.current?.()
    const abort = () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (pileAbortRef.current === abort) pileAbortRef.current = null
      // Do not leave the desktop stuck in piling if cleanup wins a race with settle.
      if (!finished) {
        pilingRef.current = false
        livePosRef.current = null
      }
    }
    pileAbortRef.current = abort

    const commit = (next: Record<string, IconPos>) => {
      useListsUiStore.getState().commitIconLayout(loc, next, "freeform")
    }

    // True reduced-motion / huge lists only — never a false-positive shortcut for tens of icons.
    // Skip setPiling(true): keeps cull + juice off so the click path stays freeze-free.
    if (prefersIconPileReducedMotion() || ids.length > PHYSICS_N_CAP) {
      setPileMin(lockedHeight)
      const gridEl = canvasRef.current?.querySelector<HTMLElement>(".fm-icon-grid-free")
      if (gridEl) gridEl.style.minHeight = `${lockedHeight}px`
      const placed = compactHeapPositions(ids, boxWidth, boxHeight)
      commit(placed)
      finished = true
      livePosRef.current = null
      setMotionPos(null)
      clearCamera()
      setPiling(false)
      pilingRef.current = false
      pileAbortRef.current = null
      requestAnimationFrame(() => {
        const el = canvasRef.current
        if (!el) return
        el.scrollTop = pileSettleScrollTop(boxHeight * 0.85, startViewport, boxHeight)
      })
      return () => abort()
    }

    pilingRef.current = true
    setPiling(true)
    setDragFreeze(null)
    setDragKey(null)
    setPileMin(lockedHeight)
    // Overview (scale-to-fit) needs scrollTop 0. Starting at identity with a tall
    // box parked the floor below the fold; easing scale toward fit then lifted it.
    if (canvasRef.current) canvasRef.current.scrollTop = 0
    const gridEl = canvasRef.current?.querySelector<HTMLElement>(".fm-icon-grid-free")
    if (gridEl) gridEl.style.minHeight = `${lockedHeight}px`
    // Start on the floor-pinned overview target — no ease-from-identity rise at t=0.
    const startCam = pileCameraTarget({
      phase: "overview",
      viewportHeight: startViewport,
      playfieldHeight: lockedHeight,
      focusY: lockedHeight * 0.5,
    })
    applyCamera(startCam)

    const world = makePileWorld(boxWidth, boxHeight, radius)
    let bodies = makePileBodies(ids, boxWidth, boxHeight, world, {
      seedPositions: shownRef.current,
    })
    let bounds: PileContainer = applyPileContainer(world, bodies, boxWidth, boxHeight, radius)
    const spawnPos = pileBodiesToIconPositions(bodies)
    livePosRef.current = spawnPos
    // DOM-only during flight — no React motionPos until post-commit clear (keeps drag unblocked).
    paintDom(ids, spawnPos)

    const live: PileLiveSession = {
      active: true,
      interactive: false,
      bodies,
      world,
      bounds,
      ids,
      radius,
      boxWidth,
      boxHeight,
      grabId: null,
      keepAlive: false,
    }
    pileLiveRef.current = live

    const simStart = performance.now()
    let last = simStart
    let accumulator = 0
    let cam: PileCamera = { ...startCam }
    let phase: PileCameraPhase = "overview"
    let ending = false
    let settleStart = 0
    let settledPos: Record<string, IconPos> | null = null
    let settleFocusY = boxHeight * 0.8
    let playUntil = 0

    const finishDesktop = (placed: Record<string, IconPos>, focusY: number) => {
      if (finished) return
      finished = true
      // Always commit the surviving run's freeform heap. Abort only skips UI scroll.
      commit(placed)
      livePosRef.current = null
      setMotionPos(pileClearMotionAfterCommit())
      clearCamera()
      setPiling(false)
      pilingRef.current = false
      pileAbortRef.current = null
      pileLiveRef.current = null
      setPileHeldId(null)
      // Keep playfield ≥ velvet after settle (do not snap back to a 480 mid-shelf).
      setPileMin((prev) => Math.max(prev, boxHeight))
      if (cancelled) return
      const el = canvasRef.current
      if (el) {
        const viewport = el.clientHeight || canvasHeightRef.current || 480
        if (viewport > 0) setCanvasHeight((prev) => (prev === viewport ? prev : viewport))
        el.scrollTop = pileSettleScrollTop(focusY, viewport, boxHeight)
      }
    }

    const tick = (frameNow: number) => {
      if (cancelled || finished) return

      // Width reshape + grow-only height when the velvet viewport gets taller
      // (toolbar/layout). Never shrink mid-sim; growing keeps the floor on the
      // new velvet bottom instead of leaving a gap under a short locked box.
      const liveW = Math.max(widthRef.current, canvasRef.current?.clientWidth || 0, VELVET_ICON_CELL.w)
      const viewport = canvasRef.current?.clientHeight || startViewport
      let reshaped = false
      if (pileContainerNeedsReshape(boxWidth, liveW, 8)) {
        boxWidth = liveW
        reshaped = true
      }
      if (viewport > boxHeight + 1) {
        boxHeight = Math.ceil(viewport)
        live.boxHeight = boxHeight
        setPileMin((prev) => (prev === boxHeight ? prev : boxHeight))
        const grid = canvasRef.current?.querySelector<HTMLElement>(".fm-icon-grid-free")
        if (grid) grid.style.minHeight = `${boxHeight}px`
        reshaped = true
      }
      if (reshaped) {
        bounds = applyPileContainer(world, bodies, boxWidth, boxHeight, radius)
        live.boxWidth = boxWidth
        live.bounds = bounds
      }

      // Pull bodies from the live session so grab/throw mutations stick across frames.
      bodies = live.bodies
      bounds = live.bounds

      if (ending && settledPos && !live.keepAlive && !live.grabId) {
        const u = Math.min(1, (frameNow - settleStart) / SETTLE_CAM_MS)
        const target = pileCameraTarget({
          phase: "settle",
          viewportHeight: viewport,
          playfieldHeight: boxHeight,
          focusY: settleFocusY,
        })
        const dtCam = Math.min(1 / 30, Math.max((frameNow - last) / 1000, 0))
        last = frameNow
        cam = easePileCamera(cam, target, dtCam, 7.5)
        applyCamera(cam)
        const el = canvasRef.current
        if (el) {
          const want = pileSettleScrollTop(settleFocusY, viewport, boxHeight)
          el.scrollTop = el.scrollTop + (want - el.scrollTop) * Math.min(1, dtCam * 6)
        }
        paintDom(ids, settledPos)
        if (u < 1) {
          raf = requestAnimationFrame(tick)
          return
        }
        finishDesktop(settledPos, settleFocusY)
        return
      }

      const elapsed = frameNow - simStart
      if (elapsed >= OVERVIEW_MS) phase = "follow"
      if (elapsed >= LIST_ICON_PILE_INTERACT_MS) live.interactive = true

      // Fixed-timestep accumulator. Paint every frame — DOM only.
      const frameDt = Math.max((frameNow - last) / 1000, 0)
      last = frameNow
      const advanced = accumulateIconPile(bodies, world, bounds, frameDt, accumulator)
      bodies = advanced.bodies
      accumulator = advanced.accumulator
      live.bodies = bodies

      const focusY = pileCentroidY(bodies)
      const camTarget = pileCameraTarget({
        phase: ending ? "settle" : phase,
        viewportHeight: viewport,
        playfieldHeight: boxHeight,
        focusY,
      })
      cam = easePileCamera(
        cam,
        camTarget,
        frameDt > 0 ? Math.min(frameDt, 1 / 30) : 1 / 60,
        phase === "overview" ? 6 : 4.2,
      )
      applyCamera(cam)

      const nearFloor = bodies.every((body) => body.held || body.y > bounds.floorY - radius * 2.5)
      const quiet = pileIsSettled(bodies)
      const landed =
        elapsed >= MIN_PILE_VISIBLE_MS &&
        quiet &&
        nearFloor &&
        !live.grabId &&
        !live.keepAlive
      const poses = pileBodiesToIconPositions(bodies)
      livePosRef.current = poses
      paintDom(ids, poses)

      const playing = live.grabId != null || live.keepAlive || frameNow < playUntil
      if (playing) {
        // User is mid-throw — extend the show until the heap calms again.
        if (quiet && nearFloor && !live.grabId && frameNow >= playUntil) {
          live.keepAlive = false
        } else {
          live.keepAlive = true
          playUntil = Math.max(playUntil, frameNow + 900)
        }
        ending = false
        raf = requestAnimationFrame(tick)
        return
      }

      if (!landed && elapsed < LIST_ICON_PILE_MAX_MS) {
        raf = requestAnimationFrame(tick)
        return
      }
      settledPos = finalizeIconPile(bodies, world, bounds, ids, boxWidth, boxHeight)
      settleFocusY = pileCentroidY(
        Object.values(settledPos).map((pos) => ({ y: pos.y + VELVET_ICON_CELL.h / 2 })),
      )
      livePosRef.current = settledPos
      paintDom(ids, settledPos)
      ending = true
      settleStart = frameNow
      phase = "settle"
      live.interactive = true
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      abort()
      pileLiveRef.current = null
      setPileHeldId(null)
    }
    // Camera/paint helpers are stable; only pileEpoch should restart the sim.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid aborting mid-fall on callback identity
  }, [pileEpoch])

  // Gravity Reset: restore pre-sim snapshot and turn forces off (exit without stuck).
  useEffect(() => {
    if (seenGravityReset.current === null) {
      seenGravityReset.current = gravityResetEpoch
      return
    }
    if (gravityResetEpoch === seenGravityReset.current) return
    seenGravityReset.current = gravityResetEpoch
    gravitySettleAbortRef.current?.()
    gravityAbortRef.current?.()
    const snap = restoreGravitySnapshot(locationRef.current)
    if (snap) {
      commitIconLayout(locationRef.current, snap, "freeform")
      setMotionPos(null)
      livePosRef.current = null
      paintDom(Object.keys(snap), snap)
    }
    clearGravitySnapshot(locationRef.current)
    gravitySessionRef.current = false
    gravityIdleRef.current = false
    gravityFrozenRef.current = false
    gravityingRef.current = false
    setGravitying(false)
    setListIconsGravity(openTargetKey, false)
  }, [commitIconLayout, gravityResetEpoch, openTargetKey, paintDom, setListIconsGravity])

  // Skip to stable: time-sliced settle under **current** Gravity settings → freeze.
  useEffect(() => {
    if (seenGravitySettle.current === null) {
      seenGravitySettle.current = gravitySettleEpoch
      return
    }
    if (gravitySettleEpoch === seenGravitySettle.current) return
    seenGravitySettle.current = gravitySettleEpoch
    if (!gravityOn) return

    const ids = tasksRef.current.map((task) => task.id)
    if (ids.length === 0) return

    // Abort any prior Skip / keep live stepper frozen while we chunk settle.
    gravitySettleAbortRef.current?.()
    let cancelled = false
    let raf = 0
    const abort = () => {
      cancelled = true
      gravitySettlingRef.current = false
      cancelAnimationFrame(raf)
      if (gravitySettleAbortRef.current === abort) gravitySettleAbortRef.current = null
    }
    gravitySettleAbortRef.current = abort
    gravitySettlingRef.current = true
    gravityFrozenRef.current = true
    gravityIdleRef.current = true

    // Always rebuild edges + remass from live paramsRef (current Gravity settings).
    const params = gravityParamsRef.current
    const edges = buildGravityEdges(tasksToGravityItems(tasksRef.current), params.sources)
    gravityEdgesRef.current = edges
    setGravityEdges(edges)

    const seedPos = livePosRef.current ?? shownRef.current
    let bodies = gravityBodiesRef.current
    if (!bodies || bodies.length === 0) {
      bodies = makeGravityBodies(ids, seedPos, edges)
    } else {
      bodies = remassGravityBodies(bodies, edges)
    }
    const width = Math.max(widthRef.current, VELVET_ICON_CELL.w)
    let bounds = gravityBoundsFor(width, ids.length)
    setPileMin((prev) => (prev === bounds.height ? prev : bounds.height))

    let progress: GravitySettleProgress = beginGravitySettle(bodies)
    gravityBodiesRef.current = progress.bodies

    const finishSkip = (finalBodies: GravityBody[]) => {
      if (cancelled) return
      gravitySettlingRef.current = false
      const rested = finalBodies.map((b) => ({ ...b, vx: 0, vy: 0, held: false }))
      gravityBodiesRef.current = rested
      gravityFrozenRef.current = true
      gravityIdleRef.current = true
      const poses = gravityBodiesToIconPositions(rested)
      livePosRef.current = poses
      paintDom(ids, poses)
      const root = canvasRef.current
      if (root) {
        paintGravityNodeChrome(root, rested, gravityHotIdRef.current, null)
      }
      commitIconLayout(locationRef.current, poses, "freeform")
      // Large lists: avoid a huge motionPos React storm — DOM already painted.
      if (gravityIsLargeN(ids.length)) {
        setMotionPos(null)
      } else {
        setMotionPos(poses)
      }
      gravitySettleAbortRef.current = null
    }

    const tick = () => {
      if (cancelled) return
      // Re-read live knobs each slice so Skip tracks mid-settle settings edits.
      const liveParams = gravityParamsRef.current
      const liveEdges = gravityEdgesRef.current
      const w = Math.max(widthRef.current, VELVET_ICON_CELL.w)
      bounds = gravityBoundsFor(w, ids.length)
      progress = settleGravityFieldSlice(progress, liveEdges, bounds, {
        globalG: liveParams.globalG,
        // Large N: fewer steps/slice so one Skip click never owns the frame.
        maxStepsThisSlice: gravityIsLargeN(ids.length) ? 2 : GRAVITY_SIM.SETTLE_SLICE_STEPS,
      })
      gravityBodiesRef.current = progress.bodies
      const poses = gravityBodiesToIconPositions(progress.bodies)
      livePosRef.current = poses
      paintDom(ids, poses)
      if (!progress.done) {
        raf = requestAnimationFrame(tick)
        return
      }
      finishSkip(progress.bodies)
    }
    raf = requestAnimationFrame(tick)
    return () => abort()
  }, [commitIconLayout, gravityOn, gravitySettleEpoch, paintDom])

  // Optional Gravity / connection-field mode (mutually exclusive with live PILE UP).
  useEffect(() => {
    if (!gravityOn) {
      gravitySettleAbortRef.current?.()
      gravityAbortRef.current?.()
      if (livePosRef.current) {
        commitIconLayout(locationRef.current, livePosRef.current, "freeform")
      }
      livePosRef.current = null
      setMotionPos(null)
      gravityingRef.current = false
      setGravitying(false)
      gravitySessionRef.current = false
      gravityIdleRef.current = false
      gravityFrozenRef.current = false
      gravityBodiesRef.current = null
      gravityEdgesRef.current = []
      setGravityEdges([])
      clearGravityNodeChrome(canvasRef.current)
      return
    }

    let cancelled = false
    let raf = 0
    const ids = tasksRef.current.map((task) => task.id)
    if (ids.length === 0) return

    // Mutual exclusion: Gravity aborts an in-flight PILE UP / fling wake / Skip (do not early-return).
    pileAbortRef.current?.()
    flingAbortRef.current?.()
    gravitySettleAbortRef.current?.()
    pilingRef.current = false
    setPiling(false)
    pileLiveRef.current = null
    setPileHeldId(null)
    clearCamera()
    gravityAbortRef.current?.()
    const abort = () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (gravityAbortRef.current === abort) gravityAbortRef.current = null
    }
    gravityAbortRef.current = abort

    const loc = locationRef.current
    const seedPos = livePosRef.current ?? shownRef.current
    if (!gravitySessionRef.current) {
      takeGravitySnapshot(loc, seedPos)
      gravitySessionRef.current = true
    }

    const items = tasksToGravityItems(tasksRef.current)
    const edges = buildGravityEdges(items, gravityParamsRef.current.sources)
    gravityEdgesRef.current = edges
    setGravityEdges(edges)
    const width = Math.max(widthRef.current, VELVET_ICON_CELL.w)
    const bounds = gravityBoundsFor(width, ids.length)
    setPileMin((prev) => (prev === bounds.height ? prev : bounds.height))
    const largeN = gravityIsLargeN(ids.length)
    const paintInterval = gravityPaintMs(ids.length)
    const commitInterval = gravityCommitMs(ids.length)

    let bodies = makeGravityBodies(ids, seedPos, edges)
    gravityBodiesRef.current = bodies
    gravityIdleRef.current = false
    gravityFrozenRef.current = false
    gravityingRef.current = true
    setGravitying(true)
    setDragFreeze(null)
    setDragKey(null)
    clearCamera()

    const commit = (next: Record<string, IconPos>) => {
      useListsUiStore.getState().commitIconLayout(loc, next, "freeform")
    }
    const paintField = (nextBodies: GravityBody[], paintChrome = true) => {
      const poses = gravityBodiesToIconPositions(nextBodies)
      livePosRef.current = poses
      paintDom(ids, poses)
      const root = canvasRef.current
      if (root && paintChrome) {
        const held = nextBodies.find((b) => b.held)?.id ?? null
        paintGravityNodeChrome(root, nextBodies, gravityHotIdRef.current, held)
      }
      return poses
    }

    if (prefersGravityReducedMotion()) {
      // Large lists: time-slice reduced snap so enable does not block the click.
      let progress = beginGravitySettle(bodies, { maxSteps: GRAVITY_SIM.REDUCED_STEPS })
      const snapTick = () => {
        if (cancelled) return
        progress = settleGravityFieldSlice(progress, gravityEdgesRef.current, bounds, {
          globalG: gravityParamsRef.current.globalG,
        })
        gravityBodiesRef.current = progress.bodies
        paintField(progress.bodies, !largeN || progress.done)
        if (!progress.done) {
          raf = requestAnimationFrame(snapTick)
          return
        }
        gravityIdleRef.current = true
        gravityFrozenRef.current = true
        commit(gravityBodiesToIconPositions(progress.bodies))
        livePosRef.current = null
        setMotionPos(null)
        gravityingRef.current = false
        setGravitying(false)
        gravityAbortRef.current = null
      }
      raf = requestAnimationFrame(snapTick)
      return () => abort()
    }

    const startPos = paintField(bodies)
    // Large N: DOM-only after the first pose — setMotionPos every frame freezes React.
    if (!largeN) setMotionPos(startPos)
    else setMotionPos(null)

    const simStart = performance.now()
    let last = simStart
    let lastPaint = 0
    let lastCommit = 0
    let lastChrome = 0

    const tick = (frameNow: number) => {
      if (cancelled) return
      const dt = Math.min(1 / 30, Math.max((frameNow - last) / 1000, 0))
      last = frameNow
      // Grab/throw / Skip may have mutated the ref mid-frame — always read latest.
      bodies = gravityBodiesRef.current ?? bodies
      // Skip to stable freezes: idle swirl + springs would re-jitter a zeroed field.
      if (gravityFrozenRef.current) {
        raf = requestAnimationFrame(tick)
        return
      }
      if (dt > 0) {
        const w = Math.max(widthRef.current, VELVET_ICON_CELL.w)
        const nextBounds = gravityBoundsFor(w, ids.length)
        const idle = gravityIdleRef.current || frameNow - simStart > GRAVITY_SIM.SHOW_MS
        const liveEdges = gravityEdgesRef.current
        bodies = stepGravity(bodies, liveEdges, dt, nextBounds, {
          idle,
          globalG: gravityParamsRef.current.globalG,
        })
        gravityBodiesRef.current = bodies
      }
      const settled = frameNow - simStart > 400 && gravityIsSettled(bodies)
      const paintNow = frameNow - lastPaint >= paintInterval || settled
      if (paintNow) {
        lastPaint = frameNow
        const chromeNow = !largeN || frameNow - lastChrome >= paintInterval * 2 || settled
        if (chromeNow) lastChrome = frameNow
        const poses = paintField(bodies, chromeNow)
        if (!largeN && (!settled || frameNow - lastCommit >= commitInterval)) {
          setMotionPos(poses)
        }
        if (frameNow - lastCommit >= commitInterval) {
          lastCommit = frameNow
          commit(poses)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      abort()
      clearGravityNodeChrome(canvasRef.current)
    }
    // Auto-organize / PILE UP turn Gravity off in the toolbar (mutual exclusion).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid abort storms on helper identity
  }, [gravityOn, openTargetKey, location])

  // Live field knobs: rebuild edges on source-gain change from current listIconsGravityField.
  // Mid-Skip: keep freeze + let settle slices pick up new edges/G (do not race the live stepper).
  // After Skip / idle: unfreeze so the living field can re-settle under the new knobs.
  useEffect(() => {
    if (!gravityOn) return
    const params = gravityParamsRef.current
    const edges = buildGravityEdges(tasksToGravityItems(tasksRef.current), params.sources)
    gravityEdgesRef.current = edges
    setGravityEdges(edges)
    if (gravityBodiesRef.current) {
      gravityBodiesRef.current = remassGravityBodies(gravityBodiesRef.current, edges)
    }
    if (!gravitySettlingRef.current) {
      gravityFrozenRef.current = false
    }
  }, [gravityOn, gravitySourcesKey, gravityField.globalG])

  const worldFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return pilePointerToWorld({
      clientX,
      clientY,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      scrollTop: canvas.scrollTop,
      canvasWidth: canvas.clientWidth || widthRef.current,
      cam: cameraRef.current,
    })
  }, [])

  /** Short post-settle physics wake when the user flings a freeform orb. */
  const beginFlingWake = useCallback(
    (throwId: string, positions: Record<string, IconPos>, vx: number, vy: number) => {
      flingAbortRef.current?.()
      const ids = tasksRef.current.map((task) => task.id)
      if (ids.length === 0 || ids.length > PHYSICS_N_CAP) return
      const width = Math.max(widthRef.current, canvasRef.current?.clientWidth || 0, VELVET_ICON_CELL.w)
      const height = Math.max(
        pileMin,
        listIconPileContainerHeight(width, ids.length, canvasRef.current?.clientHeight || 480),
        ...Object.values(positions).map((p) => p.y + VELVET_ICON_CELL.h + 24),
      )
      const radius = pileRadiusForCount(ids.length)
      const world = makePileWorld(width, height, radius)
      let bodies = makePileBodiesFromPositions(ids, positions, width, height, world)
      bodies = pileThrowBody(bodies, throwId, vx, vy)
      let bounds = applyPileContainer(world, bodies, width, height, radius)
      const loc = locationRef.current
      let cancelled = false
      let raf = 0
      let last = performance.now()
      let accumulator = 0
      const started = last
      setPileMin((prev) => Math.max(prev, height))
      const abort = () => {
        cancelled = true
        cancelAnimationFrame(raf)
        if (flingAbortRef.current === abort) flingAbortRef.current = null
      }
      flingAbortRef.current = abort
      const tick = (now: number) => {
        if (cancelled) return
        const frameDt = Math.max((now - last) / 1000, 0)
        last = now
        const advanced = accumulateIconPile(bodies, world, bounds, frameDt, accumulator)
        bodies = advanced.bodies
        accumulator = advanced.accumulator
        bounds = applyPileContainer(world, bodies, width, height, radius)
        const poses = pileBodiesToIconPositions(bodies)
        livePosRef.current = poses
        paintDom(ids, poses)
        const done =
          now - started >= LIST_ICON_PILE_FLING_WAKE_MS ||
          (now - started > 400 && pileIsSettled(bodies))
        if (!done) {
          raf = requestAnimationFrame(tick)
          return
        }
        const placed = finalizeIconPile(bodies, world, bounds, ids, width, height)
        useListsUiStore.getState().commitIconLayout(loc, placed, "freeform")
        livePosRef.current = null
        setMotionPos(pileClearMotionAfterCommit())
        paintDom(ids, placed)
        flingAbortRef.current = null
      }
      raf = requestAnimationFrame(tick)
    },
    [paintDom, pileMin],
  )

  const beginPileGrab = useCallback(
    (task: Task, event: React.MouseEvent) => {
      const live = pileLiveRef.current
      if (!live?.active || !live.interactive) return false
      const worldPt = worldFromPointer(event.clientX, event.clientY)
      if (!worldPt) return false
      const hit = pileHitTest(live.bodies, worldPt.x, worldPt.y) ?? task.id
      if (!live.bodies.some((b) => b.id === hit)) return false
      event.preventDefault()
      detachDragRef.current?.()
      live.bodies = pileGrabBody(live.bodies, hit)
      live.grabId = hit
      live.keepAlive = true
      setPileHeldId(hit)
      let lastX = worldPt.x
      let lastY = worldPt.y
      let lastT = performance.now()
      let vx = 0
      let vy = 0

      const onMove = (ev: MouseEvent) => {
        const session = pileLiveRef.current
        if (!session || session.grabId !== hit) return
        const pt = worldFromPointer(ev.clientX, ev.clientY)
        if (!pt) return
        const now = performance.now()
        const dt = Math.max((now - lastT) / 1000, 1 / 120)
        vx = (pt.x - lastX) / dt
        vy = (pt.y - lastY) / dt
        lastX = pt.x
        lastY = pt.y
        lastT = now
        session.bodies = pileDragBody(session.bodies, hit, pt.x, pt.y, vx, vy, session.bounds)
        const poses = pileBodiesToIconPositions(session.bodies)
        livePosRef.current = poses
        paintDom(session.ids, poses)
      }

      const onUp = () => {
        const session = pileLiveRef.current
        if (session && session.grabId === hit) {
          session.bodies = pileThrowBody(session.bodies, hit, vx, vy)
          session.grabId = null
          session.keepAlive = true
          const poses = pileBodiesToIconPositions(session.bodies)
          livePosRef.current = poses
          paintDom(session.ids, poses)
        }
        setPileHeldId(null)
        suppressClickRef.current = true
        detach()
      }

      const detach = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        if (detachDragRef.current === detach) detachDragRef.current = null
      }
      detachDragRef.current = detach
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
      return true
    },
    [paintDom, worldFromPointer],
  )

  const beginGravityGrab = useCallback(
    (task: Task, event: React.MouseEvent) => {
      if (event.button !== 0 || !gravityBodiesRef.current) return
      const target = event.target as HTMLElement
      if (target.closest(".fm-icon-edit, input, button")) return
      event.preventDefault()
      event.stopPropagation()
      detachDragRef.current?.()
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scrollTop = canvas.scrollTop
      const scrollLeft = canvas.scrollLeft

      gravityIdleRef.current = false
      gravityFrozenRef.current = false
      let bodies = grabGravityBody(gravityBodiesRef.current, task.id)
      gravityBodiesRef.current = bodies
      setDragKey(task.id)
      movedRef.current = false
      suppressClickRef.current = false

      let lastX = event.clientX
      let lastY = event.clientY
      let lastT = performance.now()
      let sampleVx = 0
      let sampleVy = 0

      const clientToCenter = (clientX: number, clientY: number) => ({
        x: clientX - rect.left + scrollLeft,
        y: clientY - rect.top + scrollTop,
      })

      // Seed held pose at current center.
      const seed = bodies.find((b) => b.id === task.id)
      if (seed) {
        bodies = dragGravityBody(bodies, task.id, seed.x, seed.y, 0, 0)
        gravityBodiesRef.current = bodies
      }

      const onMove = (ev: MouseEvent) => {
        if (!gravityBodiesRef.current) return
        const now = performance.now()
        const dt = Math.max((now - lastT) / 1000, 1 / 240)
        const c = clientToCenter(ev.clientX, ev.clientY)
        sampleVx = (ev.clientX - lastX) / dt
        sampleVy = (ev.clientY - lastY) / dt
        lastX = ev.clientX
        lastY = ev.clientY
        lastT = now
        if (!movedRef.current && Math.hypot(ev.clientX - event.clientX, ev.clientY - event.clientY) > 3) {
          movedRef.current = true
        }
        bodies = dragGravityBody(gravityBodiesRef.current, task.id, c.x, c.y, sampleVx, sampleVy)
        gravityBodiesRef.current = bodies
        const poses = gravityBodiesToIconPositions(bodies)
        livePosRef.current = poses
        paintDom(
          bodies.map((b) => b.id),
          poses,
        )
        paintGravityNodeChrome(canvas, bodies, gravityHotIdRef.current, task.id)
      }

      const onUp = () => {
        if (gravityBodiesRef.current) {
          bodies = releaseGravityBody(gravityBodiesRef.current, task.id, sampleVx, sampleVy)
          gravityBodiesRef.current = bodies
          const poses = gravityBodiesToIconPositions(bodies)
          livePosRef.current = poses
          paintDom(
            bodies.map((b) => b.id),
            poses,
          )
          paintGravityNodeChrome(canvas, bodies, gravityHotIdRef.current, null)
          if (movedRef.current) suppressClickRef.current = true
        }
        setDragKey(null)
        detach()
      }

      const detach = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        if (detachDragRef.current === detach) detachDragRef.current = null
      }
      detachDragRef.current = detach
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [paintDom],
  )

  const beginPointerDrag = useCallback(
    (task: Task, event: React.MouseEvent) => {
      if (event.button !== 0) return
      // Gravity: grab / throw while the field keeps simulating (leave gravity agent alone).
      if (gravityingRef.current && gravityOn) {
        beginGravityGrab(task, event)
        return
      }
      // motionPos must not block after pile commit — only organize tween uses it.
      if (selectMode || motionPos) return
      const target = event.target as HTMLElement
      if (target.closest(".fm-icon-edit, input, button")) return

      // Late-sim / settle-cam: grab + throw into the live heap.
      if (pilingRef.current) {
        beginPileGrab(task, event)
        return
      }

      detachDragRef.current?.()
      const key = task.id
      const origin = shownRef.current[key] ?? { x: VELVET_ICON_CELL.pad, y: VELVET_ICON_CELL.pad }
      const drag: DragState = {
        key,
        id: task.id,
        startX: event.clientX,
        startY: event.clientY,
        origX: origin.x,
        origY: origin.y,
      }
      dragRef.current = drag
      movedRef.current = false
      dragPosRef.current = origin
      let lastClientX = event.clientX
      let lastClientY = event.clientY
      let lastT = performance.now()
      let vx = 0
      let vy = 0

      const onMove = (ev: MouseEvent) => {
        const current = dragRef.current
        if (!current) return
        const now = performance.now()
        const dt = Math.max((now - lastT) / 1000, 1 / 120)
        vx = (ev.clientX - lastClientX) / dt
        vy = (ev.clientY - lastClientY) / dt
        lastClientX = ev.clientX
        lastClientY = ev.clientY
        lastT = now
        const dx = ev.clientX - current.startX
        const dy = ev.clientY - current.startY
        if (!movedRef.current) {
          if (Math.hypot(dx, dy) <= 4) return
          movedRef.current = true
          setDragKey(current.key)
          const originMap = { ...shownRef.current }
          const first = { x: Math.max(0, current.origX + dx), y: Math.max(0, current.origY + dy) }
          const frozen = freezeVelvetPositions(originMap, current.key, first)
          dragFreezeRef.current = frozen
          setDragFreeze(frozen)
          commitIconLayout(location, frozen, "freeform")
        }
        const next = { x: Math.max(0, current.origX + dx), y: Math.max(0, current.origY + dy) }
        dragPosRef.current = next
        const base = dragFreezeRef.current?.[current.key]
        if (!base) return
        const node = canvasRef.current?.querySelector<HTMLElement>(
          `[data-icon-entry][data-id="${current.id}"]`,
        )
        if (node) node.style.transform = `translate3d(${next.x - base.x}px, ${next.y - base.y}px, 0)`
      }

      const onUp = () => {
        const current = dragRef.current
        if (current && movedRef.current && dragPosRef.current) {
          suppressClickRef.current = true
          canvasRef.current
            ?.querySelector<HTMLElement>(`[data-icon-entry][data-id="${current.id}"]`)
            ?.style.removeProperty("transform")
          const next = dragPosRef.current
          setIconPosition(location, current.key, next.x, next.y)
          const speed = Math.hypot(vx, vy)
          if (speed >= LIST_ICON_PILE_FLING_SPEED && !prefersIconPileReducedMotion()) {
            const map = { ...shownRef.current, [current.key]: next }
            beginFlingWake(current.id, map, vx, vy)
          }
        }
        dragRef.current = null
        dragPosRef.current = null
        setDragKey(null)
        setDragFreeze(null)
        dragFreezeRef.current = null
        detach()
      }

      const detach = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        if (detachDragRef.current === detach) detachDragRef.current = null
      }
      detachDragRef.current = detach
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [
      beginFlingWake,
      beginGravityGrab,
      beginPileGrab,
      commitIconLayout,
      gravityOn,
      location,
      motionPos,
      selectMode,
      setIconPosition,
    ],
  )

  const onGravityCanvasPointer = useCallback(
    (event: React.MouseEvent) => {
      if (!gravityingRef.current || !gravityOn || event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest("[data-icon-entry], .fm-icon-edit, input, button")) return
      if (!gravityBodiesRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left + canvas.scrollLeft
      const y = event.clientY - rect.top + canvas.scrollTop
      gravityIdleRef.current = false
      gravityFrozenRef.current = false
      const stirred = stirGravityField(gravityBodiesRef.current, x, y)
      gravityBodiesRef.current = stirred
      const poses = gravityBodiesToIconPositions(stirred)
      livePosRef.current = poses
      paintDom(
        stirred.map((b) => b.id),
        poses,
      )
    },
    [gravityOn, paintDom],
  )

  useLayoutEffect(() => {
    const drag = dragRef.current
    const pos = dragPosRef.current
    if (!drag || !pos || !movedRef.current) return
    const base = dragFreezeRef.current?.[drag.key]
    if (!base) return
    const node = canvasRef.current?.querySelector<HTMLElement>(`[data-icon-entry][data-id="${drag.id}"]`)
    if (node) node.style.transform = `translate3d(${pos.x - base.x}px, ${pos.y - base.y}px, 0)`
  })

  const selected = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])
  const rows = Math.max(1, Math.ceil(entryKeys.length / velvetGridColumns(canvasWidth)))
  let lowest = 0
  for (const key of entryKeys) {
    const y = shown[key]?.y ?? 0
    if (y > lowest) lowest = y
  }
  // Prefer live velvet viewport over a 480px floor — a fixed 480 mid-shelf
  // shorter than a tall canvas (or taller than a short one) is what “rose”.
  const gridMinHeight = Math.max(
    canvasHeight || 480,
    rows * VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2,
    pileMin,
    lowest + VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad,
  )
  const paintMode: IconLayoutMode = dragFreeze || dragKey || piling || gravitying ? "freeform" : layoutMode
  const paintTasks =
    tasks.length < CULL_AT || piling || gravitying || motionPos
      ? tasks
      : tasks.filter((task) => {
          if (dragKey === task.id) return true
          const y = shown[task.id]?.y ?? 0
          return y > scrollBand.top - 280 && y < scrollBand.top + scrollBand.height + 280
        })

  const juiceMode = piling ? "pile" : gravitying || gravityOn ? "gravity" : "off"

  return (
    <div
      ref={canvasRef}
      className="fm-desktop velvet fm-icon-canvas"
      data-list-icons-desktop="on"
      data-icon-pack={paintMode}
      data-piling={piling ? "on" : undefined}
      data-gravity={gravitying || gravityOn ? "on" : undefined}
      onMouseDown={onGravityCanvasPointer}
      onScroll={(event) => {
        const el = event.currentTarget
        setScrollBand((prev) =>
          Math.abs(prev.top - el.scrollTop) < 48 && prev.height === el.clientHeight
            ? prev
            : { top: el.scrollTop, height: el.clientHeight || prev.height },
        )
      }}
    >
      <div
        ref={flightRef}
        className={`fm-icon-flight${piling ? " is-piling" : ""}`}
        style={{ transformOrigin: "top center" }}
      >
        <div
          className={`fm-icon-grid fm-icon-grid-free${piling ? " fm-pile-box" : ""}`}
          style={{ position: "relative", minHeight: gridMinHeight, width: "100%" }}
          data-pile-container={piling ? "on" : undefined}
        >
          <ListIconPhysicsJuice
            mode={juiceMode}
            canvasRootRef={canvasRef}
            iconPositions={shown}
            edges={gravityEdges}
            tasks={tasks}
            width={canvasWidth}
            height={gridMinHeight}
          />
          {paintTasks.map((task) => {
            const pos = shown[task.id] ?? { x: VELVET_ICON_CELL.pad, y: VELVET_ICON_CELL.pad }
            const title = itemTitle(task)
            const isDragging = dragKey === task.id
            // During live sims, left/top are DOM-only — React style would fight paintDom every render.
            const liveSim = piling || gravitying
            const bodyMass = gravityBodiesRef.current?.find((b) => b.id === task.id)?.mass
            const glow = gravitying || gravityOn ? nodeGlowLevel(bodyMass ?? 1) : 0
            return (
              <div
                key={task.id}
                data-icon-entry
                data-kind="task"
                data-id={task.id}
                data-gravity-mass={glow > 0 ? String(glow) : undefined}
                className={`fm-icon fm-icon-free ${isDragging || pileHeldId === task.id ? `fm-icon-dragging ${FLING_JUICE.GRABBING_CLASS}` : FLING_JUICE.GRAB_CLASS}${pileHeldId === task.id ? " is-pile-held" : ""}${selectMode && selected.has(task.id) ? " selected" : ""}`}
                style={
                  liveSim
                    ? { position: "absolute" }
                    : { position: "absolute", left: pos.x, top: pos.y }
                }
                onMouseDown={(event) => beginPointerDrag(task, event)}
                onMouseEnter={() => {
                  if (!gravityingRef.current) return
                  gravityHotIdRef.current = task.id
                }}
                onMouseLeave={() => {
                  if (gravityHotIdRef.current === task.id) gravityHotIdRef.current = null
                }}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)
                }}
                title={
                  gravitying || gravityOn
                    ? `${title} — grab to fling through the field`
                    : title
                }
              >
                <ItemSelectCheckbox
                  selectMode={selectMode}
                  selected={selected.has(task.id)}
                  label={title}
                  onToggle={() => onToggleTaskSelect?.(task.id)}
                />
                {!selectMode && (
                  <button
                    type="button"
                    className="fm-icon-edit"
                    title="Change icon"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onIconPickerOpen(task.id)
                    }}
                  >
                    ✎
                  </button>
                )}
                <div className="fm-icon-img-wrap">
                  <img
                    className="fm-icon-img"
                    src={iconFor(task.id, task.icon)}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span className="fm-icon-label">{title}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
