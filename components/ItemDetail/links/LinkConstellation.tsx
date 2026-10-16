/**
 * components/ItemDetail/links/LinkConstellation.tsx — This item and its links, drawn
 *
 * The open item's orb sits in the center of a CRT well; linked orbs sit in
 * family sectors around it (`lib/link-constellation-layout.ts`). Cords say
 * which way a link reads: solid with an arrow at the other orb (this item
 * says it), dashed and flowing toward the center (the other item says it),
 * a twin strand (both), dotted (suggested). Hover or focus names the cord.
 *
 * Motion is a verb: orbs ease out of the center on open; pressing the well
 * stirs them and springs them home; an orb can be grabbed and flung. Reduced
 * motion shows the final picture. Click selects the ledger row;
 * double-click (or Enter twice) opens the item through the host's guard.
 */
"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { iconFor } from "@/components/Icons/Icon"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { layoutConstellation, layoutSecondRing } from "@/lib/link-constellation-layout"
import type { EgoEdge } from "@/lib/link-graph"
import type { Task } from "@/lib/types"

const HEIGHT = 280
const NODE_R = 20
const CENTER_R = 32
const SPRING = 70
const DAMP = 7.5

interface Body {
  x: number
  y: number
  vx: number
  vy: number
  held: boolean
}

interface LinkConstellationProps {
  center: Task
  edges: EgoEdge[]
  secondRing: { from: string; to: string; relation: string }[]
  showSecondRing: boolean
  onToggleSecondRing: () => void
  byId: Map<string, Task>
  activeKey: string | null
  onActive: (key: string | null) => void
  onOpenItem: (id: string) => void
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

function cordGeometry(ax: number, ay: number, bx: number, by: number, bend: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const qx = (ax + bx) / 2 + nx * len * bend
  const qy = (ay + by) / 2 + ny * len * bend
  return { qx, qy, nx, ny, len }
}

function arrowAt(tipX: number, tipY: number, fromX: number, fromY: number): string {
  const dx = tipX - fromX
  const dy = tipY - fromY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const size = 7
  const bx = tipX - ux * size
  const by = tipY - uy * size
  return `M${tipX},${tipY} L${bx - uy * size * 0.55},${by + ux * size * 0.55} L${bx + uy * size * 0.55},${by - ux * size * 0.55} Z`
}

/** Point along a quadratic at `t`. */
function quad(ax: number, ay: number, qx: number, qy: number, bx: number, by: number, t: number) {
  const u = 1 - t
  return { x: u * u * ax + 2 * u * t * qx + t * t * bx, y: u * u * ay + 2 * u * t * qy + t * t * by }
}

export function LinkConstellation({
  center,
  edges,
  secondRing,
  showSecondRing,
  onToggleSecondRing,
  byId,
  activeKey,
  onActive,
  onOpenItem,
}: LinkConstellationProps) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(520)
  const layout = useMemo(() => layoutConstellation(edges, width, HEIGHT), [edges, width])
  const ring2 = useMemo(
    () => (showSecondRing ? layoutSecondRing(layout, secondRing) : []),
    [showSecondRing, layout, secondRing],
  )
  const bodies = useRef(new Map<string, Body>())
  const [, setFrame] = useState(0)
  const raf = useRef<number | null>(null)
  const grab = useRef<{ key: string; px: number; py: number; moved: number; lastT: number; vx: number; vy: number } | null>(null)

  useLayoutEffect(() => {
    const el = wellRef.current
    if (!el) return
    const measure = () => setWidth(Math.max(260, Math.round(el.clientWidth || 520)))
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const home = useMemo(() => new Map(layout.nodes.map((n) => [n.key, n])), [layout])

  const run = () => {
    if (raf.current !== null || reducedMotion() || typeof requestAnimationFrame !== "function") return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      let moving = false
      for (const [key, body] of bodies.current) {
        const target = home.get(key)
        if (!target || body.held) {
          if (body.held) moving = true
          continue
        }
        const ax = -SPRING * (body.x - target.x) - DAMP * body.vx
        const ay = -SPRING * (body.y - target.y) - DAMP * body.vy
        body.vx += ax * dt
        body.vy += ay * dt
        body.x += body.vx * dt
        body.y += body.vy * dt
        if (Math.abs(body.vx) + Math.abs(body.vy) > 3 || Math.hypot(body.x - target.x, body.y - target.y) > 0.6) moving = true
        else {
          body.x = target.x
          body.y = target.y
          body.vx = 0
          body.vy = 0
        }
      }
      setFrame((f) => f + 1)
      raf.current = moving ? requestAnimationFrame(tick) : null
    }
    raf.current = requestAnimationFrame(tick)
  }

  // New or moved slots: new orbs start at the center and ease out; known orbs spring to their new slot.
  useEffect(() => {
    const still = reducedMotion()
    const next = new Map<string, Body>()
    for (const node of layout.nodes) {
      const prior = bodies.current.get(node.key)
      next.set(
        node.key,
        prior ??
          (still
            ? { x: node.x, y: node.y, vx: 0, vy: 0, held: false }
            : { x: layout.cx, y: layout.cy, vx: 0, vy: 0, held: false }),
      )
    }
    bodies.current = next
    setFrame((f) => f + 1)
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    },
    [],
  )

  const stir = () => {
    if (reducedMotion()) return
    for (const [key, body] of bodies.current) {
      const target = home.get(key)
      if (!target) continue
      const kick = 260 + Math.random() * 220
      body.vx += Math.cos(target.angle + Math.PI / 2) * kick + (Math.random() - 0.5) * 120
      body.vy += Math.sin(target.angle + Math.PI / 2) * kick + (Math.random() - 0.5) * 120
    }
    run()
  }

  const pointFor = (key: string) => {
    const body = bodies.current.get(key)
    const node = home.get(key)
    return body ?? node ?? { x: layout.cx, y: layout.cy }
  }

  const onOrbDown = (event: ReactPointerEvent<HTMLButtonElement>, key: string) => {
    event.stopPropagation()
    const body = bodies.current.get(key)
    if (!body || reducedMotion()) return
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    grab.current = { key, px: event.clientX, py: event.clientY, moved: 0, lastT: performance.now(), vx: 0, vy: 0 }
  }

  const onOrbMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const g = grab.current
    if (!g) return
    const body = bodies.current.get(g.key)
    if (!body) return
    const dx = event.clientX - g.px
    const dy = event.clientY - g.py
    g.moved += Math.abs(dx) + Math.abs(dy)
    if (g.moved < 4) return
    const now = performance.now()
    const dt = Math.max(1, now - g.lastT) / 1000
    g.vx = dx / dt
    g.vy = dy / dt
    g.lastT = now
    g.px = event.clientX
    g.py = event.clientY
    body.held = true
    body.x += dx
    body.y += dy
    run()
    setFrame((f) => f + 1)
  }

  const onOrbUp = (key: string) => {
    const g = grab.current
    grab.current = null
    const body = bodies.current.get(key)
    if (!g || !body) return false
    const dragged = g.moved >= 4
    if (body.held) {
      body.held = false
      body.vx = Math.max(-1600, Math.min(1600, g.vx))
      body.vy = Math.max(-1600, Math.min(1600, g.vy))
      run()
    }
    return dragged
  }

  const mutualCount = edges.filter((e) => e.direction === "mutual").length
  const waiting = edges.filter((e) => e.direction === "in").length
  const realCount = edges.filter((e) => e.direction !== "derived").length
  const showLabels = edges.length <= 6
  const active = activeKey ? edges.find((e) => e.key === activeKey) : undefined
  const activePoint = active ? pointFor(active.key) : null
  const ring2Pos = new Map(ring2.map((r) => [r.id, r]))

  return (
    <div
      ref={wellRef}
      className="rl-well"
      data-testid="link-constellation"
      role="group"
      aria-label={`Links of ${itemTitleOrUntitled(center)}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === "svg") stir()
      }}
    >
      <div className="rl-well-head">
        <span>
          {realCount} {realCount === 1 ? "link" : "links"}
          {mutualCount ? ` · ${mutualCount} both ways` : ""}
          {waiting ? ` · ${waiting} one way in` : ""}
        </span>
        {secondRing.length > 0 ? (
          <button
            type="button"
            aria-pressed={showSecondRing}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleSecondRing}
          >
            Their links
          </button>
        ) : null}
      </div>

      <svg className="rl-svg" viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden>
        {layout.sectors.map((sector) => {
          if (sector.end - sector.start < 0.05) return null
          const r = layout.radius + 34
          const a0 = sector.start + 0.04
          const a1 = sector.end - 0.04
          const large = a1 - a0 > Math.PI ? 1 : 0
          const d = `M${layout.cx + Math.cos(a0) * r},${layout.cy + Math.sin(a0) * r} A${r},${r} 0 ${large} 1 ${layout.cx + Math.cos(a1) * r},${layout.cy + Math.sin(a1) * r}`
          return <path key={sector.family} className="rl-sector" data-family={sector.family} d={d} />
        })}
        {ring2.map((row) => {
          const from = pointFor(layout.nodes.find((n) => n.id === row.from)?.key ?? "")
          return <line key={`r2-${row.id}`} className="rl-ring2" x1={from.x} y1={from.y} x2={row.x} y2={row.y} />
        })}
        {edges.map((edge, i) => {
          const p = pointFor(edge.key)
          const bend = (i % 2 === 0 ? 1 : -1) * 0.08
          const { qx, qy, nx, ny, len } = cordGeometry(layout.cx, layout.cy, p.x, p.y, bend)
          const dim = !!activeKey && activeKey !== edge.key
          const strands = edge.direction === "mutual" ? [-2.2, 2.2] : [0]
          const outTip = quad(layout.cx, layout.cy, qx, qy, p.x, p.y, Math.max(0, 1 - (NODE_R + 5) / len))
          const outFrom = quad(layout.cx, layout.cy, qx, qy, p.x, p.y, Math.max(0, 1 - (NODE_R + 18) / len))
          const inTip = quad(layout.cx, layout.cy, qx, qy, p.x, p.y, Math.min(1, (CENTER_R + 5) / len))
          const inFrom = quad(layout.cx, layout.cy, qx, qy, p.x, p.y, Math.min(1, (CENTER_R + 18) / len))
          const mid = quad(layout.cx, layout.cy, qx, qy, p.x, p.y, 0.5)
          return (
            <g
              key={edge.key}
              className="rl-cord-group"
              data-family={edge.family}
              data-active={activeKey === edge.key}
              data-dim={dim}
            >
              {strands.map((offset) => (
                <path
                  key={offset}
                  className="rl-cord"
                  data-direction={edge.direction}
                  d={`M${layout.cx + nx * offset},${layout.cy + ny * offset} Q${qx + nx * offset},${qy + ny * offset} ${p.x + nx * offset},${p.y + ny * offset}`}
                />
              ))}
              {edge.direction === "out" || edge.direction === "mutual" ? (
                <path className="rl-arrow" d={arrowAt(outTip.x, outTip.y, outFrom.x, outFrom.y)} />
              ) : null}
              {edge.direction === "in" || edge.direction === "mutual" ? (
                <path className="rl-arrow" d={arrowAt(inTip.x, inTip.y, inFrom.x, inFrom.y)} />
              ) : null}
              {showLabels || activeKey === edge.key ? (
                <text className="rl-cord-label" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle">
                  {edge.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      <button
        type="button"
        className="rl-orb rl-center"
        style={{ transform: `translate(${layout.cx}px, ${layout.cy}px)` }}
        aria-label={`${itemTitleOrUntitled(center)} (this item)`}
        onPointerDown={(e) => {
          e.stopPropagation()
          stir()
        }}
      >
        <img src={iconFor(center.id, center.icon)} alt="" data-orb draggable={false} />
        <span className="rl-orb-name">{itemTitleOrUntitled(center)}</span>
      </button>

      {edges.map((edge, index) => {
        const p = pointFor(edge.key)
        const other = byId.get(edge.otherId)
        const title = other ? itemTitleOrUntitled(other) : "Item no longer here"
        return (
          <button
            key={edge.key}
            type="button"
            className="rl-orb"
            data-family={edge.family}
            data-active={activeKey === edge.key}
            data-ring="1"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            aria-label={`${title}, ${edge.label}, ${edge.direction === "in" ? "from them" : edge.direction === "mutual" ? "both ways" : edge.direction === "derived" ? "suggested" : "from this item"}`}
            onPointerDown={(e) => onOrbDown(e, edge.key)}
            onPointerMove={onOrbMove}
            onPointerUp={(e) => {
              const dragged = onOrbUp(edge.key)
              if (dragged) e.preventDefault()
            }}
            onClick={() => onActive(activeKey === edge.key ? null : edge.key)}
            onDoubleClick={() => onOpenItem(edge.otherId)}
            onFocus={() => onActive(edge.key)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
              if (!step) {
                if (e.key === "Enter" && activeKey === edge.key) {
                  e.preventDefault()
                  onOpenItem(edge.otherId)
                }
                return
              }
              e.preventDefault()
              const orbs = wellRef.current?.querySelectorAll<HTMLButtonElement>('.rl-orb[data-ring="1"]')
              orbs?.[(index + step + edges.length) % edges.length]?.focus()
            }}
            onMouseEnter={() => onActive(edge.key)}
            onMouseLeave={() => onActive(null)}
          >
            <img src={iconFor(edge.otherId, other?.icon)} alt="" data-orb draggable={false} />
            <span className="rl-orb-name">{title}</span>
          </button>
        )
      })}

      {ring2.map((row) => {
        const other = byId.get(row.id)
        const title = other ? itemTitleOrUntitled(other) : row.id
        return (
          <button
            key={`ring2-${row.id}`}
            type="button"
            className="rl-orb"
            data-ring="2"
            title={title}
            aria-label={`${title}, linked from ${itemTitleOrUntitled(byId.get(row.from) ?? center)}`}
            style={{ transform: `translate(${ring2Pos.get(row.id)!.x}px, ${ring2Pos.get(row.id)!.y}px)` }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={() => onOpenItem(row.id)}
          >
            <img src={iconFor(row.id, other?.icon)} alt="" data-orb draggable={false} />
          </button>
        )
      })}

      {edges.length === 0 ? <span className="rl-empty">Nothing linked yet</span> : null}

      {active && activePoint ? (
        <span className="rl-tip" data-family={active.family} style={{ left: activePoint.x, top: activePoint.y }}>
          {itemTitleOrUntitled(center)} {active.label} {itemTitleOrUntitled(byId.get(active.otherId) ?? center)}
        </span>
      ) : null}
    </div>
  )
}
