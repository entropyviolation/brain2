/**
 * components/Lab/IdeaSwarm/PipelineGraph.tsx — The pipeline as a node canvas: one card per node, wires for what feeds what
 *
 * Cards show the node's kind, model and temperature, whether it ran, how long it took and how much it made. A click
 * selects the node for the inspector; the switch on optional nodes turns them on or off. The canvas pans (drag the
 * background) and zooms (wheel, or the corner controls) and fits itself to the window until you move it. Presentational only.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Config, ExtraNode, StageId, StageOut } from "@/lib/idea-swarm/types"
import type { Score } from "@/lib/idea-swarm/score"

export type NodeId = string
type Kind = "input" | "free" | "reader" | "embed" | "writer" | "control" | "output"

type Box = { id: NodeId; x: number; y: number; label: string; kind: Kind; sub: (c: Config) => [string, string?]; optional?: boolean }

export const KIND_NAME: Record<Kind, string> = { input: "input", free: "no model", reader: "weak model", embed: "embedding", writer: "strong model", control: "control", output: "output" }

const BOXES: Box[] = [
  { id: "passage", x: 0, y: 176, label: "Passage", kind: "input", sub: () => ["the pages"] },
  { id: "keyphrases", x: 290, y: 0, label: "Key phrases", kind: "free", sub: (c) => [c.keyphrases.methods.join(" · ") || "none", "deterministic"], optional: true },
  { id: "topicInsight", x: 580, y: 0, label: "Insight on topics", kind: "reader", sub: (c) => [c.topicInsight.knob.model, `t ${c.topicInsight.knob.temperature}`], optional: true },
  { id: "agents", x: 290, y: 176, label: "Readers", kind: "reader", sub: (c) => [c.agents.knob.model, `${c.agents.lenses.filter((l) => l.on).length} lenses × ${c.agents.samples} · t ${c.agents.knob.temperature}`] },
  { id: "cluster", x: 580, y: 176, label: "Embed + cluster", kind: "embed", sub: (c) => [c.embed.model, `similarity ≥ ${c.cluster.threshold}`] },
  { id: "synth", x: 870, y: 98, label: "Cards", kind: "writer", sub: (c) => [c.synth.knob.model, `t ${c.synth.knob.temperature}`], optional: true },
  { id: "lone", x: 870, y: 254, label: "Lone gems", kind: "writer", sub: (c) => [c.lone.knob.model, `t ${c.lone.knob.temperature}`], optional: true },
  { id: "baseline", x: 290, y: 360, label: "One careful call", kind: "control", sub: (c) => [c.baseline.knob.model, `t ${c.baseline.knob.temperature}`], optional: true },
  { id: "result", x: 1160, y: 176, label: "Result", kind: "output", sub: () => ["cards + gems"] },
]
const W = 244
const H = 108
const PORT_Y = 54
const EDGES: Array<[NodeId, NodeId, boolean?]> = [
  ["passage", "keyphrases"], ["keyphrases", "topicInsight"], ["keyphrases", "agents", true], ["passage", "agents"], ["agents", "cluster"],
  ["cluster", "synth"], ["cluster", "lone"], ["synth", "result"], ["lone", "result"], ["passage", "baseline"], ["baseline", "result", true],
]
const HOME: Record<string, { x: number; y: number }> = Object.fromEntries(BOXES.map((b) => [b.id, { x: b.x, y: b.y }]))
const extraBox = (x: ExtraNode): Box => ({ id: x.id, x: 0, y: 0, label: x.label, kind: "reader", sub: () => [x.knob.model, `reads ${x.from} · t ${x.knob.temperature}`], optional: true })
const POS_KEY = "brain2:idea-swarm:layout:v1"
const loadPos = (): typeof HOME => { try { return { ...HOME, ...JSON.parse(window.localStorage.getItem(POS_KEY) ?? "{}") } } catch { return HOME } }
const boundsOf = (pos: typeof HOME) => {
  const xs = Object.values(pos), minX = Math.min(...xs.map((p) => p.x)), minY = Math.min(...xs.map((p) => p.y))
  return { minX, minY, w: Math.max(...xs.map((p) => p.x)) - minX + W, h: Math.max(...xs.map((p) => p.y)) - minY + H }
}

const ON_KEY: Partial<Record<NodeId, (c: Config) => boolean>> = {
  keyphrases: (c) => c.keyphrases.on, topicInsight: (c) => c.topicInsight.on, synth: (c) => c.synth.on, lone: (c) => c.lone.on, baseline: (c) => c.baseline.on,
}

type View = { x: number; y: number; k: number }
const clampK = (k: number) => Math.min(2.2, Math.max(0.3, k))

export function PipelineGraph({ config, stages, running, progress, selected, scores, onSelect, onToggle, onAdd }: {
  config: Config
  stages: Record<string, StageOut | undefined>
  running: string | null
  progress: { stage: StageId; done: number; total: number } | null
  selected: NodeId
  scores: Partial<Record<NodeId, Score | null>>
  onSelect: (id: NodeId) => void
  onToggle: (id: string, on: boolean) => void
  onAdd: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [panning, setPanning] = useState(false)
  const [moved0, setPos] = useState(HOME)
  const extras = useMemo(() => config.extra ?? [], [config.extra])
  const boxes = useMemo(() => [...BOXES, ...extras.map(extraBox)], [extras])
  const byId = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes])
  // Added nodes start in a row under the pipeline until the player drags them.
  const pos = useMemo(() => ({ ...Object.fromEntries(extras.map((x, k) => [x.id, { x: 290 + 290 * k, y: 540 }])), ...moved0 }), [extras, moved0])
  const posRef = useRef(pos)
  posRef.current = pos
  const nodeDrag = useRef<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null)
  const moved = useRef(false)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const fit = useCallback(() => {
    const el = host.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (!width || !height) return
    const pad = 36, B = boundsOf(posRef.current)
    const k = clampK(Math.min((width - pad * 2) / B.w, (height - pad * 2 - 40) / B.h, 1.35))
    setView({ k, x: (width - B.w * k) / 2 - B.minX * k, y: (height - 40 - B.h * k) / 2 + 8 - B.minY * k })
  }, [])

  useEffect(() => { const p = loadPos(); posRef.current = p; setPos(p); requestAnimationFrame(() => fit()) }, [fit])

  // Fit on mount and while the window changes, until the first time the user pans or zooms.
  useEffect(() => {
    const el = host.current
    if (!el) return
    let free = false
    const mark = () => { free = true }
    el.addEventListener("pointerdown", mark)
    el.addEventListener("wheel", mark, { passive: true })
    const ro = new ResizeObserver(() => { if (!free) fit() })
    ro.observe(el)
    fit()
    return () => { ro.disconnect(); el.removeEventListener("pointerdown", mark); el.removeEventListener("wheel", mark) }
  }, [fit])

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = host.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = cx ?? r.width / 2, py = cy ?? r.height / 2
    setView((v) => { const k = clampK(v.k * factor); const s = k / v.k; return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s } })
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener("wheel", wheel, { passive: false })
    return () => el.removeEventListener("wheel", wheel)
  }, [zoomAt])

  function down(e: React.PointerEvent) {
    const hit = (e.target as HTMLElement).closest?.(".is-node") as HTMLElement | null
    moved.current = false
    if (hit) {
      if ((e.target as HTMLElement).closest("button")) return
      const id = hit.dataset.node!
      nodeDrag.current = { id, x: e.clientX, y: e.clientY, ox: posRef.current[id]!.x, oy: posRef.current[id]!.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    moved.current = false
    setPanning(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const nd = nodeDrag.current
    if (nd) {
      if (Math.abs(e.clientX - nd.x) + Math.abs(e.clientY - nd.y) > 3) moved.current = true
      if (moved.current) setPos((p) => ({ ...p, [nd.id]: { x: Math.round(nd.ox + (e.clientX - nd.x) / view.k), y: Math.round(nd.oy + (e.clientY - nd.y) / view.k) } }))
      return
    }
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) moved.current = true
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }))
  }
  function up() {
    // The canvas holds the pointer capture, so a click never reaches the node; select here instead.
    if (nodeDrag.current && !moved.current) onSelect(nodeDrag.current.id)
    if (nodeDrag.current && moved.current) { try { window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)) } catch { /* layout lasts this visit */ } }
    nodeDrag.current = null; drag.current = null; setPanning(false)
  }
  function tidy() { setPos(HOME); posRef.current = HOME; try { window.localStorage.removeItem(POS_KEY) } catch { /* nothing saved */ } requestAnimationFrame(fit) }

  const onOf = (id: string) => ON_KEY[id]?.(config) ?? extras.find((x) => x.id === id)?.on ?? true
  const stateOf = (b: Box) => {
    const st = b.id !== "passage" && b.id !== "result" ? stages[b.id] : undefined
    const on = onOf(b.id)
    return { st, on, state: running === b.id ? "running" : st?.status ?? (on ? "idle" : "off") }
  }
  const live = (id: NodeId) => (id === "passage" ? true : id === "result" ? !!(stages.synth || stages.lone) : stages[id]?.status === "done")

  return (
    <div className={`is-canvas${panning ? " is-panning" : ""}`} ref={host} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg className="is-graph" role="img" aria-label="Pipeline diagram">
        <defs>
          <pattern id="is-dots" width={24 * view.k} height={24 * view.k} x={view.x} y={view.y} patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r={Math.max(0.8, 1.1 * view.k)} className="is-dot" /></pattern>
          <pattern id="is-dots-big" width={120 * view.k} height={120 * view.k} x={view.x} y={view.y} patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r={Math.max(1.2, 1.8 * view.k)} className="is-dot is-dot-big" /></pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#is-dots)" />
        <rect width="100%" height="100%" fill="url(#is-dots-big)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {[...EDGES, ...extras.map((x): [NodeId, NodeId] => [byId.has(x.from) ? x.from : "passage", x.id])].map(([a, b, dashed]) => {
            const A = byId.get(a)!
            const Ap = pos[a]!, Bp = pos[b]!
            const vertical = Bp.x <= Ap.x + 40 && Math.abs(Bp.x - Ap.x) < W
            const down = Bp.y > Ap.y
            const x1 = vertical ? Ap.x + W / 2 : Ap.x + W, y1 = vertical ? (down ? Ap.y + H : Ap.y) : Ap.y + PORT_Y
            const x2 = vertical ? Bp.x + W / 2 : Bp.x, y2 = vertical ? (down ? Bp.y : Bp.y + H) : Bp.y + PORT_Y
            const d = vertical
              ? `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`
              : `M${x1} ${y1} C${x1 + (x2 - x1) * 0.5} ${y1} ${x2 - (x2 - x1) * 0.5} ${y2} ${x2} ${y2}`
            const dim = !onOf(a) || !onOf(b)
            const flowing = running === b || (running !== null && running === a)
            const hot = selected === a || selected === b
            return (
              <g key={a + b} className={`is-wire k-${A.kind}${dashed ? " is-dashed" : ""}${dim ? " is-dim" : ""}${hot ? " is-hot" : ""}${live(a) ? " is-live" : ""}`}>
                <path d={d} className="is-wire-back" />
                <path d={d} className={`is-wire-line${flowing ? " is-flow" : ""}`} />
                <circle cx={x2} cy={y2} r="4" className="is-wire-end" />
              </g>
            )
          })}
          {boxes.map((b) => {
            const { st, on, state } = stateOf(b)
            const sc = scores[b.id]
            const result = b.id === "result" ? (stages.synth?.items.length ?? 0) + (stages.lone?.items.length ?? 0) : undefined
            const [a, c] = b.sub(config)
            const prog = running === b.id && progress && progress.stage === b.id ? progress : null
            const meta = st?.status === "error" ? "error" : st ? `${st.items.length} out · ${st.calls} call${st.calls === 1 ? "" : "s"} · ${(st.ms / 1000).toFixed(1)}s` : result !== undefined ? `${result} ideas` : state === "running" ? (prog ? `${prog.done} / ${prog.total}` : "running…") : state === "off" ? "bypassed" : "ready"
            return (
              <g key={b.id} transform={`translate(${pos[b.id]!.x} ${pos[b.id]!.y})`}>
                {b.id !== "passage" ? <circle cx="0" cy={PORT_Y} r="5.5" className={`is-port k-${b.kind}`} /> : null}
                {b.id !== "result" ? <circle cx={W} cy={PORT_Y} r="5.5" className={`is-port k-${b.kind}`} /> : null}
                <foreignObject width={W} height={H} className="is-fo">
                  <div
                    data-node={b.id}
                    className={`is-node k-${b.kind} is-${state}${selected === b.id ? " is-sel" : ""}`}
                                        role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(b.id)}
                    aria-label={b.label}
                  >
                    <header>
                      <i className="is-led" />
                      <b>{b.label}</b>
                      {sc ? <span className="is-nscore">F {sc.f.toFixed(2)}</span> : null}
                      {b.optional ? (
                        <button type="button" role="switch" aria-checked={on} aria-label={`${b.label} ${on ? "on" : "off"}`} className={`is-switch${on ? " is-on" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(b.id, !on) }}><i /></button>
                      ) : null}
                    </header>
                    <div className="is-node-body">
                      <span className="is-kind">{KIND_NAME[b.kind]}</span>
                      <code title={a}>{a}</code>
                      {c ? <small>{c}</small> : null}
                    </div>
                    <footer>
                      <span>{meta}</span>
                      {prog ? <em style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /> : null}
                    </footer>
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="is-legend" aria-hidden>
        {(["input", "free", "reader", "embed", "writer", "control", "output"] as Kind[]).map((k) => <span key={k} className={`k-${k}`}><i />{KIND_NAME[k]}</span>)}
      </div>
      <button type="button" className="is-addnode" onClick={onAdd} title="Add a node that reads the selected node">＋ Add node</button>
      <div className="is-zoom">
        <button type="button" onClick={() => zoomAt(1.2)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">−</button>
        <button type="button" onClick={fit} aria-label="Fit to window" title="Fit to window">⤢</button>
        <button type="button" onClick={tidy} aria-label="Reset node layout" title="Reset node layout">↺</button>
      </div>
    </div>
  )
}
