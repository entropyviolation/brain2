/**
 * components/ItemDetail/tabs/links/LinkConstellation.tsx — The radial plate
 * (PD 6.4; "Constellation" in the plan, "radial plate" in UI copy per
 * `docs/LINKS_REDESIGN.md` §13).
 *
 * A black-glass well with a phosphor graticule. This item's orb sits in the
 * center; linked items' orbs sit on ring 1 in family sectors
 * (`layoutPlate`, `lib/link-constellation-layout.ts`). SVG cords run under
 * the orbs, colored by family:
 * - out: solid, arrowhead at the other orb.
 * - in: solid, arrowhead at the center. Direction reads from the arrow alone.
 * - mutual: two strands 2px apart, no arrow.
 * - derived: dotted.
 * Labels sit at the cord midpoint on hover / focus, and always when there
 * are six edges or fewer.
 *
 * Verbs: orbs ease out from the center on open (~420ms). Press the well →
 * a stir (`stirGravityField`), then springs pull every orb home
 * (`springHome`). Grab an orb to fling it (`grab/drag/releaseGravityBody`);
 * it springs home. Reduced motion → still, final positions. The frame loop
 * stops while the document is hidden.
 *
 * Each orb is a button "{title}, {relation}, {direction}". Arrow keys walk
 * the ring, Enter / click selects (`onSelect`), double-click opens
 * (`onOpen`, the host's guarded `openItem`). The ledger is the text twin.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { iconFor } from "@/components/Icons/Icon"
import { DIRECTION_WORD, edgePhrase } from "@/components/ItemDetail/tabs/links/LinkLedger"
import type { LinkItemFacts } from "@/components/ItemDetail/tabs/links/link-items"
import {
  grabGravityBody,
  prefersGravityReducedMotion,
  releaseGravityBody,
  stirGravityField,
  dragGravityBody,
  type GravityBody,
} from "@/components/Lists/lib/list-icon-gravity"
import { bodiesHome, layoutPlate, springHome, type PlateNode } from "@/lib/link-constellation-layout"
import { secondRing, type EgoEdge } from "@/lib/link-graph"
import type { Task } from "@/lib/types"
import "./rich-links.css"

const CENTER_ORB = 44
const RING1_ORB = 28
const RING2_ORB = 8
const STIR_MS = 1200
const LABEL_ALWAYS_MAX = 6
const FALLBACK = { width: 480, height: 260 }

type Pose = Map<string, { x: number; y: number }>

function toBodies(nodes: readonly PlateNode[], pose: Pose): GravityBody[] {
  return nodes.map((n) => {
    const p = pose.get(n.key) ?? { x: n.x, y: n.y }
    return { id: n.key, x: p.x, y: p.y, vx: 0, vy: 0, mass: 1, held: false }
  })
}

/** Shorten a segment by `pad` at its end, so an arrowhead sits at an orb's rim. */
function trimEnd(x1: number, y1: number, x2: number, y2: number, pad: number) {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1
  const k = Math.max(0, d - pad) / d
  return { x: x1 + (x2 - x1) * k, y: y1 + (y2 - y1) * k }
}

export function LinkConstellation({
  center,
  edges,
  factsFor,
  allTasks,
  selectedKey,
  onSelect,
  onOpen,
  height = FALLBACK.height,
}: {
  center: { id: string; title: string; icon?: string }
  edges: readonly EgoEdge[]
  factsFor: (id: string) => LinkItemFacts | null
  /** Saved tasks, for "Show their links" (ring 2). */
  allTasks: readonly Task[]
  selectedKey?: string | null
  onSelect?: (key: string) => void
  onOpen?: (id: string) => void
  height?: number
}) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK.width)
  const [showRing2, setShowRing2] = useState(false)
  const [entered, setEntered] = useState(false)
  const [live, setLive] = useState<Pose | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const reduced = useMemo(() => prefersGravityReducedMotion(), [])
  const bodiesRef = useRef<GravityBody[]>([])
  const rafRef = useRef(0)
  const dragRef = useRef<{ key: string; x: number; y: number; t: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  )

  useEffect(() => {
    const el = wellRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ring2 = useMemo(
    () => (showRing2 ? secondRing(edges, allTasks, 24, center.id) : []),
    [showRing2, edges, allTasks, center.id],
  )
  const layout = useMemo(() => layoutPlate(edges, { width, height }, ring2), [edges, width, height, ring2])
  const ring1 = useMemo(() => layout.nodes.filter((n) => n.ring === 1), [layout])
  const ring2Nodes = useMemo(() => layout.nodes.filter((n) => n.ring === 2), [layout])
  const slots = useMemo<Pose>(() => new Map(ring1.map((n) => [n.key, { x: n.x, y: n.y }])), [ring1])
  const edgeByKey = useMemo(() => new Map(edges.map((e) => [e.key, e])), [edges])

  // Ease out from the center once, on open.
  useEffect(() => {
    if (reduced) {
      setEntered(true)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [reduced])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const runHome = (startBodies: GravityBody[], untilMs: number) => {
    cancelAnimationFrame(rafRef.current)
    bodiesRef.current = startBodies
    let last = performance.now()
    const started = last
    const tick = (now: number) => {
      if (typeof document !== "undefined" && document.hidden) {
        // Paused while hidden; settle at once when we come back.
        bodiesRef.current = []
        setLive(null)
        return
      }
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const next = springHome(bodiesRef.current, slots, dt) as GravityBody[]
      bodiesRef.current = next
      setLive(new Map(next.map((b) => [b.id, { x: b.x, y: b.y }])))
      const held = next.some((b) => b.held)
      if (!held && (now - started > untilMs || bodiesHome(next, slots))) {
        setLive(null)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const pose = (key: string, node: PlateNode) => {
    if (!entered) return layout.center
    return live?.get(key) ?? { x: node.x, y: node.y }
  }

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = wellRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  const stir = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || event.target !== event.currentTarget) return
    const p = localPoint(event)
    const current = live ?? slots
    runHome(stirGravityField(toBodies(ring1, current), p.x, p.y), STIR_MS)
  }

  const grab = (event: ReactPointerEvent<HTMLButtonElement>, key: string) => {
    if (reduced) return
    const p = localPoint(event)
    dragRef.current = { key, x: p.x, y: p.y, t: performance.now(), vx: 0, vy: 0, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const drag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d) return
    const p = localPoint(event)
    const now = performance.now()
    const dt = Math.max(1, now - d.t) / 1000
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 4) return
    if (!d.moved) {
      d.moved = true
      const bodies = grabGravityBody(toBodies(ring1, live ?? slots), d.key)
      runHome(bodies, Number.POSITIVE_INFINITY)
    }
    d.vx = (p.x - d.x) / dt
    d.vy = (p.y - d.y) / dt
    d.x = p.x
    d.y = p.y
    d.t = now
    bodiesRef.current = dragGravityBody(bodiesRef.current, d.key, p.x, p.y, d.vx, d.vy)
  }

  const release = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d?.moved) return
    const released = releaseGravityBody(bodiesRef.current, d.key, d.vx, d.vy)
    runHome(released, STIR_MS * 2)
  }

  const labelsAlways = edges.length <= LABEL_ALWAYS_MAX
  const families = [...new Set(ring1.map((n) => n.family))]
  const c = layout.center

  return (
    <div className="rl-plate-wrap">
      <div
        ref={wellRef}
        className="rl-plate"
        data-testid="radial-plate"
        data-entered={entered ? "true" : "false"}
        data-live={live ? "true" : undefined}
        data-reduced={reduced ? "true" : undefined}
        role="group"
        aria-label="Radial plate"
        style={{ height }}
        onPointerDown={stir}
      >
        <svg className="rl-plate-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <defs>
            {families.map((family) => (
              <marker
                key={family}
                id={`rl-arrow-${family}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L8 4 L0 8 Z" className={`rl-hue-${family}`} style={{ fill: "currentColor" }} />
              </marker>
            ))}
          </defs>
          <g className="rl-graticule">
            {[0.19, 0.38, 0.47].map((k) => (
              <circle key={k} cx={c.x} cy={c.y} r={Math.min(width, height) * k} />
            ))}
            {layout.sectors.length > 1
              ? layout.sectors.map((s) => (
                  <line
                    key={s.family}
                    x1={c.x}
                    y1={c.y}
                    x2={c.x + Math.min(width, height) * 0.5 * Math.cos(s.start)}
                    y2={c.y + Math.min(width, height) * 0.5 * Math.sin(s.start)}
                  />
                ))
              : null}
          </g>
          {ring2Nodes.map((n) => {
            const parent = ring1.find((p) => p.otherId === n.from)
            if (!parent) return null
            const a = pose(parent.key, parent)
            return <line key={n.key} className="rl-cord-ring2" x1={a.x} y1={a.y} x2={n.x} y2={n.y} />
          })}
          {ring1.map((n) => {
            const edge = edgeByKey.get(n.key)
            if (!edge) return null
            const p = pose(n.key, n)
            const other = factsFor(edge.otherId)?.title ?? "Missing item"
            const tip = `${center.title} — ${edgePhrase(edge)} → ${other}`
            const showLabel = labelsAlways || hoverKey === n.key || selectedKey === n.key
            const hue = `rl-hue-${n.family}`
            const marker = `url(#rl-arrow-${n.family})`
            let strands
            if (edge.direction === "mutual") {
              const d = Math.hypot(p.x - c.x, p.y - c.y) || 1
              const ox = (-(p.y - c.y) / d) * 1
              const oy = ((p.x - c.x) / d) * 1
              strands = (
                <>
                  <line className={`rl-cord ${hue}`} x1={c.x + ox} y1={c.y + oy} x2={p.x + ox} y2={p.y + oy} />
                  <line className={`rl-cord ${hue}`} x1={c.x - ox} y1={c.y - oy} x2={p.x - ox} y2={p.y - oy} />
                </>
              )
            } else if (edge.direction === "in") {
              const end = trimEnd(p.x, p.y, c.x, c.y, CENTER_ORB / 2 + 2)
              strands = <line className={`rl-cord ${hue}`} x1={p.x} y1={p.y} x2={end.x} y2={end.y} markerEnd={marker} />
            } else {
              const end = trimEnd(c.x, c.y, p.x, p.y, RING1_ORB / 2 + 2)
              strands = (
                <line
                  className={`rl-cord ${hue}${edge.direction === "derived" ? " is-derived" : ""}`}
                  x1={c.x}
                  y1={c.y}
                  x2={end.x}
                  y2={end.y}
                  markerEnd={edge.direction === "out" ? marker : undefined}
                />
              )
            }
            return (
              <g
                key={n.key}
                className="rl-cord-group"
                data-direction={edge.direction}
                onPointerEnter={() => setHoverKey(n.key)}
                onPointerLeave={() => setHoverKey((k) => (k === n.key ? null : k))}
              >
                <title>{tip}</title>
                <line className="rl-cord-hit" x1={c.x} y1={c.y} x2={p.x} y2={p.y} />
                {strands}
                {showLabel ? (
                  <text className="rl-cord-label" x={(c.x + p.x) / 2} y={(c.y + p.y) / 2 - 4} textAnchor="middle">
                    {edgePhrase(edge)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <img
          className="rl-orb rl-orb-center"
          data-orb
          src={iconFor(center.id, center.icon)}
          alt=""
          draggable={false}
          style={{ width: CENTER_ORB, height: CENTER_ORB, left: c.x - CENTER_ORB / 2, top: c.y - CENTER_ORB / 2 }}
        />

        {ring2Nodes.map((n) => (
          <img
            key={n.key}
            className="rl-orb rl-orb-ring2"
            data-orb
            src={iconFor(n.otherId, factsFor(n.otherId)?.icon)}
            alt=""
            draggable={false}
            title={factsFor(n.otherId)?.title}
            style={{ width: RING2_ORB, height: RING2_ORB, left: n.x - RING2_ORB / 2, top: n.y - RING2_ORB / 2 }}
          />
        ))}

        {ring1.map((n, i) => {
          const edge = edgeByKey.get(n.key)
          if (!edge) return null
          const facts = factsFor(edge.otherId)
          const p = pose(n.key, n)
          const title = facts?.title ?? "Missing item"
          return (
            <button
              key={n.key}
              type="button"
              className="rl-orb-btn"
              data-no95
              data-orb-key={n.key}
              data-selected={selectedKey === n.key ? "true" : undefined}
              tabIndex={i === focusIndex ? 0 : -1}
              aria-label={`${title}, ${edgePhrase(edge)}, ${DIRECTION_WORD[edge.direction]}`}
              aria-pressed={selectedKey === n.key}
              style={{
                width: RING1_ORB,
                height: RING1_ORB,
                transform: `translate(${p.x - RING1_ORB / 2}px, ${p.y - RING1_ORB / 2}px)`,
              }}
              onFocus={() => {
                setFocusIndex(i)
                setHoverKey(n.key)
              }}
              onBlur={() => setHoverKey((k) => (k === n.key ? null : k))}
              onPointerDown={(event) => {
                event.stopPropagation()
                grab(event, n.key)
              }}
              onPointerMove={drag}
              onPointerUp={release}
              onPointerCancel={release}
              onClick={() => onSelect?.(n.key)}
              onDoubleClick={() => onOpen?.(edge.otherId)}
              onKeyDown={(event) => {
                const step =
                  event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp"
                      ? -1
                      : 0
                if (!step || ring1.length === 0) return
                event.preventDefault()
                const next = (i + step + ring1.length) % ring1.length
                setFocusIndex(next)
                wellRef.current?.querySelectorAll<HTMLButtonElement>(".rl-orb-btn")[next]?.focus()
              }}
            >
              <img className="rl-orb" data-orb src={iconFor(edge.otherId, facts?.icon)} alt="" draggable={false} />
            </button>
          )
        })}

        {edges.length === 0 ? <p className="rl-plate-empty">No links yet.</p> : null}
      </div>
      <div className="rl-plate-foot">
        <button
          type="button"
          className="rl-key rl-switch"
          role="switch"
          aria-checked={showRing2}
          data-on={showRing2 ? "true" : "false"}
          onClick={() => setShowRing2((on) => !on)}
          disabled={edges.length === 0}
        >
          <span className="rl-lamp" aria-hidden />
          Show their links
        </button>
      </div>
    </div>
  )
}
