/**
 * components/Lab/BimFlow/flow-canvas.tsx — The node board
 *
 * Nodes sit at their saved x/y. Drag a node to move it. Drag from a port on
 * its right edge onto another node to wire it (a gate has a yes and a no
 * port). Click a wire to select it. When a message's trace is open, the nodes
 * it reached glow and the wires it took are lit.
 */
"use client"

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
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
}

function portY(node: FlowNode, port: FlowPort): number {
  if (node.kind !== "gate") return node.y + NODE_H / 2
  return node.y + (port === "yes" ? NODE_H * 0.32 : NODE_H * 0.74)
}

function ports(node: FlowNode): FlowPort[] {
  if (node.kind === "gate") return ["yes", "no"]
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
}) {
  const { flow, trace } = props
  const boardRef = useRef<HTMLDivElement>(null)
  const [wire, setWire] = useState<{ from: string; port: FlowPort; x: number; y: number } | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)

  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  const reached = new Map((trace ?? []).map((s) => [s.nodeId, s]))
  const width = Math.max(...flow.nodes.map((n) => n.x + NODE_W), 600) + 80
  const height = Math.max(...flow.nodes.map((n) => n.y + NODE_H), 400) + 80

  const local = (e: { clientX: number; clientY: number }) => {
    const r = boardRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onNodeDown = (e: ReactPointerEvent, node: FlowNode) => {
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
    const target = flow.nodes.find((n) => p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + NODE_H)
    if (target && target.id !== wire.from && target.kind !== "message") props.onConnect(wire.from, target.id, wire.port)
    setWire(null)
  }

  const wireFrom = wire ? byId.get(wire.from) : undefined

  return (
    <div className="bf-board-scroll" onPointerDown={(e) => e.target === e.currentTarget && props.onSelectNode(null)}>
      <div
        ref={boardRef}
        className="bf-board"
        style={{ width, height }}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            props.onSelectNode(null)
            props.onSelectEdge(null)
          }
        }}
      >
        <svg className="bf-wires" width={width} height={height}>
          {flow.edges.map((edge) => {
            const a = byId.get(edge.from)
            const b = byId.get(edge.to)
            if (!a || !b) return null
            const taken = reached.has(edge.to) && reached.get(edge.from)?.port === edge.port && !reached.get(edge.from)?.error
            const d = wirePath(a.x + NODE_W, portY(a, edge.port), b.x, b.y + NODE_H / 2)
            return (
              <g key={edge.id} className={`bf-wire is-${edge.port}${taken ? " is-taken" : ""}${props.selectedEdgeId === edge.id ? " is-selected" : ""}`}>
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
          const state = !trace ? "" : step ? (step.error ? " is-error" : node.kind === "gate" ? ` is-${step.port}` : " is-lit") : " is-dark"
          return (
            <div
              key={node.id}
              className={`bf-node kind-${node.kind}${state}${props.selectedNodeId === node.id ? " is-selected" : ""}`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
              onPointerDown={(e) => onNodeDown(e, node)}
              onPointerMove={onNodeMove}
              onPointerUp={() => onNodeUp(node)}
            >
              <span className="bf-node-tag">{KIND_TAG[node.kind]}</span>
              <span className="bf-node-label">{node.label}</span>
              {step ? <span className="bf-node-out">{stepGlyph(node, step)}</span> : null}
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
                  {port === "out" ? "" : port === "yes" ? "Y" : "N"}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** One short reading of what a node did, painted on its face. */
function stepGlyph(node: FlowNode, step: TraceStep): string {
  if (step.error) return "ERR"
  const out = step.output as Record<string, unknown> | string | null
  if (node.kind === "gate") return String(out).toUpperCase()
  if (node.kind === "search" && out && typeof out === "object") return `${(out.hits as unknown[]).length} hits`
  if (node.kind === "choose" && out && typeof out === "object") return ((out.picks as string[]) ?? []).join(", ") || "none"
  if (node.kind === "blocks" && out && typeof out === "object") return out.activity ? `${out.activity} · ${out.relation}` : "—"
  if (node.kind === "propose" && out && typeof out === "object") return "✓"
  return `${step.ms}ms`
}
