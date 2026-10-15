"use client"

/**
 * SVG force-cord overlay for List Icons Gravity / Field (and optional PILE proximity).
 *
 * Mount beside icons inside `.fm-icon-grid-free` (absolute, pointer-events: none).
 * Pure paint — pass `{id,x,y}[]` centers + `{a,b,weight}` edges; physics stays elsewhere.
 *
 * @see list-icon-force-links.ts for geometry / weight mapping
 * @see list-icon-physics-juice.tsx for Gravity / Pile host
 */

import { useId, useMemo } from "react"
import {
  buildForceLinkStrokes,
  prefersForceLinksReducedMotion,
  type ForceLinkEdge,
  type ForceLinkNode,
} from "@/components/Lists/lib/list-icon-force-links"
import "@/components/Lists/lib/list-icon-force-links.css"

export type ListIconForceLinksOverlayProps = {
  /** Icon centers in canvas pixels. */
  nodes: readonly ForceLinkNode[]
  /** Undirected weighted edges. */
  edges: readonly ForceLinkEdge[]
  /** Playfield size (SVG viewBox). */
  width: number
  height: number
  /** Quadratic bulge (default true). Straight when false or reduced motion. */
  curved?: boolean
  /** Skip pulse; static cords. Default: match prefers-reduced-motion. */
  reducedMotion?: boolean
  className?: string
  /** data-ui-name for Names overlay. */
  label?: string
}

/**
 * Weighted springs/cords between icons. Opacity and thickness follow weight;
 * heavy edges get a subtle pulse unless reduced motion.
 */
export function ListIconForceLinksOverlay({
  nodes,
  edges,
  width,
  height,
  curved = true,
  reducedMotion,
  className,
  label = "Force links",
}: ListIconForceLinksOverlayProps) {
  const sheenId = useId().replace(/:/g, "")
  const reduce =
    typeof reducedMotion === "boolean" ? reducedMotion : prefersForceLinksReducedMotion()
  const useCurve = curved && !reduce
  const w = Math.max(1, width)
  const h = Math.max(1, height)

  const strokes = useMemo(
    () => buildForceLinkStrokes(nodes, edges, { curved: useCurve }),
    [nodes, edges, useCurve],
  )

  if (strokes.length === 0 || nodes.length < 2) return null

  return (
    <svg
      className={`fm-force-links${reduce ? " is-static" : ""}${className ? ` ${className}` : ""}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      data-ui-name={label}
      data-force-links="on"
      data-reduced-motion={reduce ? "on" : undefined}
    >
      <defs>
        <linearGradient id={`fm-force-link-sheen-${sheenId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(210, 236, 255, 0.95)" />
          <stop offset="55%" stopColor="rgba(168, 214, 196, 0.85)" />
          <stop offset="100%" stopColor="rgba(240, 220, 170, 0.9)" />
        </linearGradient>
      </defs>
      <g className="fm-force-links-cords">
        {strokes.map((stroke) => (
          <path
            key={stroke.key}
            className={`fm-force-link-cord${stroke.heavy && !reduce ? " is-heavy" : ""}`}
            d={stroke.d}
            fill="none"
            stroke={`url(#fm-force-link-sheen-${sheenId})`}
            strokeWidth={stroke.strokeWidth}
            strokeOpacity={stroke.opacity}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            data-weight={stroke.weight.toFixed(2)}
            data-heavy={stroke.heavy ? "on" : undefined}
          />
        ))}
      </g>
    </svg>
  )
}
