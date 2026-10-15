"use client"

/**
 * Thin host for List Icons physics visual juice.
 *
 * Gravity agent: pass mode="gravity", canvasRootRef, edges (or tasks). Host
 * rAF-samples DOM centers so cords track grab/throw; falls back to React poses.
 *
 * Pile agent: pass mode="pile" + canvasRootRef. Host rAF-samples DOM centers
 * (pile paints DOM-only) and draws proximity cords — no pile core changes.
 *
 *   <ListIconPhysicsJuice
 *     mode={piling ? "pile" : gravityOn ? "gravity" : "off"}
 *     canvasRootRef={canvasRef}
 *     iconPositions={shown}
 *     edges={gravityEdges}
 *     width={canvasWidth}
 *     height={gridMinHeight}
 *   />
 */

import { useEffect, useMemo, useState, type RefObject } from "react"
import {
  buildGravityEdges,
  tasksToGravityItems,
  type GravityEdge,
} from "@/components/Lists/lib/list-icon-gravity"
import {
  buildProximityEdges,
  FORCE_LINK_PROXIMITY,
  FORCE_LINK_STYLE,
  nodesFromIconPositions,
  prefersForceLinksReducedMotion,
  readIconCentersFromCanvas,
  type ForceLinkEdge,
  type ForceLinkNode,
} from "@/components/Lists/lib/list-icon-force-links"
import { ListIconForceLinksOverlay } from "@/components/Lists/lib/list-icon-force-links-overlay"
import type { IconPos } from "@/components/Lists/lib/velvet-icon-grid"
import type { Task } from "@/lib/types"

export type PhysicsJuiceMode = "off" | "gravity" | "pile"

export type ListIconPhysicsJuiceProps = {
  mode: PhysicsJuiceMode
  /** Canvas or flight root — used for pile DOM sampling. */
  canvasRootRef?: RefObject<HTMLElement | null>
  /** Velvet top-left positions (Gravity / idle). */
  iconPositions?: Record<string, IconPos>
  /** Prebuilt edges; when omitted in gravity mode, built from `tasks`. */
  edges?: readonly ForceLinkEdge[] | readonly GravityEdge[]
  /** Used only when edges omitted and mode is gravity. */
  tasks?: readonly Task[]
  width: number
  height: number
  curved?: boolean
  reducedMotion?: boolean
}

/**
 * Mount point for force-link juice. Returns null when mode is off or there is
 * nothing to draw.
 */
export function ListIconPhysicsJuice({
  mode,
  canvasRootRef,
  iconPositions,
  edges: edgesProp,
  tasks,
  width,
  height,
  curved = true,
  reducedMotion,
}: ListIconPhysicsJuiceProps) {
  const reduce =
    typeof reducedMotion === "boolean" ? reducedMotion : prefersForceLinksReducedMotion()

  const gravityEdges = useMemo((): ForceLinkEdge[] => {
    if (mode !== "gravity") return []
    if (edgesProp && edgesProp.length > 0) {
      return edgesProp.map((e) => ({ a: e.a, b: e.b, weight: e.weight }))
    }
    if (!tasks || tasks.length === 0) return []
    return buildGravityEdges(tasksToGravityItems(tasks))
  }, [mode, edgesProp, tasks])

  const reactNodes = useMemo((): ForceLinkNode[] => {
    if (mode !== "gravity" || !iconPositions) return []
    return nodesFromIconPositions(iconPositions)
  }, [mode, iconPositions])

  const [liveNodes, setLiveNodes] = useState<ForceLinkNode[]>([])
  const [liveEdges, setLiveEdges] = useState<ForceLinkEdge[]>([])

  const nodeBudget =
    (iconPositions ? Object.keys(iconPositions).length : 0) ||
    reactNodes.length ||
    liveNodes.length
  const largeJuice = nodeBudget > FORCE_LINK_STYLE.LIVE_DOM_N

  useEffect(() => {
    if (mode !== "pile" && mode !== "gravity") {
      setLiveNodes([])
      setLiveEdges([])
      return
    }
    // Large lists: no rAF DOM sampling — React poses (gravity) or no pile cords.
    if (largeJuice) {
      if (mode === "gravity" && reactNodes.length >= 2) {
        setLiveNodes(reactNodes)
        setLiveEdges([])
      } else {
        setLiveNodes([])
        setLiveEdges([])
      }
      return
    }
    let raf = 0
    let alive = true
    let lastPaint = 0
    const PAINT_MS = 32
    const tick = (now: number) => {
      if (!alive) return
      if (now - lastPaint >= PAINT_MS) {
        lastPaint = now
        const root = canvasRootRef?.current ?? null
        const nodes = readIconCentersFromCanvas(root)
        if (nodes.length >= 2) {
          setLiveNodes(nodes)
          if (mode === "pile") {
            const capped =
              nodes.length > FORCE_LINK_PROXIMITY.MAX_NODES
                ? nodes.slice(0, FORCE_LINK_PROXIMITY.MAX_NODES)
                : nodes
            setLiveEdges(buildProximityEdges(capped))
          }
        } else if (mode === "gravity" && reactNodes.length >= 2) {
          setLiveNodes(reactNodes)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [mode, canvasRootRef, reactNodes, largeJuice])

  if (mode === "off") return null

  if (mode === "gravity") {
    const nodes = liveNodes.length >= 2 ? liveNodes : reactNodes
    if (nodes.length < 2 || gravityEdges.length === 0) return null
    // Huge graphs: skip overlay entirely (MAX_STROKES still helps mid-size).
    if (largeJuice && nodes.length > FORCE_LINK_STYLE.LIVE_DOM_N * 2) return null
    return (
      <ListIconForceLinksOverlay
        nodes={nodes}
        edges={gravityEdges}
        width={width}
        height={height}
        curved={curved}
        reducedMotion={reduce || largeJuice}
        label="Gravity force links"
      />
    )
  }

  // pile — large N never mounts proximity cords (compact path / freeze-free)
  if (largeJuice || liveNodes.length < 2 || liveEdges.length === 0) return null
  return (
    <ListIconForceLinksOverlay
      nodes={liveNodes}
      edges={liveEdges}
      width={width}
      height={height}
      curved={false}
      reducedMotion={reduce}
      label="Pile proximity links"
    />
  )
}
