/**
 * components/Bim/graph/memory-graph.tsx — BIM console GRAPH tab
 *
 * Draws `lib/memory-graph/build.ts` on CRT glass: BIM's memory (hub → lanes → turns → the items they named)
 * or any item and everything around it. Nodes settle by a small force layout (no library), sit on rings by
 * their distance from the center, and can be dragged; drag the glass to pan, wheel to zoom. Click a node to
 * read it in the inspector: ASK BIM puts a question about it in the compose well (never sent on its own),
 * TELL BIM puts "Tell BIM about <it>: " there instead, so what you say next is read into proposed changes
 * (`lib/graph-bimby/`); on a date node it opens that day's Day Log correction. Shift-click picks several items,
 * and TELL BIM ABOUT THESE tells about them as a group. Waiting changes are drawn as dashed nodes with
 * ACCEPT / REJECT. OPEN opens the item, CENTER walks the graph to it (double-click does too), THOUGHT opens a turn's Thought.
 * Search centers on any item in Brain2. `openBimGraph(id)` (`lib/memory-graph/open.ts`) opens here from outside.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useBimChatStore, type BimLine } from "@/lib/ingest/bim-chat"
import { useShownLines } from "@/components/Bim/use-bim-chat"
import { bimGraph, itemGraph, searchItems, type GraphNode, type GraphNodeKind, type MemoryGraph } from "@/lib/memory-graph/build"
import { useBimGraphFocus } from "@/lib/memory-graph/open"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { itemTitle } from "@/lib/item-utils"
import { useReportStore } from "@/lib/report-bimby/store"
import { acceptEffect, rejectEffect } from "@/lib/report-bimby/decide"
import { withProposals } from "@/lib/graph-bimby/ghosts"
import { tellLead } from "@/lib/graph-bimby/parse"
import { useGraphTellTarget } from "@/lib/graph-bimby/target"
import "./memory-graph.css"

type Body = { x: number; y: number; vx: number; vy: number; ring: number; pinned?: boolean }

const RADIUS: Partial<Record<GraphNodeKind, number>> = { place: 8, proposal: 6, hub: 15, project: 10, person: 9, item: 8, lane: 8, list: 7, date: 7, turn: 6, step: 5, note: 6, resource: 6, evidence: 4 }

const KIND_SAYS: Record<GraphNodeKind, string> = {
  hub: "BIM core",
  item: "item",
  project: "project",
  person: "person",
  step: "step",
  list: "list",
  note: "note",
  date: "date",
  resource: "file",
  lane: "lane",
  turn: "chat turn",
  evidence: "evidence row",
  place: "place",
  proposal: "proposed change",
}

/** Distance from the center along edges: the ring a node sits on. */
function rings(graph: MemoryGraph): Map<string, number> {
  const out = new Map<string, number>([[graph.centerId, 0]])
  const next = new Map<string, string[]>()
  for (const e of graph.edges) {
    next.set(e.a, [...(next.get(e.a) ?? []), e.b])
    next.set(e.b, [...(next.get(e.b) ?? []), e.a])
  }
  const queue = [graph.centerId]
  while (queue.length) {
    const id = queue.shift()!
    for (const n of next.get(id) ?? []) {
      if (out.has(n)) continue
      out.set(n, out.get(id)! + 1)
      queue.push(n)
    }
  }
  for (const n of graph.nodes) if (!out.has(n.id)) out.set(n.id, 3)
  return out
}

/** Places nodes on their rings, then lets springs, repulsion and the ring pull settle them. */
function useLayout(graph: MemoryGraph, size: { w: number; h: number }) {
  const bodies = useRef(new Map<string, Body>())
  const alpha = useRef(1)
  const raf = useRef(0)
  const [, paint] = useState(0)
  const ringOf = useMemo(() => rings(graph), [graph])
  const maxRing = Math.max(1, ...ringOf.values())
  const step = Math.max(70, (Math.min(size.w, size.h) / 2 - 40) / maxRing)

  // Seed new nodes on their ring (spread by order), keep the ones still here where they are.
  useEffect(() => {
    const keep = new Map<string, Body>()
    const perRing = new Map<number, string[]>()
    for (const n of graph.nodes) perRing.set(ringOf.get(n.id) ?? 3, [...(perRing.get(ringOf.get(n.id) ?? 3) ?? []), n.id])
    for (const [ring, ids] of perRing)
      ids.forEach((id, i) => {
        const old = bodies.current.get(id)
        const angle = (i / ids.length) * Math.PI * 2 + ring * 0.7
        keep.set(id, old && id !== graph.centerId ? { ...old, ring } : { x: Math.cos(angle) * ring * step, y: Math.sin(angle) * ring * step, vx: 0, vy: 0, ring, pinned: id === graph.centerId })
      })
    const center = keep.get(graph.centerId)
    if (center) Object.assign(center, { x: 0, y: 0, pinned: true })
    bodies.current = keep
    alpha.current = 1
    kick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, step])

  const tick = useCallback(() => {
    const list = [...bodies.current.entries()]
    const a = alpha.current
    for (let i = 0; i < list.length; i++) {
      const [, p] = list[i]
      for (let j = i + 1; j < list.length; j++) {
        const [, q] = list[j]
        let dx = q.x - p.x
        let dy = q.y - p.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          dx = Math.random() - 0.5
          dy = Math.random() - 0.5
          d2 = 1
        }
        const f = (1600 / d2) * a
        const d = Math.sqrt(d2)
        p.vx -= (dx / d) * f
        p.vy -= (dy / d) * f
        q.vx += (dx / d) * f
        q.vy += (dy / d) * f
      }
    }
    for (const e of graph.edges) {
      const p = bodies.current.get(e.a)
      const q = bodies.current.get(e.b)
      if (!p || !q) continue
      const dx = q.x - p.x
      const dy = q.y - p.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const f = (d - step * 0.9) * 0.02 * a
      p.vx += (dx / d) * f
      p.vy += (dy / d) * f
      q.vx -= (dx / d) * f
      q.vy -= (dy / d) * f
    }
    for (const [, p] of list) {
      if (p.pinned) {
        p.vx = p.vy = 0
        continue
      }
      // The ring pull: each node drifts to its own distance from the center.
      const d = Math.max(1, Math.hypot(p.x, p.y))
      const want = p.ring * step
      p.vx += (p.x / d) * (want - d) * 0.06 * a
      p.vy += (p.y / d) * (want - d) * 0.06 * a
      p.vx *= 0.6
      p.vy *= 0.6
      p.x += p.vx
      p.y += p.vy
    }
    alpha.current *= 0.965
    paint((n) => n + 1)
    raf.current = alpha.current > 0.02 ? requestAnimationFrame(tick) : 0
  }, [graph, step])

  const kick = useCallback(
    (to = 1) => {
      alpha.current = Math.max(alpha.current, to)
      if (!raf.current) raf.current = requestAnimationFrame(tick)
    },
    [tick],
  )
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }, [tick])

  return { bodies: bodies.current, kick, step, maxRing }
}

export function MemoryGraphPane({ onAsk, onThought }: { onAsk: (text: string) => void; onThought: (line: BimLine) => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const lines = useShownLines(useBimChatStore((s) => s.lines))
  const centerId = useBimGraphFocus((s) => s.centerId)
  const setCenter = useBimGraphFocus((s) => s.setCenter)
  const [trail, setTrail] = useState<(string | null)[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const plans = useReportStore((s) => s.plans)
  const order = useReportStore((s) => s.order)
  const setTargets = useGraphTellTarget((s) => s.set)

  const base = useMemo(() => (centerId ? itemGraph(centerId, tasks, lists, new Date(), lines) : bimGraph(lines, tasks)), [centerId, tasks, lists, lines])
  // Changes BIM proposed about the center and you have not decided yet: dashed nodes on the graph.
  const graph = useMemo(() => (centerId ? withProposals(base, order.map((id) => plans[id]).filter(Boolean)) : base), [base, centerId, plans, order])
  const proposedCount = graph.nodes.filter((n) => n.kind === "proposal").length
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph])
  const found = useMemo(() => searchItems(query, tasks), [query, tasks])

  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 420 })
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { bodies, kick, step, maxRing } = useLayout(graph, size)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  useEffect(() => setView({ x: 0, y: 0, k: 1 }), [graph.centerId])
  useEffect(() => setSelected(graph.centerId), [graph.centerId])

  const go = (id: string | null) => {
    if (id === centerId) return
    setTrail((t) => [...t.slice(-20), centerId])
    setCenter(id)
    setQuery("")
  }
  const back = () => {
    if (!trail.length) return
    setCenter(trail[trail.length - 1])
    setTrail((t) => t.slice(0, -1))
  }

  // Pointer: a node drags (and selects on a still click); the glass pans.
  const drag = useRef<{ id: string | null; x: number; y: number; moved: boolean; vx: number; vy: number; shift: boolean } | null>(null)
  const toGraph = (e: ReactPointerEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - r.width / 2 - view.x) / view.k, y: (e.clientY - r.top - r.height / 2 - view.y) / view.k }
  }
  const onDown = (e: ReactPointerEvent, id: string | null) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false, vx: view.x, vy: view.y, shift: e.shiftKey || e.metaKey }
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
    if (!d.moved) return
    if (d.id) {
      const b = bodies.get(d.id)
      if (!b) return
      const p = toGraph(e)
      Object.assign(b, { x: p.x, y: p.y, vx: 0, vy: 0, pinned: true })
      kick(0.3)
    } else setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }))
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    // Shift-click (or Cmd-click) picks an item for a group; a plain click selects.
    const itemId = d.id ? byId.get(d.id)?.itemId : undefined
    if (d.id && !d.moved && d.shift && itemId) setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]))
    else if (d.id && !d.moved) setSelected(d.id)
    if (!d.id && !d.moved) setSelected(null)
    // A dragged node stays where it was put; the center stays pinned anyway.
  }
  const onWheel = (e: React.WheelEvent) => {
    const k = Math.min(2.5, Math.max(0.4, view.k * (e.deltaY > 0 ? 0.9 : 1.1)))
    setView((v) => ({ ...v, k }))
  }

  const sel = selected ? byId.get(selected) : undefined
  const selEdges = new Set(graph.edges.filter((e) => e.a === selected || e.b === selected).map((e) => `${e.a}>${e.b}`))
  const linkCount = (id: string) => graph.edges.filter((e) => e.a === id || e.b === id).length
  const dense = graph.nodes.length > 34
  const center = byId.get(graph.centerId)
  const thoughtLine = sel?.traceId ? lines.find((l) => l.traceId === sel.traceId) : undefined
  const selEffect = sel?.proposal ? plans[sel.proposal.planId]?.effects.find((e) => e.id === sel.proposal!.effectId) : undefined
  const pickedItems = picked.map((id) => tasks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t)

  /** "Tell BIM about …: " in the compose well, with the exact ids kept so a shared name is never mixed up. */
  const tell = (items: { id: string; name: string }[]) => {
    if (!items.length) return
    setTargets(items)
    onAsk(tellLead(items.map((i) => i.name)))
  }

  return (
    <div className="bim-crt-pane bim-graph-pane">
      <div className="bim-glass bim-graph">
        <div className="bim-graph-bar">
          <span className="bim-graph-title">
            GRAPH // {centerId ? (center?.label ?? "item").toUpperCase() : "BIM MEMORY"}
          </span>
          <span className="bim-graph-count">
            {graph.nodes.length - proposedCount} nodes · {graph.edges.length - proposedCount} links
            {proposedCount ? <em className="bim-graph-proposed"> · {proposedCount} proposed</em> : null}
          </span>
          <span className="bim-graph-gap" />
          <button data-no95 type="button" className="bim-graph-key" disabled={!trail.length} onClick={back} title="Back to the last center">
            ← back
          </button>
          <button data-no95 type="button" className={`bim-graph-key${centerId ? "" : " is-on"}`} onClick={() => go(null)} title="BIM's memory: lanes, turns and what they named">
            bim memory
          </button>
          <div className="bim-graph-find">
            <input type="search" aria-label="Find any item to graph" placeholder="Graph any item…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {found.length ? (
              <ul role="listbox" aria-label="Items">
                {found.map((t) => (
                  <li key={t.id}>
                    <button data-no95 type="button" role="option" aria-selected={false} onClick={() => go(t.id)}>
                      {itemTitle(t) || "Untitled"}
                      <small>{t.personProfile ? "person" : t.subtasks?.length ? "project" : t.completed ? "done" : ""}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div ref={wrap} className="bim-graph-well" onPointerDown={(e) => onDown(e, null)} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel}>
          {graph.nodes.length <= 1 && centerId ? <p className="bim-graph-empty">Nothing is linked to this yet. Ask BIM about it, or open it and add links.</p> : null}
          {!centerId && graph.nodes.length <= 1 ? <p className="bim-graph-empty">BIM&apos;s memory fills in as you chat. Say something, or search an item above to graph it.</p> : null}
          <svg className="bim-graph-svg" width={size.w} height={size.h} viewBox={`${-size.w / 2} ${-size.h / 2} ${size.w} ${size.h}`} role="img" aria-label={`Graph of ${center?.label ?? "BIM"}`}>
            <defs>
              <radialGradient id="bim-graph-core">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {Array.from({ length: maxRing }, (_, i) => (
                <circle key={i} className="bim-graph-ring" r={(i + 1) * step} />
              ))}
              {graph.edges.map((e) => {
                const p = bodies.get(e.a)
                const q = bodies.get(e.b)
                if (!p || !q) return null
                const hot = selEdges.has(`${e.a}>${e.b}`)
                return (
                  <g key={`${e.a}>${e.b}`} className={`bim-graph-edge${hot ? " is-hot" : ""}${e.proposed ? " is-proposed" : ""}`}>
                    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                    {hot && e.label ? (
                      <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 4} textAnchor="middle">
                        {e.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {graph.nodes.map((n) => {
                const b = bodies.get(n.id)
                if (!b) return null
                const r = n.id === graph.centerId ? 15 : (RADIUS[n.kind] ?? 6)
                const quiet = dense && (n.kind === "evidence" || n.kind === "turn" || n.kind === "step") && n.id !== selected
                return (
                  <g
                    key={n.id}
                    className={`bim-graph-node is-${n.kind}${n.id === selected ? " is-sel" : ""}${n.itemId && picked.includes(n.itemId) ? " is-picked" : ""}${n.id === graph.centerId ? " is-center" : ""}${n.dim ? " is-dim" : ""}`}
                    transform={`translate(${b.x} ${b.y})`}
                    onPointerDown={(e) => onDown(e, n.id)}
                    onDoubleClick={() => n.itemId && go(n.itemId)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${KIND_SAYS[n.kind]}: ${n.label}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelected(n.id)
                      }
                    }}
                  >
                    {n.id === graph.centerId ? <circle className="bim-graph-halo" r={r * 2.6} fill="url(#bim-graph-core)" /> : null}
                    {n.kind === "lane" ? <rect className="bim-graph-dot" x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" /> : <circle className="bim-graph-dot" r={r} />}
                    <circle className="bim-graph-pip" r={Math.max(1.6, r * 0.32)} />
                    {quiet ? null : (
                      <text className="bim-graph-label" y={r + 12} textAnchor="middle">
                        {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {sel ? (
            <aside className="bim-graph-inspect" onPointerDown={(e) => e.stopPropagation()}>
              <p className="bim-graph-inspect-head">
                <span>NODE · {KIND_SAYS[sel.kind]}</span>
                <span>{linkCount(sel.id)} links</span>
              </p>
              <p className="bim-graph-inspect-title" title={sel.label}>{sel.label}</p>
              {sel.facts.length ? (
                <ul className="bim-graph-facts">
                  {sel.facts.slice(0, 7).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : null}
              <div className="bim-graph-acts">
                {selEffect && (selEffect.status === "pending" || selEffect.status === "failed") ? (
                  <>
                    <button data-no95 type="button" className="bim-graph-ask" onClick={() => void acceptEffect(sel.proposal!.planId, selEffect.id)}>
                      Accept ✓
                    </button>
                    <button data-no95 type="button" onClick={() => rejectEffect(sel.proposal!.planId, selEffect.id)}>
                      reject
                    </button>
                  </>
                ) : null}
                {sel.ask ? (
                  <button data-no95 type="button" className="bim-graph-ask" onClick={() => onAsk(sel.ask!)}>
                    Ask BIM about this ↵
                  </button>
                ) : null}
                {sel.itemId ? (
                  <button data-no95 type="button" className="bim-graph-ask bim-graph-tell" onClick={() => tell([{ id: sel.itemId!, name: sel.label }])} title="What you say next is read into changes to this item, proposed for you to accept">
                    Tell BIM about this ↵
                  </button>
                ) : null}
                {sel.day ? (
                  <button data-no95 type="button" className="bim-graph-ask bim-graph-tell" onClick={() => onAsk(`day log for ${sel.day}: `)} title="What you say next is kept, word for word, in that day's Day Log">
                    Tell BIM about this day ↵
                  </button>
                ) : null}
                {sel.itemId ? (
                  <button data-no95 type="button" onClick={() => openItemDetailPopup(sel.itemId!)}>
                    open
                  </button>
                ) : null}
                {sel.itemId && sel.itemId !== centerId ? (
                  <button data-no95 type="button" onClick={() => go(sel.itemId!)}>
                    center
                  </button>
                ) : null}
                {thoughtLine ? (
                  <button data-no95 type="button" onClick={() => onThought(thoughtLine)}>
                    thought ⇱
                  </button>
                ) : null}
              </div>
            </aside>
          ) : null}
          {pickedItems.length ? (
            <div className="bim-graph-group bim-graph-acts" onPointerDown={(e) => e.stopPropagation()}>
              <span>
                GROUP · {pickedItems.length} picked: {pickedItems.map((t) => itemTitle(t) || "Untitled").join(" + ")}
              </span>
              <button data-no95 type="button" className="bim-graph-ask bim-graph-tell" onClick={() => tell(pickedItems.map((t) => ({ id: t.id, name: itemTitle(t) || "Untitled" })))}>
                Tell BIM about {pickedItems.length > 1 ? "these" : "this"} ↵
              </button>
              <button data-no95 type="button" onClick={() => setPicked([])}>
                clear
              </button>
            </div>
          ) : null}
          <p className="bim-graph-hint">drag nodes · drag glass to pan · wheel zooms · double-click walks · shift-click picks a group</p>
        </div>
      </div>
    </div>
  )
}

export type { GraphNode }
