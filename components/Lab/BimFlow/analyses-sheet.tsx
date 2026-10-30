/**
 * components/Lab/BimFlow/analyses-sheet.tsx — Manage the things BIM looks for in the Data screens
 *
 * Catalog: every analysis (a dataset, a slice, a lens), grouped, searchable,
 * editable, copyable, runnable one at a time or by group. Log: what came back
 * (patterns, thought patterns, questions to answer, ideas), each with the
 * evidence lines it cites and Keep / Dismiss. Runs: every run, with rows read,
 * insights kept, and insights code dropped. Nothing here writes the app.
 */
"use client"

import { useMemo, useState } from "react"
import { DATASET_LABELS, newAnalysis, type AnalysisDef, type InsightStatus, type LogInsight, type RunRecord } from "@/lib/bim-flow/analyses"
import type { InsightKind } from "@/lib/bim-flow/types"

const KINDS: InsightKind[] = ["pattern", "thought_pattern", "question", "idea"]
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

interface Props {
  analyses: AnalysisDef[]
  onChange: (next: AnalysisDef[]) => void
  log: LogInsight[]
  onLog: (next: LogInsight[]) => void
  runs: RunRecord[]
  datasetCounts: Record<string, number>
  running: boolean
  progress: string
  onRun: (ids: string[]) => void
  onStop: () => void
  onOpenFlow: (a: AnalysisDef) => void
  onClose: () => void
}

export function AnalysesSheet(p: Props) {
  const [tab, setTab] = useState<"catalog" | "log" | "runs">("catalog")
  const [group, setGroup] = useState("all")
  const [query, setQuery] = useState("")
  const [pick, setPick] = useState<string | null>(p.analyses[0]?.id ?? null)
  const [status, setStatus] = useState<"all" | InsightStatus>("new")
  const [kind, setKind] = useState<"all" | InsightKind>("all")
  const groups = useMemo(() => [...new Set(p.analyses.map((a) => a.group))], [p.analyses])
  const shown = p.analyses.filter((a) => (group === "all" || a.group === group) && (!query || `${a.name} ${a.lens}`.toLowerCase().includes(query.toLowerCase())))
  const sel = p.analyses.find((a) => a.id === pick) ?? null
  const lastRun = (id: string) => p.runs.find((r) => r.analysisId === id)
  const set = (patch: Partial<AnalysisDef>) => sel && p.onChange(p.analyses.map((a) => (a.id === sel.id ? { ...a, ...patch } : a)))
  const setInsight = (id: string, patch: Partial<LogInsight>) => p.onLog(p.log.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const logShown = p.log.filter((i) => (status === "all" || i.status === status) && (kind === "all" || i.kind === kind) && (group === "all" || i.group === group))

  return (
    <div className="bf-pv" role="dialog" aria-label="Analyses">
      <header className="bf-pv-top">
        <b className="bf-title">ANALYSES</b>
        <span className="bf-pv-flag">NOTHING WRITTEN</span>
        <span className="bf-k">{p.analyses.length} analyses · {p.log.length} insights · {p.runs.length} runs</span>
        <span className="bf-progress">{p.progress}</span>
        <span className="bf-sep" />
        {(["catalog", "log", "runs"] as const).map((t) => (
          <button key={t} type="button" data-no95 className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
        <button type="button" data-no95 className="bf-cap" onClick={p.onClose}>Close</button>
      </header>

      <div className="bf-an-bar">
        <select className="bf-input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
          <option value="all">All groups</option>
          {groups.map((g) => <option key={g}>{g}</option>)}
        </select>
        {tab === "catalog" ? (
          <>
            <input className="bf-input" placeholder="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            {p.running ? (
              <button type="button" data-no95 onClick={p.onStop}>Stop</button>
            ) : (
              <>
                <button type="button" data-no95 className="is-go" disabled={!sel} onClick={() => sel && p.onRun([sel.id])}>Run this</button>
                <button type="button" data-no95 onClick={() => p.onRun(shown.filter((a) => a.enabled).map((a) => a.id))}>Run these {shown.filter((a) => a.enabled).length}</button>
              </>
            )}
            <button
              type="button"
              data-no95
              onClick={() => {
                const a = newAnalysis({ group: group === "all" ? "Mine" : group })
                p.onChange([...p.analyses, a])
                setPick(a.id)
              }}
            >
              + New
            </button>
          </>
        ) : tab === "log" ? (
          <>
            <select className="bf-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
              {["all", "new", "kept", "dismissed"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="bf-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Kind">
              {["all", ...KINDS].map((k) => <option key={k}>{k}</option>)}
            </select>
          </>
        ) : null}
      </div>

      {tab === "catalog" ? (
        <div className="bf-pv-cols bf-an-cols">
          <section className="bf-pv-well">
            <span className="bf-k">{shown.length} shown</span>
            {shown.map((a) => {
              const r = lastRun(a.id)
              return (
                <button key={a.id} type="button" data-no95 className={`bf-test-row${pick === a.id ? " is-on" : ""}`} onClick={() => setPick(a.id)}>
                  <span className={`bf-status ${a.enabled ? "is-pass" : "is-none"}`}>{a.enabled ? "on" : "off"}</span>
                  <span>{a.name}</span>
                  <span className="bf-why">
                    {a.group} · {DATASET_LABELS[a.datasetId] ?? a.datasetId} · {p.datasetCounts[a.datasetId] ?? 0} rows
                    {r ? ` · ${r.error ? "error" : `${r.kept} kept`} ${when(r.at)}` : " · not run"}
                  </span>
                </button>
              )
            })}
          </section>

          <section className="bf-pv-well">
            {sel ? (
              <>
                <div className="bf-row">
                  <span className="bf-k">{sel.builtin ? "built-in" : "mine"}</span>
                  <input className="bf-input" value={sel.name} onChange={(e) => set({ name: e.target.value })} />
                  <label className="bf-field"><span>on</span><input type="checkbox" checked={sel.enabled} onChange={(e) => set({ enabled: e.target.checked })} /></label>
                </div>
                <div className="bf-grid">
                  <label className="bf-field"><span>Group</span><input className="bf-input" value={sel.group} onChange={(e) => set({ group: e.target.value })} /></label>
                  <label className="bf-field">
                    <span>Reads</span>
                    <select className="bf-input" value={sel.datasetId} onChange={(e) => set({ datasetId: e.target.value })}>
                      {Object.entries(DATASET_LABELS).map(([id, label]) => <option key={id} value={id}>{label} ({p.datasetCounts[id] ?? 0})</option>)}
                    </select>
                  </label>
                  <label className="bf-field"><span>Sources contain (comma)</span><input className="bf-input" value={(sel.sources ?? []).join(", ")} onChange={(e) => set({ sources: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>
                  <label className="bf-field"><span>Days back (0 = all)</span><input className="bf-input" type="number" min={0} value={sel.days ?? 0} onChange={(e) => set({ days: Number(e.target.value) || undefined })} /></label>
                  <label className="bf-field"><span>Rows must contain</span><input className="bf-input" value={sel.focus ?? ""} onChange={(e) => set({ focus: e.target.value || undefined })} /></label>
                  <label className="bf-field"><span>Most insights</span><input className="bf-input" type="number" min={1} max={6} value={sel.maxInsights} onChange={(e) => set({ maxInsights: Number(e.target.value) })} /></label>
                  <label className="bf-field"><span>Needs at least rows</span><input className="bf-input" type="number" min={1} value={sel.minRows} onChange={(e) => set({ minRows: Number(e.target.value) })} /></label>
                </div>
                <div className="bf-row">
                  {KINDS.map((k) => (
                    <label key={k} className="bf-field">
                      <span>{k.replace("_", " ")}</span>
                      <input type="checkbox" checked={sel.kinds.includes(k)} onChange={(e) => set({ kinds: e.target.checked ? [...sel.kinds, k] : sel.kinds.filter((x) => x !== k) })} />
                    </label>
                  ))}
                </div>
                <label className="bf-field"><span>What to look for</span><textarea className="bf-input" rows={5} value={sel.lens} onChange={(e) => set({ lens: e.target.value })} /></label>
                <label className="bf-field"><span>Extra rules for this analysis</span><textarea className="bf-input" rows={3} value={sel.extra ?? ""} onChange={(e) => set({ extra: e.target.value || undefined })} /></label>
                <div className="bf-row">
                  <button type="button" data-no95 onClick={() => p.onOpenFlow(sel)}>Node view</button>
                  <button
                    type="button"
                    data-no95
                    onClick={() => {
                      const c = { ...sel, id: newAnalysis().id, name: `${sel.name} (copy)`, builtin: false }
                      p.onChange([...p.analyses, c])
                      setPick(c.id)
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    data-no95
                    onClick={() => {
                      if (!confirm(`${sel.builtin ? "Hide" : "Delete"} "${sel.name}"?`)) return
                      p.onChange(p.analyses.filter((a) => a.id !== sel.id))
                      setPick(null)
                    }}
                  >
                    {sel.builtin ? "Hide" : "Delete"}
                  </button>
                </div>
                {lastRun(sel.id) ? <div className="bf-why">Last run {when(lastRun(sel.id)!.at)}: {lastRun(sel.id)!.error ?? `${lastRun(sel.id)!.rows} rows read, ${lastRun(sel.id)!.kept} kept, ${lastRun(sel.id)!.dropped} dropped by code${lastRun(sel.id)!.note ? ` · ${lastRun(sel.id)!.note}` : ""}`}</div> : null}
              </>
            ) : <i className="bf-pv-none">pick an analysis or add one</i>}
          </section>
        </div>
      ) : tab === "log" ? (
        <div className="bf-pv-cols" style={{ gridTemplateColumns: "1fr" }}>
          <section className="bf-pv-well">
            <span className="bf-k">{logShown.length} insights</span>
            {logShown.map((i) => (
              <article key={i.id} className="bf-run-card">
                <div className="bf-row">
                  <span className={`bf-chip is-conf-${i.strength === "strong" ? "high" : i.strength === "likely" ? "medium" : "low"}`}>{i.kind.replace("_", " ")} · {i.strength}</span>
                  <span className="bf-why">{i.analysisName} · {when(i.at)} · {i.model}</span>
                </div>
                <div className="bf-answer-line">{i.text}</div>
                <details>
                  <summary>Evidence ({i.evidence.length})</summary>
                  {i.evidence.map((e, j) => <div key={j} className="bf-why">{e}</div>)}
                </details>
                {i.kind === "question" ? (
                  <textarea className="bf-input" rows={2} placeholder="your answer" value={i.answer ?? ""} onChange={(e) => setInsight(i.id, { answer: e.target.value || undefined, answeredAt: new Date().toISOString() })} />
                ) : null}
                <div className="bf-row">
                  <button type="button" data-no95 className={i.status === "kept" ? "is-on" : ""} onClick={() => setInsight(i.id, { status: "kept" })}>Keep</button>
                  <button type="button" data-no95 className={i.status === "dismissed" ? "is-on" : ""} onClick={() => setInsight(i.id, { status: "dismissed" })}>Dismiss</button>
                  <button type="button" data-no95 onClick={() => setInsight(i.id, { status: "new" })}>Reset</button>
                </div>
              </article>
            ))}
            {logShown.length === 0 ? <i className="bf-pv-none">nothing here yet; run an analysis</i> : null}
          </section>
        </div>
      ) : (
        <div className="bf-pv-cols" style={{ gridTemplateColumns: "1fr" }}>
          <section className="bf-pv-well">
            {p.runs.filter((r) => group === "all" || p.analyses.find((a) => a.id === r.analysisId)?.group === group).map((r) => (
              <div key={r.id + r.at} className="bf-why">
                {when(r.at)} · {r.analysisName} · {r.model} · {(r.ms / 1000).toFixed(1)}s · {r.error ? `ERROR ${r.error}` : `${r.rows} rows → ${r.kept} kept, ${r.dropped} dropped${r.note ? ` · ${r.note}` : ""}`}
              </div>
            ))}
            {p.runs.length === 0 ? <i className="bf-pv-none">no runs yet</i> : null}
          </section>
        </div>
      )}
    </div>
  )
}
