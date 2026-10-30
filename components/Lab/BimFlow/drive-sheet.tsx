/**
 * components/Lab/BimFlow/drive-sheet.tsx — Resistance and excitement about next actions
 *
 * Board: one row per task with its evolving scores (excitement, resistance,
 * pull = the difference, this week's change, a sparkline of pull after each
 * reading) and the newest reason for each pole. Open a row to see every
 * reading with the words it came from. Scan reads the person's long notes, BIM
 * messages and logs for tasks they dread or are drawn to (`lib/bim-flow/drive.ts`).
 * Readings can also be added by hand. Writes only the lab's own drive log.
 */
"use client"

import { useMemo, useState } from "react"
import { driveAsks, driveBoard, sortBoard, type BoardSort, type DrivePole, type DriveReading, type DriveRow } from "@/lib/bim-flow/drive"

const day = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" })
const sign = (n: number) => (n > 0 ? `+${n}` : String(n))

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="bf-k">1 reading</span>
  const w = 70
  const h = 22
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h / 2 - (v / 10) * (h / 2 - 2)).toFixed(1)}`).join(" ")
  return (
    <svg className="bf-drive-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="pull over time">
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="bf-drive-zero" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

interface Props {
  readings: DriveReading[]
  /** Tasks the app knows about, so BIM can ask about ones never read. */
  taskNames: string[]
  onChange: (next: DriveReading[]) => void
  onAdd: (r: DriveReading) => void
  scanCount: number
  running: boolean
  progress: string
  onScan: () => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
}

export function DriveSheet(p: Props) {
  const [by, setBy] = useState<BoardSort>("pull")
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState({ task: "", pole: "resistance" as DrivePole, strength: 5, reason: "" })
  const board = useMemo(() => driveBoard(p.readings), [p.readings])
  const rows = useMemo(() => sortBoard(board, by), [board, by])
  const asks = useMemo(() => driveAsks(board, p.taskNames), [board, p.taskNames])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [answer, setAnswer] = useState<Record<string, { pole: DrivePole; strength: number; reason: string }>>({})
  const answerOf = (t: string) => answer[t] ?? { pole: "resistance" as DrivePole, strength: 5, reason: "" }
  const reply = (task: string) => {
    const a = answerOf(task)
    const at = new Date().toISOString()
    p.onAdd({ id: `ask:${at}:${task}`, at, date: at.slice(0, 10), task, pole: a.pole, strength: a.strength, reason: a.reason.trim(), quote: a.reason.trim() || `answered: ${a.pole} ${a.strength}/10`, source: "asked" })
  }

  const add = () => {
    const task = form.task.trim()
    if (!task) return
    const at = new Date().toISOString()
    p.onAdd({ id: `hand:${at}:${task}`, at, date: at.slice(0, 10), task, pole: form.pole, strength: form.strength, reason: form.reason.trim(), quote: form.reason.trim() || task, source: "by hand" })
    setForm({ ...form, task: "", reason: "" })
  }

  const row = (r: DriveRow) => (
    <div key={r.key} className="bf-drive-row">
      <button type="button" data-no95 className={`bf-test-row${open === r.key ? " is-on" : ""}`} onClick={() => setOpen(open === r.key ? null : r.key)}>
        <span className={`bf-status ${r.pull > 0 ? "is-pass" : r.pull < 0 ? "is-fail" : "is-none"}`}>{sign(r.pull)}</span>
        <span>{r.task}</span>
        <span className="bf-why">
          <span className="bf-drive-bars">
            <i className="is-x" style={{ width: `${r.excitement * 10}%` }} />
            <i className="is-r" style={{ width: `${r.resistance * 10}%` }} />
          </span>
          excite {r.excitement} · resist {r.resistance}
          {r.trend ? ` · ${r.trend > 0 ? "▲" : "▼"} ${Math.abs(r.trend)} this week` : ""}
          {r.why.resistance ? ` · resists: ${r.why.resistance}` : ""}
          {r.why.excitement ? ` · drawn: ${r.why.excitement}` : ""}
        </span>
        <Spark values={r.series} />
      </button>
      {open === r.key ? (
        <ul className="bf-drive-readings">
          {[...r.readings].reverse().map((x) => (
            <li key={x.id}>
              <span className={`bf-status ${x.pole === "excitement" ? "is-pass" : "is-fail"}`}>{x.pole === "excitement" ? "excite" : "resist"} {x.strength}/10</span>
              <span className="bf-k">{day(x.at)} · {x.source}</span>
              <q>{x.quote}</q>
              {x.reason ? <span className="bf-why">because {x.reason}</span> : <span className="bf-why">no reason given</span>}
              <button type="button" data-no95 onClick={() => p.onChange(p.readings.filter((y) => y.id !== x.id))}>Drop</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )

  return (
    <div className="bf-pv" role="dialog" aria-label="Drive">
      <header className="bf-pv-top">
        <b className="bf-title">DRIVE</b>
        <span className="bf-pv-flag">NOTHING WRITTEN TO THE VAULT</span>
        <span className="bf-k">{rows.length} tasks · {p.readings.length} readings</span>
        <span className="bf-progress">{p.progress}</span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={p.onClose}>Close</button>
      </header>
      <div className="bf-an-bar">
        <select className="bf-input" value={by} onChange={(e) => setBy(e.target.value as BoardSort)} aria-label="Sort">
          <option value="pull">Most pulled toward</option>
          <option value="resistance">Most resisted</option>
          <option value="excitement">Most exciting</option>
          <option value="moving">Moving most this week</option>
          <option value="recent">Newest reading</option>
        </select>
        {p.running ? (
          <button type="button" data-no95 onClick={p.onStop}>Stop</button>
        ) : (
          <button type="button" data-no95 className="is-go" disabled={p.scanCount === 0} onClick={p.onScan}>Scan notes · {p.scanCount} new</button>
        )}
        <button type="button" data-no95 onClick={() => window.confirm("Clear the drive log?") && p.onClear()}>Clear</button>
      </div>
      <div className="bf-an-bar">
        <input className="bf-input" placeholder="task" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
        <select className="bf-input" value={form.pole} onChange={(e) => setForm({ ...form, pole: e.target.value as DrivePole })} aria-label="Pole">
          <option>resistance</option>
          <option>excitement</option>
        </select>
        <select className="bf-input" value={form.strength} onChange={(e) => setForm({ ...form, strength: Number(e.target.value) })} aria-label="Strength">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => <option key={s} value={s}>{s}/10</option>)}
        </select>
        <input className="bf-input" placeholder="because (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="button" data-no95 disabled={!form.task.trim()} onClick={add}>+ Add</button>
      </div>
      {asks.filter((a) => !skipped.has(a.task)).map((a) => {
        const v = answerOf(a.task)
        const set = (patch: Partial<typeof v>) => setAnswer({ ...answer, [a.task]: { ...v, ...patch } })
        return (
          <div key={a.task} className="bf-an-bar bf-drive-ask">
            <b className="bf-k">BIM ASKS</b>
            <span>{a.question}</span>
            <select className="bf-input" value={v.pole} onChange={(e) => set({ pole: e.target.value as DrivePole })} aria-label="Pole">
              <option>resistance</option>
              <option>excitement</option>
            </select>
            <select className="bf-input" value={v.strength} onChange={(e) => set({ strength: Number(e.target.value) })} aria-label="Score">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => <option key={s} value={s}>{s}/10</option>)}
            </select>
            <input className="bf-input" placeholder="because (optional)" value={v.reason} onChange={(e) => set({ reason: e.target.value })} />
            <button type="button" data-no95 className="is-go" onClick={() => reply(a.task)}>Answer</button>
            <button type="button" data-no95 onClick={() => setSkipped(new Set(skipped).add(a.task))}>Not now</button>
          </div>
        )
      })}
      <section className="bf-pv-well bf-drive-board">
        {rows.length === 0 ? <i>No readings yet. Scan reads BIM messages, logs, day notes and thought notes for dread or eagerness about a task.</i> : rows.map(row)}
      </section>
    </div>
  )
}
