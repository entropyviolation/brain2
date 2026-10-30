/**
 * components/Lab/BimFlow/BimFlowLab.tsx — Build and test BIM's routed model flow
 *
 * Left: the node board. Right: the node inspector. Bottom: a run over real
 * BIM messages (a day from the Telegram feed, or pasted lines), what each
 * message would write, and the time blocks code built from them. Nothing here
 * writes the vault. The graph is saved per device (`bimflow-graph-v1`).
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { defaultFlow } from "@/lib/bim-flow/default-flow"
import { DEFAULT_MODEL, listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { runFlow } from "@/lib/bim-flow/run-flow"
import { loadHubVault, snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import type { Flow, FlowMessage, FlowNode, FlowRun, MessageRun } from "@/lib/bim-flow/types"
import type { VaultSnapshot } from "@/lib/bim-flow/vault-search"
import type { TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { FlowCanvas, NODE_H } from "./flow-canvas"
import { FlowInspector } from "./flow-inspector"
import "./bim-flow.css"

const GRAPH_KEY = "bimflow-graph-v1"
const MODEL_KEY = "bimflow-model"

function loadFlow(): Flow {
  try {
    const raw = localStorage.getItem(GRAPH_KEY)
    if (raw) {
      const flow = JSON.parse(raw) as Flow
      if (flow.version === 1 && Array.isArray(flow.nodes)) return flow
    }
  } catch {}
  return defaultFlow()
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

const dayKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })

/** Feed rows worth reading: no bare links, no scan placeholders, no single digits. */
function readable(text: string): boolean {
  const t = text.trim()
  return !!t && !/^https?:\/\//i.test(t) && !/^\(\d+ scans?\)$/.test(t) && !/^\d{1,2}$/.test(t)
}

function withPrior(rows: { id: string; text: string; at: string }[]): FlowMessage[] {
  return rows.map((r, i) => ({
    ...r,
    prior: rows
      .slice(Math.max(0, i - 2), i)
      .filter((p) => new Date(r.at).getTime() - new Date(p.at).getTime() < 3 * 3600_000)
      .map((p) => ({ text: p.text, at: p.at })),
  }))
}

/** "14:05 starting dishes" lines, on `day`. A line with no clock takes the last one plus a minute. */
function parsePasted(text: string, day: string): FlowMessage[] {
  let last = new Date(`${day}T09:00:00`)
  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = /^(\d{1,2}):(\d{2})\s+(.*)$/.exec(line)
      const at = m ? new Date(`${day}T${m[1]!.padStart(2, "0")}:${m[2]}:00`) : new Date(last.getTime() + 60_000)
      last = at
      return { id: `paste-${i}`, text: m ? m[3]! : line, at: at.toISOString() }
    })
  return withPrior(rows)
}

export function BimFlowLab() {
  const [flow, setFlow] = useState<Flow>(() => defaultFlow())
  const [loaded, setLoaded] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [source, setSource] = useState<"feed" | "paste">("feed")
  const [day, setDay] = useState("")
  const [pasted, setPasted] = useState("13:30 making garlic confit now\n14:00 garlic done\n14:05 starting walk\n14:40 back, called elijah\n14:42 need more macbook bricks")
  const [run, setRun] = useState<FlowRun | null>(null)
  const [live, setLive] = useState<MessageRun[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")
  const [openMsg, setOpenMsg] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  const storeRows = useTelegramFeedStore((s) => s.rows)
  // A plain browser tab never pulls the hub into its stores; read it here instead.
  const [hub, setHub] = useState<{ snap: VaultSnapshot; feed: TelegramFeedRow[] } | null>(null)
  const feedRows = storeRows.length > 0 ? storeRows : hub?.feed ?? []

  useEffect(() => {
    const had = document.body.classList.contains("win95-app")
    document.body.classList.remove("win95-app")
    setFlow(loadFlow())
    try {
      const m = localStorage.getItem(MODEL_KEY)
      if (m) setModel(m)
    } catch {}
    setLoaded(true)
    void listOllamaModels().then(setModels)
    void loadHubVault().then(setHub)
    return () => void (had && document.body.classList.add("win95-app"))
  }, [])

  useEffect(() => {
    if (loaded) save(GRAPH_KEY, JSON.stringify(flow))
  }, [flow, loaded])

  const feedByDay = useMemo(() => {
    const map = new Map<string, { id: string; text: string; at: string }[]>()
    for (const r of [...feedRows].sort((a, b) => a.at.localeCompare(b.at))) {
      if (!readable(r.text)) continue
      const k = dayKey(r.at)
      map.set(k, [...(map.get(k) ?? []), { id: r.id, text: r.text, at: r.at }])
    }
    return map
  }, [feedRows])
  const days = useMemo(() => [...feedByDay.keys()].sort().reverse(), [feedByDay])
  const activeDay = day || days[0] || dayKey(new Date().toISOString())

  const messages = useMemo<FlowMessage[]>(
    () => (source === "feed" ? withPrior(feedByDay.get(activeDay) ?? []) : parsePasted(pasted, activeDay)),
    [source, feedByDay, activeDay, pasted],
  )

  const runs = run?.messages ?? live
  const openRun = openMsg != null ? runs[openMsg] ?? null : null
  const selectedNode = flow.nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedStep = openRun?.steps.find((s) => s.nodeId === selectedNodeId) ?? null

  const updateNode = (node: FlowNode) => setFlow((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === node.id ? node : n)) }))

  const addNode = (kind: FlowNode["kind"]) => {
    const id = `${kind}-${Date.now().toString(36)}`
    const maxY = Math.max(...flow.nodes.map((n) => n.y), 0)
    const node: FlowNode = { id, kind, label: `New ${kind}`, x: 260, y: maxY + NODE_H + 60, config: kind === "gate" ? { question: "" } : {} }
    setFlow((f) => ({ ...f, nodes: [...f.nodes, node] }))
    setSelectedNodeId(id)
  }

  const start = async () => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setRunning(true)
    setRun(null)
    setLive([])
    setOpenMsg(null)
    save(MODEL_KEY, model)
    try {
      const result = await runFlow(flow, messages, ollamaCall(model, ctl.signal), storeRows.length === 0 && hub ? hub.snap : snapshotFromStores(), {
        model,
        onStep: (i, s) => setProgress(`${i + 1}/${messages.length} · ${flow.nodes.find((n) => n.id === s.nodeId)?.label ?? s.nodeId}`),
        onMessage: (r) => setLive((l) => [...l, r]),
      })
      setRun(result)
      setProgress(`${messages.length} messages in ${(result.ms / 1000).toFixed(1)}s`)
    } catch (err) {
      setProgress(ctl.signal.aborted ? "Stopped" : `Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bf-lab">
      <header className="bf-top">
        <b className="bf-title">BIM · FLOW</b>
        <span className="bf-k">{storeRows.length > 0 ? "vault: this window" : hub ? "vault: hub copy" : "vault: loading"}</span>
        <span className={`bf-lamp ${models ? "is-on" : "is-off"}`} title={models ? "Ollama answering" : "Ollama not answering on 127.0.0.1:11434"} />
        <select className="bf-input" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
          {[...new Set([model, ...(models ?? [])])].map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="bf-sep" />
        {(["gate", "search", "choose", "extract", "propose", "blocks"] as const).map((k) => (
          <button key={k} type="button" data-no95 onClick={() => addNode(k)}>+ {k}</button>
        ))}
        <span className="bf-sep" />
        {selectedEdgeId ? (
          <button type="button" data-no95 onClick={() => { setFlow((f) => ({ ...f, edges: f.edges.filter((e) => e.id !== selectedEdgeId) })); setSelectedEdgeId(null) }}>
            Cut wire
          </button>
        ) : null}
        <button type="button" data-no95 onClick={() => { if (confirm("Replace this graph with the starter graph?")) setFlow(defaultFlow()) }}>
          Starter graph
        </button>
      </header>

      <div className="bf-main">
        <FlowCanvas
          flow={flow}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          trace={openRun?.steps ?? null}
          onSelectNode={(id) => { setSelectedNodeId(id); if (id) setSelectedEdgeId(null) }}
          onSelectEdge={(id) => { setSelectedEdgeId(id); if (id) setSelectedNodeId(null) }}
          onMove={(id, x, y) => setFlow((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }))}
          onConnect={(from, to, port) =>
            setFlow((f) => {
              const id = `${from}>${to}:${port}`
              return f.edges.some((e) => e.id === id) ? f : { ...f, edges: [...f.edges, { id, from, to, port }] }
            })
          }
        />
        <FlowInspector
          flow={flow}
          node={selectedNode}
          step={selectedStep}
          messageText={openRun?.message.text ?? null}
          onChange={updateNode}
          onDelete={(id) => {
            setFlow((f) => ({ ...f, nodes: f.nodes.filter((n) => n.id !== id), edges: f.edges.filter((e) => e.from !== id && e.to !== id) }))
            setSelectedNodeId(null)
          }}
        />
      </div>

      <section className="bf-run">
        <div className="bf-run-in">
          <div className="bf-row">
            <button type="button" data-no95 className={source === "feed" ? "is-on" : ""} onClick={() => setSource("feed")}>BIM day</button>
            <button type="button" data-no95 className={source === "paste" ? "is-on" : ""} onClick={() => setSource("paste")}>Paste</button>
            <select className="bf-input" value={activeDay} onChange={(e) => setDay(e.target.value)} aria-label="Day">
              {(days.length ? days : [activeDay]).map((d) => (
                <option key={d} value={d}>{d} · {feedByDay.get(d)?.length ?? 0}</option>
              ))}
            </select>
            {running ? (
              <button type="button" data-no95 onClick={() => abort.current?.abort()}>Stop</button>
            ) : (
              <button type="button" data-no95 className="is-go" disabled={!messages.length || !models} onClick={() => void start()}>
                Run {messages.length}
              </button>
            )}
          </div>
          <span className="bf-progress">{progress}</span>
          {source === "paste" ? (
            <textarea className="bf-input bf-paste" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="14:05 starting walk" />
          ) : (
            <ol className="bf-msgs">
              {messages.map((m, i) => (
                <li key={m.id} className={openMsg === i ? "is-open" : ""}>
                  <button type="button" data-no95 onClick={() => setOpenMsg(openMsg === i ? null : i)} disabled={!runs[i]}>
                    <span className="bf-clock">{clock(m.at)}</span> {m.text}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="bf-run-out">
          <span className="bf-k">Would write</span>
          <ol className="bf-msgs">
            {runs.map((r, i) => (
              <li key={r.message.id} className={openMsg === i ? "is-open" : ""}>
                <button type="button" data-no95 onClick={() => setOpenMsg(openMsg === i ? null : i)}>
                  <span className="bf-clock">{clock(r.message.at)}</span> {r.message.text.slice(0, 80)}
                </button>
                <span className="bf-chips">
                  {r.proposals.length === 0 && r.signals.length === 0 ? <i>nothing</i> : null}
                  {r.signals.map((s, j) => <span key={`s${j}`} className="bf-chip is-span">{s.activity} · {s.relation}{s.since ? ` since ${s.since}` : ""}{s.minutesLeft ? ` +${s.minutesLeft}m` : ""}</span>)}
                  {r.proposals.map((p, j) => <span key={j} className={`bf-chip is-${p.action}`}>{p.summary}</span>)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bf-run-blocks">
          <span className="bf-k">Time blocks (built by code)</span>
          <ol className="bf-msgs">
            {(run?.blocks ?? []).map((b, i) => (
              <li key={i}>
                <span className="bf-clock">{clock(b.start)}–{clock(b.end)}</span> {b.activity}
                {b.estimated ? <span className="bf-est"> est.</span> : null}
                <div className="bf-why">{b.why}</div>
              </li>
            ))}
            {run && run.blocks.length === 0 ? <li><i>none</i></li> : null}
          </ol>
        </div>
      </section>
    </div>
  )
}
