/**
 * components/Lab/BimFlow/flow-canvas.tsx — The node board
 *
 * Nodes sit at their saved x/y. Drag a node to move it. Drag from a port on
 * its right edge onto another node to wire it (a gate has a yes and a no
 * port). Click a wire to select it. When a message's trace is open, the nodes
 * it reached glow and the wires it took are lit. Drag the empty board to pan.
 * `glow` paints a live test run: finished nodes in the test's color, the node
 * running now pulsing in it. `readOnly` makes the board a viewer.
 */
"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import type { Flow, FlowNode, FlowPort, TraceStep } from "@/lib/bim-flow/types"

export const NODE_W = 176
export const NODE_H = 58

const KIND_TAG: Record<FlowNode["kind"], string> = {
  message: "IN",
  gate: "Y/N",
  search: "FIND",
  choose: "PICK",
  extract: "PULL",
  propose: "WRITE?",
  blocks: "SPANS",
  related: "TERMS",
  retrieve: "READ",
  answer: "SAY",
  route: "ROUTE",
  handoff: "HAND OFF",
  link: "LINK",
  compute: "COUNT",
  clarify: "WHICH?",
  guard: "KNOWN?",
  fallback: "ELSE",
}

/** A route node grows a row per output so every port has room. */
export function nodeH(node: FlowNode): number {
  return node.kind === "route" ? Math.max(NODE_H, 20 * (node.config.routes?.length ?? 0) + 22) : NODE_H
}

/** Gate-like nodes branch on yes / no. */
const twoPort = (node: FlowNode) => node.kind === "gate" || node.kind === "guard" || node.kind === "clarify"

function portY(node: FlowNode, port: FlowPort): number {
  if (node.kind === "route") {
    const i = Math.max(0, (node.config.routes ?? []).findIndex((r) => `r:${r.key}` === port))
    return node.y + 28 + i * 20
  }
  if (!twoPort(node)) return node.y + nodeH(node) / 2
  return node.y + (port === "yes" ? NODE_H * 0.32 : NODE_H * 0.74)
}

function ports(node: FlowNode): FlowPort[] {
  if (node.kind === "route") return (node.config.routes ?? []).map((r) => `r:${r.key}` as FlowPort)
  if (node.kind === "handoff") return []
  if (twoPort(node)) return ["yes", "no"]
  if (node.kind === "propose" || node.kind === "blocks") return []
  return ["out"]
}

function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2)
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

export function FlowCanvas(props: {
  flow: Flow
  selectedNodeId: string | null
  selectedEdgeId: string | null
  trace: TraceStep[] | null
  onSelectNode: (id: string | null) => void
  onSelectEdge: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onConnect: (from: string, to: string, port: FlowPort) => void
  glow?: { color: string; current: string | null; done: string[]; failed?: string[]; glyphs?: Record<string, string> }
  readOnly?: boolean
  /** Fit the whole graph in view when it first appears. */
  fit?: boolean
}) {
  const { flow, trace, glow, readOnly } = props
  const boardRef = useRef<HTMLDivElement>(null)
  const [wire, setWire] = useState<{ from: string; port: FlowPort; x: number; y: number } | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const [scale, setScale] = useState(0.68)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const [panning, setPanning] = useState(false)

  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  const reached = new Map((trace ?? []).map((s) => [s.nodeId, s]))
  const width = Math.max(...flow.nodes.map((n) => n.x + NODE_W), 600) + 80
  const height = Math.max(...flow.nodes.map((n) => n.y + nodeH(n)), 400) + 80

  const local = (e: { clientX: number; clientY: number }) => {
    const r = boardRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  useEffect(() => {
    const box = scrollRef.current
    if (props.fit && box && box.clientWidth > 0) setScale(Math.min(1, Math.max(0.3, Math.min(box.clientWidth / width, box.clientHeight / height))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fit])

  const isBackground = (t: EventTarget) => {
    const el = t as Element
    return el === scrollRef.current || el === boardRef.current || el.classList?.contains("bf-wires") === true
  }

  const onPanDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !isBackground(e.target)) return
    const box = e.currentTarget
    pan.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop, moved: false }
    box.setPointerCapture(e.pointerId)
  }

  const onPanMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved && Math.abs(dx) + Math.abs(dy) < 4) return
    if (!p.moved) setPanning(true)
    p.moved = true
    e.currentTarget.scrollLeft = p.left - dx
    e.currentTarget.scrollTop = p.top - dy
  }

  const onPanUp = () => {
    const p = pan.current
    pan.current = null
    setPanning(false)
    // A click that never moved clears the selection.
    if (p && !p.moved) {
      props.onSelectNode(null)
      props.onSelectEdge(null)
    }
  }

  const onNodeDown = (e: ReactPointerEvent, node: FlowNode) => {
    if (readOnly) return
    if ((e.target as HTMLElement).dataset.port) return
    const p = local(e)
    drag.current = { id: node.id, dx: p.x - node.x, dy: p.y - node.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onNodeMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = local(e)
    d.moved = true
    props.onMove(d.id, Math.max(0, Math.round(p.x - d.dx)), Math.max(0, Math.round(p.y - d.dy)))
  }

  const onNodeUp = (node: FlowNode) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) props.onSelectNode(node.id)
  }

  const onPortDown = (e: ReactPointerEvent, node: FlowNode, port: FlowPort) => {
    e.stopPropagation()
    if (readOnly) return
    const p = local(e)
    setWire({ from: node.id, port, x: p.x, y: p.y })
    boardRef.current?.setPointerCapture(e.pointerId)
  }

  const onBoardMove = (e: ReactPointerEvent) => {
    if (wire) setWire({ ...wire, ...local(e) })
  }

  const onBoardUp = (e: ReactPointerEvent) => {
    if (!wire) return
    const p = local(e)
    const target = flow.nodes.find((n) => p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + nodeH(n))
    if (target && target.id !== wire.from && target.kind !== "message") props.onConnect(wire.from, target.id, wire.port)
    setWire(null)
  }

  const wireFrom = wire ? byId.get(wire.from) : undefined

  const zoom = (next: number) => setScale(Math.min(1.2, Math.max(0.3, Math.round(next * 100) / 100)))

  return (
    <div className="bf-canvas">
    <div className="bf-zoom">
      <button type="button" data-no95 onClick={() => zoom(scale - 0.1)} aria-label="Zoom out">−</button>
      <span>{Math.round(scale * 100)}%</span>
      <button type="button" data-no95 onClick={() => zoom(scale + 0.1)} aria-label="Zoom in">+</button>
      <button
        type="button"
        data-no95
        onClick={(e) => {
          const box = e.currentTarget.closest(".bf-canvas")?.querySelector(".bf-board-scroll")
          if (box) zoom(Math.min(box.clientWidth / width, box.clientHeight / height))
        }}
      >
        Fit
      </button>
    </div>
    <div
      ref={scrollRef}
      className={`bf-board-scroll${panning ? " is-panning" : ""}`}
      onPointerDown={onPanDown}
      onPointerMove={onPanMove}
      onPointerUp={onPanUp}
      onPointerCancel={onPanUp}
    >
      <div style={{ width: width * scale, height: height * scale }}>
      <div
        ref={boardRef}
        className="bf-board"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
      >
        <svg className="bf-wires" width={width} height={height}>
          {flow.edges.map((edge) => {
            const a = byId.get(edge.from)
            const b = byId.get(edge.to)
            if (!a || !b) return null
            const taken = reached.has(edge.to) && reached.get(edge.from)?.port === edge.port && !reached.get(edge.from)?.error
            const d = wirePath(a.x + NODE_W, portY(a, edge.port), b.x, b.y + nodeH(b) / 2)
            return (
              <g key={edge.id} className={`bf-wire is-${edge.port.startsWith("r:") ? "route" : edge.port}${taken ? " is-taken" : ""}${props.selectedEdgeId === edge.id ? " is-selected" : ""}`}>
                <path d={d} className="bf-wire-hit" onPointerDown={(e) => { e.stopPropagation(); props.onSelectEdge(edge.id) }} />
                <path d={d} className="bf-wire-line" />
              </g>
            )
          })}
          {wire && wireFrom ? (
            <path className="bf-wire-line is-draft" d={wirePath(wireFrom.x + NODE_W, portY(wireFrom, wire.port), wire.x, wire.y)} />
          ) : null}
        </svg>

        {flow.nodes.map((node) => {
          const step = reached.get(node.id)
          const live = glow ? (glow.current === node.id ? " is-now" : glow.failed?.includes(node.id) ? " is-error" : glow.done.includes(node.id) ? " is-done" : " is-dark") : ""
          const state = glow ? live : !trace ? "" : step ? (step.error ? " is-error" : twoPort(node) ? ` is-${step.port}` : " is-lit") : " is-dark"
          return (
            <div
              key={node.id}
              className={`bf-node kind-${node.kind}${state}${props.selectedNodeId === node.id ? " is-selected" : ""}`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: nodeH(node), ...(glow ? ({ "--bf-test": glow.color } as CSSProperties) : null) }}
              onPointerDown={(e) => onNodeDown(e, node)}
              onPointerMove={onNodeMove}
              onPointerUp={() => onNodeUp(node)}
            >
              <span className="bf-node-tag">{node.kind === "message" ? (node.config.entry ? `START · ${node.config.entry}` : "START") : KIND_TAG[node.kind]}</span>
              <span className="bf-node-label">{node.label}</span>
              {step ? <span className="bf-node-out">{stepGlyph(node, step)}</span> : glow?.glyphs?.[node.id] ? <span className="bf-node-out">{glow.glyphs[node.id]}</span> : null}
              {node.kind !== "message" ? <span className="bf-port is-in" /> : null}
              {ports(node).map((port) => (
                <span
                  key={port}
                  data-port={port}
                  className={`bf-port is-${port}`}
                  style={{ top: portY(node, port) - node.y }}
                  title={port}
                  onPointerDown={(e) => onPortDown(e, node, port)}
                >
                  {port === "out" ? "" : port === "yes" ? "Y" : port === "no" ? "N" : ""}
                  {port.startsWith("r:") ? <span className="bf-port-label">{node.config.routes?.find((r) => `r:${r.key}` === port)?.label ?? port.slice(2)}</span> : null}
                </span>
              ))}
            </div>
          )
        })}
      </div>
      </div>
    </div>
    </div>
  )
}

/** One short reading of what a node did, painted on its face. */
export function stepGlyph(node: Pick<FlowNode, "kind">, step: Pick<TraceStep, "error" | "output" | "ms">): string {
  if (step.error) return "ERR"
  const out = step.output as Record<string, unknown> | string | null
  if (node.kind === "gate") return String(out).toUpperCase()
  if (node.kind === "guard") return out && typeof out === "object" && (out as { holds?: boolean }).holds ? "KNOWN" : "UNKNOWN"
  if (node.kind === "fallback") return "ELSE"
  if (node.kind === "clarify") return out && typeof out === "object" && "question" in out ? "ASK" : "CLEAR"
  if (node.kind === "compute" && out && typeof out === "object") return `${out.total ?? 0} rows`
  if ((node.kind === "search" || node.kind === "link") && out && typeof out === "object") return `${(out.hits as unknown[]).length} hits`
  if (node.kind === "choose" && out && typeof out === "object") return ((out.picks as string[]) ?? []).join(", ") || "none"
  if (node.kind === "blocks" && out && typeof out === "object") return out.activity ? `${out.activity} · ${out.relation}` : "—"
  if (node.kind === "propose" && out && typeof out === "object") return "✓"
  if (node.kind === "route" && out && typeof out === "object") return `${((out.routes as string[]) ?? []).join(", ") || "none"} · ${String(out.by ?? "")}`
  if (node.kind === "handoff" && out && typeof out === "object") return `→ ${String(out.handedTo ?? "")}`
  if (node.kind === "related" && out && typeof out === "object") return `${((out.terms as string[]) ?? []).length} words`
  if (node.kind === "retrieve" && out && typeof out === "object") return `${out.total ?? 0} rows`
  if (node.kind === "answer" && out && typeof out === "object") return String(out.confidence ?? "")
  return `${step.ms}ms`
}
