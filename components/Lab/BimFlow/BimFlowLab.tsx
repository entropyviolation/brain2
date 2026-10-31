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
import { buildAnalysisFlow, loadAnalyses, loadInsightLog, loadRunLog, logDataset, runAnalysis, saveAnalyses, saveInsightLog, saveRunLog, type AnalysisDef, type LogInsight, type RunRecord } from "@/lib/bim-flow/analyses"
import { driveBoard, driveDataset, driveSources, loadDrive, loadSeen, readDrive, readingFromProposal, clearDrive, saveDrive, saveSeen, type DriveReading } from "@/lib/bim-flow/drive"
import { entryDef } from "@/lib/bim-flow/entries"
import { FLOWS, FLOW_REV, flowDef, type FlowId } from "@/lib/bim-flow/flows"
import { augment, AUGMENT_LABEL, DEFAULT_INPUT, GROUPING_LABEL, group, parsePasted, questionMessage, type Augment, type Grouping, type InputSpec } from "@/lib/bim-flow/inputs"
import { DEFAULT_MODEL, embedScores, listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { CORE_TEST_IDS, loadResults, runTest, saveResults, TESTS, type TestResult } from "@/lib/bim-flow/tests"
import { runFlow } from "@/lib/bim-flow/run-flow"
import { loadTexts, TEXT_WINDOW_DAYS } from "@/lib/bim-flow/texts-client"
import { loadFileEvents } from "@/lib/bim-flow/file-activity-client"
import type { FileEvent } from "@/lib/bim-flow/file-activity"
import { localDay, textsToFeed, TEXT_SCOPE_HINT, TEXT_SCOPE_LABEL, type TextRow, type TextScope } from "@/lib/bim-flow/texts"
import { loadHubVault, snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import type { Flow, FlowMessage, FlowNode, FlowRun, MessageRun, ModelPlan } from "@/lib/bim-flow/types"
import type { VaultSnapshot } from "@/lib/bim-flow/vault-search"
import type { TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { FlowCanvas, NODE_H } from "./flow-canvas"
import { FlowInspector } from "./flow-inspector"
import { FlowPreview } from "./flow-preview"
import { AnalysesSheet } from "./analyses-sheet"
import { DriveSheet } from "./drive-sheet"
import { FlowTests, type LiveTest } from "./flow-tests"
import { FlowRuns } from "./flow-runs"
import { archive } from "@/lib/bim-flow/archive"
import { loadHistory, saveHistory, slimRun, type SavedRun } from "@/lib/bim-flow/run-history"
import "./bim-flow.css"

const OLD_GRAPH_KEY = "bimflow-graph-v1"
const graphKey = (id: string) => `bimflow-graph-v2:${id}`
const revKey = (id: string) => `bimflow-graph-rev:${id}`
const MODEL_KEY = "bimflow-model"
const PLAN_KEY = "bimflow-model-plan"
const INPUT_KEY = "bimflow-input-v1"

/** The saved graph for one flow. The first flow's old key is read once, with any lane added since filled in. */
function loadFlow(id: FlowId): Flow {
  const fresh = flowDef(id).build()
  try {
    // The shipped graph changed shape: use it, and keep the saved copy under a backup key. Nothing is deleted.
    const rev = FLOW_REV[id]
    const seenRev = localStorage.getItem(revKey(id))
    if (rev && seenRev !== rev) {
      const old = localStorage.getItem(graphKey(id))
      if (old) localStorage.setItem(`${graphKey(id)}:backup:${seenRev ?? "unversioned"}`, old)
      localStorage.setItem(revKey(id), rev)
      return fresh
    }
    const raw = localStorage.getItem(graphKey(id)) ?? (id === "log" ? localStorage.getItem(OLD_GRAPH_KEY) : null)
    if (raw) {
      const flow = JSON.parse(raw) as Flow
      if (flow.version === 1 && Array.isArray(flow.nodes)) {
        if (localStorage.getItem(graphKey(id))) return flow
        const have = new Set(flow.nodes.map((n) => n.id))
        const edges = new Set(flow.edges.map((e) => e.id))
        return {
          ...flow,
          nodes: [...flow.nodes, ...fresh.nodes.filter((n) => !have.has(n.id))],
          edges: [...flow.edges, ...fresh.edges.filter((e) => !edges.has(e.id))],
        }
      }
    }
  } catch {}
  return fresh
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

/** One Run press. Jobs share nothing but the flow graph they were started from. */
interface Job {
  id: string
  flowId: string
  label: string
  running: boolean
  run: FlowRun | null
  live: MessageRun[]
  progress: string
  notes: string[]
}

export function BimFlowLab() {
  const [flowId, setFlowId] = useState<string>("log")
  const [flows, setFlows] = useState<Record<string, Flow>>(() => Object.fromEntries(FLOWS.map((f) => [f.id, f.build()])))
  const [analyses, setAnalyses] = useState<AnalysisDef[]>([])
  const [insightLog, setInsightLog] = useState<LogInsight[]>([])
  const [runLog, setRunLog] = useState<RunRecord[]>([])
  const [analysesOpen, setAnalysesOpen] = useState(false)
  const [drive, setDrive] = useState<DriveReading[]>([])
  const [driveOpen, setDriveOpen] = useState(false)
  const [driveRunning, setDriveRunning] = useState(false)
  const [driveProgress, setDriveProgress] = useState("")
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [anRunning, setAnRunning] = useState(false)
  const [anProgress, setAnProgress] = useState("")
  const [entry, setEntry] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [model, setModel] = useState(DEFAULT_MODEL)
  // Different models for yes/no gates and for the steps that write prose; blank = the main model.
  const [plan, setPlan] = useState<ModelPlan>({})
  const [runLabel, setRunLabel] = useState("")
  const [source, setSource] = useState<"feed" | "paste" | "ask" | "texts">("feed")
  const [spec, setSpec] = useState<InputSpec>(DEFAULT_INPUT)
  const [question, setQuestion] = useState("when was the last time i showered?")
  const [day, setDay] = useState("")
  // Recent phone texts (the hub keeps only a short window readable here; old ones are not relevant).
  const [textRows, setTextRows] = useState<TextRow[]>([])
  const [fileEvents, setFileEvents] = useState<FileEvent[]>([])
  const [textScope, setTextScope] = useState<TextScope>("mine")
  const [textsState, setTextsState] = useState<"loading" | "ok" | "none">("loading")
  const [pasted, setPasted] = useState("13:30 making garlic confit now\n14:00 garlic done\n14:05 starting walk\n14:40 back, called elijah\n14:42 need more macbook bricks")
  // Each Run press is its own job with its own abort, so runs go in parallel.
  const [jobs, setJobs] = useState<Job[]>([])
  const [viewId, setViewId] = useState<string | null>(null)
  const ctls = useRef<Map<string, AbortController>>(new Map())
  const [openMsg, setOpenMsg] = useState<number | null>(null)
  const [preview, setPreview] = useState(false)
  const [tests, setTests] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [testRunning, setTestRunning] = useState(false)
  const [testProgress, setTestProgress] = useState("")
  const [history, setHistory] = useState<SavedRun[]>([])
  const [runsOpen, setRunsOpen] = useState(false)
  const [viewRun, setViewRun] = useState<SavedRun | null>(null)
  const [liveTest, setLiveTest] = useState<LiveTest | null>(null)
  const driveAbort = useRef<AbortController | null>(null)
  const testAbort = useRef<AbortController | null>(null)
  const analysisAbort = useRef<AbortController | null>(null)
  const job = jobs.find((j) => j.id === viewId) ?? null
  const run = job?.run ?? null
  const live = job?.live ?? []
  const running = job?.running ?? false
  const progress = job?.progress ?? ""
  const notes = job?.notes ?? []
  const patchJob = (id: string, p: Partial<Job> | ((j: Job) => Partial<Job>)) =>
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...(typeof p === "function" ? p(j) : p) } : j)))

  const flow = flows[flowId] ?? defaultFlow()
  const setFlow = (u: Flow | ((f: Flow) => Flow)) => setFlows((all) => ({ ...all, [flowId]: typeof u === "function" ? u(all[flowId] ?? defaultFlow()) : u }))

  const storeRows = useTelegramFeedStore((s) => s.rows)
  // A plain browser tab never pulls the hub into its stores; read it here instead.
  const [hub, setHub] = useState<{ snap: VaultSnapshot; feed: TelegramFeedRow[] } | null>(null)
  const feedRows = storeRows.length > 0 ? storeRows : hub?.feed ?? []
  const vault = (): VaultSnapshot => {
    const base = storeRows.length === 0 && hub ? hub.snap : snapshotFromStores()
    return { ...base, texts: textRows, files: fileEvents, datasets: { ...(base.datasets ?? {}), "insight-log": logDataset(insightLog), drive: driveDataset(drive) } }
  }

  useEffect(() => {
    const had = document.body.classList.contains("win95-app")
    document.body.classList.remove("win95-app")
    setFlows(Object.fromEntries(FLOWS.map((f) => [f.id, loadFlow(f.id)])))
    setAnalyses(loadAnalyses())
    setInsightLog(loadInsightLog())
    setDrive(loadDrive())
    setSeen(loadSeen())
    setRunLog(loadRunLog())
    try {
      const m = localStorage.getItem(MODEL_KEY)
      if (m) setModel(m)
      const pl = localStorage.getItem(PLAN_KEY)
      if (pl) setPlan(JSON.parse(pl) as ModelPlan)
      const i = localStorage.getItem(INPUT_KEY)
      if (i) setSpec({ ...DEFAULT_INPUT, ...(JSON.parse(i) as Partial<InputSpec>) })
    } catch {}
    const kept = loadResults()
    setResults(kept.length ? saveResults(kept) : kept)
    setHistory(loadHistory())
    setLoaded(true)
    void listOllamaModels().then(setModels)
    void loadHubVault().then((h) => {
      setHub(h)
      void loadTexts({ people: h?.snap.people ?? snapshotFromStores().people }).then((rows) => {
        setTextRows(rows ?? [])
        setTextsState(rows && rows.length ? "ok" : "none")
      })
    })
    void loadFileEvents().then((rows) => setFileEvents(rows ?? []))
    return () => void (had && document.body.classList.add("win95-app"))
  }, [])

  useEffect(() => {
    if (!loaded) return
    for (const [id, f] of Object.entries(flows)) save(graphKey(id), JSON.stringify(f))
  }, [flows, loaded])

  useEffect(() => {
    if (loaded) save(INPUT_KEY, JSON.stringify(spec))
  }, [spec, loaded])

  useEffect(() => {
    if (loaded) save(PLAN_KEY, JSON.stringify(plan))
  }, [plan, loaded])

  const pickFlow = (id: string) => {
    setFlowId(id)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setViewId(jobs.find((j) => j.flowId === id)?.id ?? null)
    setOpenMsg(null)
    setEntry("")
    const input = id.startsWith("a:") ? "question" : flowDef(id as FlowId).input
    setSource(input === "question" ? "ask" : id === "texts-day" ? "texts" : source === "ask" ? "feed" : source)
    if (id === "texts-day") setTextScope("all")
    // A screen with one start node loads that door's sample input.
    const door = entryDef(((flows[id] ?? flowDef(id as FlowId).build()).nodes.find((n) => n.kind === "message")?.config.entry) ?? "")
    if (input === "question" && door?.sample) setQuestion(door.sample)
    if (input === "day") setSpec((p) => ({ ...p, grouping: "day" }))
    else if (spec.grouping === "day" && input === "messages") setSpec((p) => ({ ...p, grouping: "each" }))
  }

  const feedByDay = useMemo(() => {
    const map = new Map<string, { id: string; text: string; at: string }[]>()
    for (const r of [...feedRows].sort((a, b) => a.at.localeCompare(b.at))) {
      if (!readable(r.text)) continue
      const k = dayKey(r.at)
      map.set(k, [...(map.get(k) ?? []), { id: r.id, text: r.text, at: r.at }])
    }
    return map
  }, [feedRows])
  const textsByDay = useMemo(() => {
    const map = new Map<string, TextRow[]>()
    const floor = localDay(new Date(Date.now() - (TEXT_WINDOW_DAYS - 1) * 86400_000).toISOString())
    for (const r of textRows) if (localDay(r.at) >= floor) map.set(localDay(r.at), [...(map.get(localDay(r.at)) ?? []), r])
    return map
  }, [textRows])
  const days = useMemo(() => [...(source === "texts" ? textsByDay : feedByDay).keys()].sort().reverse(), [feedByDay, textsByDay, source])
  const dayCount = (d: string) => (source === "texts" ? textsByDay.get(d)?.length : feedByDay.get(d)?.length) ?? 0
  const activeDay = day && days.includes(day) ? day : days[0] || dayKey(new Date().toISOString())

  /** The inputs as grouped, before any context is added. A question is built at run time. */
  const baseInputs = useMemo(() => {
    if (source === "ask") return []
    if (source === "texts") return group(textsToFeed(textsByDay.get(activeDay) ?? [], textScope), textScope === "bursts" ? { ...spec, grouping: "each" } : spec)
    const rows =
      source === "feed"
        ? feedByDay.get(activeDay) ?? []
        : parsePasted(pasted, activeDay).map((m) => ({ id: m.id, text: m.text, at: m.at }))
    return group(rows, spec)
  }, [source, feedByDay, textsByDay, textScope, activeDay, pasted, spec])

  const runs = run?.messages ?? live
  const openRun = openMsg != null ? runs[openMsg] ?? null : null
  const selectedNode = flow.nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedStep = openRun?.steps.find((s) => s.nodeId === selectedNodeId) ?? null

  const updateNode = (node: FlowNode) => setFlow((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === node.id ? node : n)) }))

  const addNode = (kind: FlowNode["kind"]) => {
    const id = `${kind}-${Date.now().toString(36)}`
    const maxY = Math.max(...flow.nodes.map((n) => n.y), 0)
    const node: FlowNode = { id, kind, label: `New ${kind}`, x: 260, y: maxY + NODE_H + 60, config: kind === "gate" ? { question: "" } : kind === "retrieve" ? { retrieve: { kind: "text" } } : kind === "compute" ? { compute: { fn: "count" } } : {} }
    setFlow((f) => ({ ...f, nodes: [...f.nodes, node] }))
    setSelectedNodeId(id)
  }

  const start = async () => {
    const ctl = new AbortController()
    const id = `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    ctls.current.set(id, ctl)
    const name = flowId.startsWith("a:") ? flow.nodes[0]?.label ?? flowId : flowDef(flowId as FlowId).name
    setJobs((all) => [{ id, flowId, label: name, running: true, run: null, live: [], progress: "", notes: [] }, ...all].slice(0, 12))
    setViewId(id)
    setOpenMsg(null)
    save(MODEL_KEY, model)
    try {
      const snap = vault()
      const call = ollamaCall(model, ctl.signal)
      const stamp = (m: FlowMessage): FlowMessage => (entry ? { ...m, entry } : m)
      const base = (source === "ask" ? [questionMessage(question)] : baseInputs).map(stamp)
      patchJob(id, { progress: "adding context…" })
      const aug = await augment(base, spec, { snap, call, signal: ctl.signal })
      patchJob(id, { notes: aug.notes })
      const result = await runFlow(flow, aug.messages, call, snap, {
        model,
        models: plan,
        rank: (q, texts) => embedScores(q, texts, ctl.signal),
        getFlow: (id) => flows[id],
        known: insightLog.map((i) => i.text),
        onStep: (i, s) => patchJob(id, { progress: `${i + 1}/${aug.messages.length} · ${flow.nodes.find((n) => n.id === s.nodeId)?.label ?? s.nodeId}` }),
        onMessage: (r) => patchJob(id, (j) => ({ live: [...j.live, r] })),
      })
      patchJob(id, { run: result })
      const felt = result.messages.flatMap((m) => m.proposals.filter((x) => x.action === "drive").map((x) => readingFromProposal((x.data as { fields?: Record<string, unknown> }).fields, m.message)))
      const got = felt.filter((x): x is DriveReading => x != null)
      if (got.length) setDrive((d) => saveDrive(d, got))
      archive("flow-run", { origin: "bench", flowId, flow, model, source, input: aug.messages, run: result })
      setHistory((h) =>
        saveHistory([
          { id: `${flowId}-${Date.now()}`, flowId, flowName: flowId.startsWith("a:") ? flow.nodes[0]?.label ?? flowId : flowDef(flowId as FlowId).name, at: new Date().toISOString(), model, inputLabel: `${aug.messages.length} input${aug.messages.length === 1 ? "" : "s"} · ${source === "ask" ? "question" : source} · ${spec.grouping}`, flow, run: slimRun(result), origin: "bench" },
          ...h,
        ]),
      )
      setViewId((v) => {
        if (v === id) setPreview(true)
        return v
      })
      patchJob(id, { progress: `${aug.messages.length} inputs in ${(result.ms / 1000).toFixed(1)}s` })
    } catch (err) {
      patchJob(id, { progress: ctl.signal.aborted ? "Stopped" : `Failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      ctls.current.delete(id)
      patchJob(id, { running: false })
    }
  }

  const toScan = useMemo(() => (driveOpen ? driveSources(vault()).filter((x) => !seen.has(x.id)) : []), // eslint-disable-line react-hooks/exhaustive-deps
    [driveOpen, hub, storeRows.length, seen])

  const scanDrive = async () => {
    driveAbort.current?.abort()
    const ctl = new AbortController()
    driveAbort.current = ctl
    setDriveRunning(true)
    save(MODEL_KEY, model)
    const call = ollamaCall(model, ctl.signal)
    const batch = toScan.slice(0, 80)
    let all = drive
    const done = new Set(seen)
    try {
      for (const [i, src] of batch.entries()) {
        if (ctl.signal.aborted) break
        setDriveProgress(`${i + 1}/${batch.length} · ${src.source} ${src.at.slice(0, 10)}`)
        const found = await readDrive(src, call, driveBoard(all).map((r) => r.task))
        if (ctl.signal.aborted) break
        done.add(src.id)
        if (found.length) {
          all = saveDrive(all, found)
          setDrive(all)
        }
      }
      setDriveProgress(ctl.signal.aborted ? "Stopped" : `Done · ${batch.length} read`)
    } catch (err) {
      setDriveProgress(ctl.signal.aborted ? "Stopped" : `Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      saveSeen(done)
      setSeen(done)
      setDriveRunning(false)
    }
  }

  const runTests = async (ids: string[]) => {
    testAbort.current?.abort()
    const ctl = new AbortController()
    testAbort.current = ctl
    setTestRunning(true)
    save(MODEL_KEY, model)
    const snap = vault()
    const call = ollamaCall(model, ctl.signal, { fresh: true })
    const label = runLabel.trim() || `${model}${plan.gates ? ` · gates ${plan.gates}` : ""}${plan.prose ? ` · prose ${plan.prose}` : ""}`
    const latestDay = () => {
      const d = days[0]
      return d ? { day: d, rows: feedByDay.get(d) ?? [] } : null
    }
    try {
      for (const [i, id] of ids.entries()) {
        const t = TESTS.find((x) => x.id === id)
        if (!t || ctl.signal.aborted) break
        setTestProgress(`${i + 1}/${ids.length} · ${t.name}`)
        setLiveTest({ testId: t.id, index: 0, current: null, since: Date.now(), done: [] })
        const r = await runTest(t, { call, snap, model, models: plan, label, signal: ctl.signal,
          rank: (q, texts) => embedScores(q, texts, ctl.signal),
          getFlow: (fid) => flows[fid] ?? flowDef(fid).build(),
          latestDay,
          onStart: (index, nodeId) => setLiveTest((l) => (l ? { ...l, current: nodeId, since: Date.now(), index, done: index === l.index ? l.done : [] } : l)),
          onStep: (index, st) => setLiveTest((l) => (l ? { ...l, index, done: index === l.index ? [...l.done, st] : [st] } : l)),
        })
        if (ctl.signal.aborted) break
        archive("test-result", r)
        setResults((prev) => saveResults([r, ...prev]))
      }
      setTestProgress(ctl.signal.aborted ? "Stopped" : `Done · ${ids.length} ran`)
    } finally {
      setTestRunning(false)
      setLiveTest(null)
    }
  }

  const analysisFlow = (a: AnalysisDef): Flow => flows[`a:${a.id}`] ?? buildAnalysisFlow(a)

  const openAnalysisFlow = (a: AnalysisDef) => {
    setFlows((all) => (all[`a:${a.id}`] ? all : { ...all, [`a:${a.id}`]: buildAnalysisFlow(a) }))
    pickFlow(`a:${a.id}`)
    setAnalysesOpen(false)
  }

  const changeAnalyses = (next: AnalysisDef[]) => {
    setAnalyses(next)
    saveAnalyses(next)
  }

  const runAnalyses = async (ids: string[]) => {
    analysisAbort.current?.abort()
    const ctl = new AbortController()
    analysisAbort.current = ctl
    setAnRunning(true)
    save(MODEL_KEY, model)
    const snap = vault()
    const call = ollamaCall(model, ctl.signal)
    const runId = `r${Date.now().toString(36)}`
    let log = insightLog
    try {
      for (const [i, id] of ids.entries()) {
        const a = analyses.find((x) => x.id === id)
        if (!a || ctl.signal.aborted) break
        setAnProgress(`${i + 1}/${ids.length} · ${a.name}`)
        const r = await runAnalysis(a, { call, snap, model, getFlow: analysisFlow, known: log.map((x) => x.text), runId })
        if (ctl.signal.aborted) break
        log = saveInsightLog([...r.insights, ...log])
        setInsightLog(log)
        setRunLog((prev) => saveRunLog([r.record, ...prev]))
      }
      setAnProgress(ctl.signal.aborted ? "Stopped" : `Done · ${ids.length} ran`)
    } finally {
      setAnRunning(false)
    }
  }

  const datasetCounts = useMemo(() => {
    if (!analysesOpen) return {}
    const ds = vault().datasets ?? {}
    return Object.fromEntries(Object.entries(ds).map(([id, d]) => [id, d.rows.length]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysesOpen, hub, storeRows.length, insightLog])

  const startNodes = flow.nodes.filter((n) => n.kind === "message" && n.config.entry)
  const isAnalysis = flowId.startsWith("a:")
  const def = isAnalysis ? { id: flowId, name: analyses.find((a) => `a:${a.id}` === flowId)?.name ?? "Analysis", blurb: "An analysis node view.", input: "question" as const, build: () => buildAnalysisFlow(analyses.find((a) => `a:${a.id}` === flowId) ?? analyses[0]!) } : flowDef(flowId as FlowId)
  const hasFlowBlocks = flow.nodes.some((n) => n.kind === "blocks")

  return (
    <div className="bf-lab">
      <header className="bf-top">
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/")}>
          ← Brain2
        </button>
        <b className="bf-title">BIM · FLOW</b>
        <select className="bf-input on-mill" value={flowId} onChange={(e) => pickFlow(e.target.value)} aria-label="Flow" title={def.blurb}>
          {FLOWS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          {isAnalysis ? <option value={flowId}>Analysis: {def.name}</option> : null}
        </select>
        <span className="bf-k">{storeRows.length > 0 ? "vault: this window" : hub ? "vault: hub copy" : "vault: loading"}</span>
        <span className={`bf-lamp ${models ? "is-on" : "is-off"}`} title={models ? "Ollama answering" : "Ollama not answering on 127.0.0.1:11434"} />
        <select className="bf-input on-mill" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
          {[...new Set([model, ...(models ?? [])])].map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="bf-input on-mill" value={plan.gates ?? ""} onChange={(e) => setPlan((p) => ({ ...p, gates: e.target.value || undefined }))} aria-label="Model for gates" title="Model for yes/no gates, routes and picks">
          <option value="">gates: main</option>
          {[...new Set([plan.gates, ...(models ?? [])].filter((m): m is string => !!m))].map((m) => <option key={m} value={m}>gates: {m}</option>)}
        </select>
        <select className="bf-input on-mill" value={plan.prose ?? ""} onChange={(e) => setPlan((p) => ({ ...p, prose: e.target.value || undefined }))} aria-label="Model for prose" title="Model for answers, summaries, checks and insights">
          <option value="">prose: main</option>
          {[...new Set([plan.prose, ...(models ?? [])].filter((m): m is string => !!m))].map((m) => <option key={m} value={m}>prose: {m}</option>)}
        </select>
        <datalist id="bf-models">{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
        <button type="button" data-no95 className="bf-cap" onClick={() => setRunsOpen(true)}>Runs · {history.filter((h) => h.flowId === flowId).length}/{history.length + results.length}</button>
        <button type="button" data-no95 className="bf-cap" onClick={() => setTests(true)}>Tests · {TESTS.filter((t) => t.flowId === flowId).length}/{TESTS.length}</button>
        <button type="button" data-no95 className="bf-cap" onClick={() => setAnalysesOpen(true)}>Analyses · {analyses.length}</button>
        <button type="button" data-no95 className="bf-cap" onClick={() => setDriveOpen(true)}>Drive · {driveBoard(drive).length}</button>
        <span className="bf-sep" />
        {(["gate", "route", "search", "link", "choose", "extract", "retrieve", "compute", "guard", "clarify", "fallback", "related", "answer", "handoff", "propose", "blocks"] as const).map((k) => (
          <button key={k} type="button" data-no95 className="bf-cap" onClick={() => addNode(k)}>+ {k}</button>
        ))}
        <span className="bf-sep" />
        {selectedEdgeId ? (
          <button type="button" data-no95 className="bf-cap" onClick={() => { setFlow((f) => ({ ...f, edges: f.edges.filter((e) => e.id !== selectedEdgeId) })); setSelectedEdgeId(null) }}>
            Cut wire
          </button>
        ) : null}
        <button type="button" data-no95 className="bf-cap" onClick={() => { if (confirm(`Replace this graph with the starter ${def.name} graph?`)) setFlow(def.build()) }}>
          Starter graph
        </button>
      </header>

      <div className="bf-main">
        <FlowCanvas
          key={flowId}
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
            <button type="button" data-no95 className={source === "texts" ? "is-on" : ""} disabled={textsState === "none"} title={textsState === "none" ? "No recent texts reached the lab (needs the hub)" : "Phone texts from the last two weeks"} onClick={() => setSource("texts")}>Texts</button>
            <button type="button" data-no95 className={source === "ask" ? "is-on" : ""} onClick={() => setSource("ask")}>Ask</button>
            {source === "texts" ? (
              <select className="bf-input" value={textScope} onChange={(e) => setTextScope(e.target.value as TextScope)} aria-label="Which texts" title={TEXT_SCOPE_HINT[textScope]}>
                {(Object.keys(TEXT_SCOPE_LABEL) as TextScope[]).map((k) => (
                  <option key={k} value={k}>{TEXT_SCOPE_LABEL[k]}</option>
                ))}
              </select>
            ) : null}
            {source !== "ask" ? (
              <select className="bf-input" value={activeDay} onChange={(e) => setDay(e.target.value)} aria-label="Day">
                {(days.length ? days : [activeDay]).map((d) => (
                  <option key={d} value={d}>{d} · {dayCount(d)}</option>
                ))}
              </select>
            ) : null}
            {running ? (
              <button type="button" data-no95 onClick={() => job && ctls.current.get(job.id)?.abort()}>Stop</button>
            ) : (
              <button type="button" data-no95 className="is-go" disabled={!models || (source === "ask" ? !question.trim() : !baseInputs.length)} onClick={() => void start()}>
                Run {source === "ask" ? 1 : baseInputs.length}
              </button>
            )}
            <button type="button" data-no95 disabled={!runs.length} onClick={() => setPreview(true)}>Preview</button>
          </div>
          {jobs.length ? (
            <div className="bf-row" title="Each Run is its own job; they go in parallel">
              {jobs.map((j) => (
                <button key={j.id} type="button" data-no95 className={j.id === viewId ? "is-on" : ""} onClick={() => { setViewId(j.id); setOpenMsg(null) }}>
                  {j.running ? "● " : ""}{j.label} · {j.progress || "…"}
                </button>
              ))}
              {jobs.some((j) => !j.running) ? <button type="button" data-no95 onClick={() => setJobs((all) => all.filter((j) => j.running))}>Clear done</button> : null}
            </div>
          ) : null}
          <div className="bf-row" title="What one input is, and what context is added to it">
            {(Object.keys(GROUPING_LABEL) as Grouping[]).map((g) => (
              <button key={g} type="button" data-no95 className={spec.grouping === g ? "is-on" : ""} disabled={source === "ask"} onClick={() => setSpec((p) => ({ ...p, grouping: g }))}>
                {GROUPING_LABEL[g]}
              </button>
            ))}
            <span className="bf-k">+</span>
            {(Object.keys(AUGMENT_LABEL) as Augment[]).map((a) => (
              <button
                key={a}
                type="button"
                data-no95
                className={spec.augment.includes(a) ? "is-on" : ""}
                onClick={() => setSpec((p) => ({ ...p, augment: p.augment.includes(a) ? p.augment.filter((x) => x !== a) : [...p.augment, a] }))}
              >
                {AUGMENT_LABEL[a]}
              </button>
            ))}
          </div>
          {startNodes.length > 0 ? (
            <div className="bf-row" title="Which start node the input comes in through">
              <span className="bf-k">Start at</span>
              <select
                className="bf-input"
                value={entry}
                onChange={(e) => {
                  setEntry(e.target.value)
                  const d = entryDef(e.target.value)
                  if (d && d.sample && source === "ask") setQuestion(d.sample)
                }}
                aria-label="Start node"
              >
                <option value="">first start node</option>
                {startNodes.map((n) => (
                  <option key={n.id} value={n.config.entry}>{entryDef(n.config.entry!)?.name ?? n.config.entry} · {entryDef(n.config.entry!)?.surface ?? ""}</option>
                ))}
              </select>
            </div>
          ) : null}
          <span className="bf-progress">{progress}</span>
          {notes.map((n, i) => <span key={i} className="bf-note">{n}</span>)}
          {source === "paste" ? (
            <textarea className="bf-input bf-paste" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="14:05 starting walk" />
          ) : source === "ask" ? (
            <textarea className="bf-input bf-paste" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="when i hang out with elijah, what shirt do i wear most?" />
          ) : (
            <ol className="bf-msgs">
              {baseInputs.map((m, i) => (
                <li key={m.id} className={openMsg === i ? "is-open" : ""}>
                  <button type="button" data-no95 onClick={() => setOpenMsg(openMsg === i ? null : i)} disabled={!runs[i]}>
                    <span className="bf-clock">{clock(m.at)}</span> {m.text.split("\n").length > 1 ? `${m.text.split("\n").length} lines · ${m.text.split("\n")[0]!.slice(0, 40)}…` : m.text}
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
                  <span className="bf-clock">{clock(r.message.at)}</span> {r.message.text.split("\n")[0]!.slice(0, 80)}
                </button>
                {r.message.context ? <div className="bf-why">+ context: {r.message.context.split("\n").length} lines</div> : null}
                <span className="bf-chips">
                  {r.proposals.length === 0 && r.signals.length === 0 && r.answers.length === 0 ? <i>nothing</i> : null}
                  {r.answers.map((a, j) => <span key={`a${j}`} className={`bf-chip is-conf-${a.confidence}`}>{a.text.slice(0, 160)}</span>)}
                  {r.signals.map((s, j) => <span key={`s${j}`} className="bf-chip is-span">{s.activity} · {s.relation}{s.since ? ` since ${s.since}` : ""}{s.minutesLeft ? ` +${s.minutesLeft}m` : ""}</span>)}
                  {r.proposals.map((p, j) => <span key={j} className={`bf-chip is-${p.action}`}>{p.summary}</span>)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bf-run-blocks">
          <span className="bf-k">{hasFlowBlocks ? "Time blocks (built by code)" : "Evidence at the open step"}</span>
          {hasFlowBlocks ? (
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
          ) : (
            <ol className="bf-msgs">
              {(openRun?.answers[0] ?? runs[0]?.answers[0])?.evidence.map((e, i) => (
                <li key={i}><span className="bf-clock">{e.when}</span> {e.text}<div className="bf-why">{e.source}</div></li>
              )) ?? <li><i>run a question</i></li>}
            </ol>
          )}
        </div>
      </section>
      {preview ? <FlowPreview flow={flow} runs={runs} run={run} onClose={() => setPreview(false)} /> : null}
      {runsOpen ? (
        <FlowRuns
          flowId={flowId}
          flowName={flowId.startsWith("a:") ? flow.nodes[0]?.label ?? flowId : flowDef(flowId as FlowId).name}
          history={history}
          results={results}
          nameOf={(id) => (id.startsWith("a:") ? flows[id]?.nodes[0]?.label ?? id : flowDef(id as FlowId).name)}
          flowOf={(id) => flows[id] ?? flowDef(id as FlowId).build()}
          onOpenOutput={setViewRun}
          onDelete={(id) => setHistory((h) => saveHistory(h.filter((x) => x.id !== id)))}
          onClose={() => setRunsOpen(false)}
        />
      ) : null}
      {viewRun ? <FlowPreview flow={viewRun.flow} runs={viewRun.run.messages} run={viewRun.run} onClose={() => setViewRun(null)} /> : null}
      {driveOpen ? (
        <DriveSheet
          readings={drive}
          taskNames={vault().items.filter((i) => i.type === "task").slice(0, 30).map((i) => i.title)}
          onChange={(next) => setDrive(saveDrive([], next))}
          onAdd={(r) => setDrive((d) => saveDrive(d, [r]))}
          scanCount={toScan.length}
          running={driveRunning}
          progress={driveProgress}
          onScan={() => void scanDrive()}
          onStop={() => driveAbort.current?.abort()}
          onClear={() => {
            clearDrive()
            setDrive([])
            setSeen(new Set())
          }}
          onClose={() => setDriveOpen(false)}
        />
      ) : null}
      {analysesOpen ? (
        <AnalysesSheet
          analyses={analyses}
          onChange={changeAnalyses}
          log={insightLog}
          onLog={(next) => setInsightLog(saveInsightLog(next))}
          runs={runLog}
          datasetCounts={datasetCounts}
          running={anRunning}
          progress={anProgress}
          onRun={(ids) => void runAnalyses(ids)}
          onStop={() => analysisAbort.current?.abort()}
          onOpenFlow={openAnalysisFlow}
          onClose={() => setAnalysesOpen(false)}
        />
      ) : null}
      {tests ? (
        <FlowTests
          activeId={flowId}
          activeName={flowId.startsWith("a:") ? flow.nodes[0]?.label ?? flowId : flowDef(flowId as FlowId).name}
          results={results}
          running={testRunning}
          progress={testProgress}
          live={liveTest}
          flowOf={(id) => flows[id] ?? flowDef(id as FlowId).build()}
          onRun={(ids) => void runTests(ids)}
          onStop={() => testAbort.current?.abort()}
          coreIds={CORE_TEST_IDS}
          label={runLabel}
          onLabel={setRunLabel}
          onClose={() => setTests(false)}
        />
      ) : null}
    </div>
  )
}
