/**
 * components/Home/ToDo/fascia/PriorityFormulaPanel.tsx — Priority formula: weights, saved formulas, and the math
 *
 * Saved formulas live in `todo-prefs` (`formulas`); applying one writes its
 * weights to the task store, the one source the sort reads. The math view is
 * optional (Settings → Show the math, or its own key here): the formula
 * typeset with live weights, the weight simplex, each task's score as a stack
 * of wᵢφᵢ, each φ's spread across tasks, the unlock curve, and Spearman ρ
 * against the default formula. Plain SVG, no chart library.
 */
"use client"

import { useMemo, useState } from "react"
import type { PriorityWeights, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { DEFAULT_PRIORITY_WEIGHTS, normalizePriorityInputs, priorityBreakdown, unlocksWeight } from "@/lib/priority"
import { unlockContextFor, urgencyFloorForDue } from "@/lib/unlock-value"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { setTodoPrefs, useTodoPrefs } from "../todo-prefs"

type Key = "urgency" | "importance" | "cognitiveLoad" | "entropy" | "unlocks"

const TERMS: { key: Key; label: string; sym: string; def: string; hint: string; color: string }[] = [
  { key: "urgency", label: "Urgency", sym: "u", def: "(u − 1) / 4", hint: "Higher urgency ranks sooner", color: "#b8433f" },
  { key: "importance", label: "Importance", sym: "i", def: "(i − 1) / 4", hint: "Higher importance ranks sooner", color: "#2f5fa8" },
  { key: "cognitiveLoad", label: "Quick win", sym: "q", def: "(3 − c) / 2", hint: "Lower cognitive load ranks sooner", color: "#1a8a6a" },
  { key: "entropy", label: "Entropy", sym: "e", def: "e", hint: "Vaguer tasks surface for clarification", color: "#7a5cc0" },
  { key: "unlocks", label: "Unlocks", sym: "k", def: "1 − 1 / (1 + k)", hint: "Work that other tasks wait on rises", color: "#3d7f9a" },
]

const wOf = (w: PriorityWeights, k: Key) => (k === "unlocks" ? unlocksWeight(w) : w[k])
const sameWeights = (a: PriorityWeights, b: PriorityWeights) => TERMS.every(({ key }) => Math.abs(wOf(a, key) - wOf(b, key)) < 1e-9)
const fmt = (n: number, d = 2) => n.toFixed(d)

/** Spearman ρ between two orderings of the same ids. */
function spearman(a: string[], b: string[]): number {
  const n = a.length
  if (n < 2) return 1
  const rank = new Map(b.map((id, i) => [id, i]))
  const d2 = a.reduce((sum, id, i) => sum + (i - (rank.get(id) ?? i)) ** 2, 0)
  return 1 - (6 * d2) / (n * (n * n - 1))
}

function Sub({ s }: { s: string }) {
  return <sub>{s}</sub>
}

export function PriorityFormulaPanel({ candidates }: { candidates?: Task[] }) {
  const tasks = useTaskStore((s) => s.tasks)
  const weights = useTaskStore((s) => s.priorityWeights)
  const setWeights = useTaskStore((s) => s.updatePriorityWeights)
  const { formulas, showMath } = useTodoPrefs()
  const [mathOpen, setMathOpen] = useState(showMath)
  const [saveName, setSaveName] = useState("")

  const pool = useMemo(
    () => (candidates ?? tasks.filter((t) => !t.completed && t.stage !== "list")).slice(0, 400),
    [candidates, tasks],
  )

  const rows = useMemo(() => {
    const now = new Date()
    const unlock = unlockContextFor(tasks, { now })
    return pool.map((task) => {
      const ctx = unlock.get(task.id)
      const context = ctx
        ? { unlocks: ctx.unlocks, urgencyFloor: ctx.inherited ? urgencyFloorForDue(ctx.inherited.due, now) : undefined }
        : undefined
      const n = normalizePriorityInputs(task)
      const k = ctx?.unlocks ?? 0
      const phi: Record<Key, number> = { ...n, unlocks: k > 0 ? 1 - 1 / (1 + k) : 0 }
      return {
        task,
        phi,
        now: priorityBreakdown(task, weights, context),
        base: priorityBreakdown(task, DEFAULT_PRIORITY_WEIGHTS, context).total,
      }
    })
  }, [pool, tasks, weights])

  const ranked = useMemo(() => [...rows].sort((a, b) => b.now.total - a.now.total), [rows])
  const rho = useMemo(
    () => spearman(ranked.map((r) => r.task.id), [...rows].sort((a, b) => b.base - a.base).map((r) => r.task.id)),
    [ranked, rows],
  )
  const wSum = TERMS.reduce((s, { key }) => s + wOf(weights, key), 0) || 1
  const top = ranked.slice(0, 8)
  const maxTotal = Math.max(wSum, ...top.map((r) => r.now.total), 0.0001)

  const setW = (key: Key, raw: number) =>
    setWeights({ ...weights, [key]: Number.isFinite(raw) && raw >= 0 ? raw : 0 })

  const save = () => {
    const name = saveName.trim()
    if (!name) return
    const existing = formulas.find((f) => f.name.toLowerCase() === name.toLowerCase())
    const next = existing
      ? formulas.map((f) => (f === existing ? { ...f, weights: { ...weights } } : f))
      : [...formulas, { id: `pf-${Date.now().toString(36)}`, name, weights: { ...weights } }]
    setTodoPrefs({ formulas: next })
    setSaveName("")
  }

  return (
    <div
      className="todo-formula"
      data-ui-name="Priority formula"
      data-ui-help="Weights, saved formulas, and an optional view of the math."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="tier-system--sorting"
    >
      <div className="todo-formula-head">
        <div>
          <h3>Priority formula</h3>
          <p className="todo-hint">
            score = w·urgency + w·importance + w·(quick win) + w·entropy + w·unlocks. Set a weight to 0 to ignore that signal.
          </p>
        </div>
        <button type="button" className="todo-btn" aria-pressed={mathOpen} onClick={() => setMathOpen((v) => !v)}>
          {mathOpen ? "Hide the math" : "Show the math"}
        </button>
        <button type="button" className="todo-btn" onClick={() => setWeights({ ...DEFAULT_PRIORITY_WEIGHTS })}>
          Reset
        </button>
      </div>

      <div className="todo-formula-presets" role="group" aria-label="Saved formulas">
        <button
          type="button"
          className={`todo-chiclet${sameWeights(weights, DEFAULT_PRIORITY_WEIGHTS) ? " is-on" : ""}`}
          onClick={() => setWeights({ ...DEFAULT_PRIORITY_WEIGHTS })}
        >
          Default
        </button>
        {formulas.map((f) => (
          <span key={f.id} className="todo-formula-preset">
            <button
              type="button"
              className={`todo-chiclet${sameWeights(weights, f.weights) ? " is-on" : ""}`}
              title={TERMS.map(({ key, sym }) => `w${sym}=${fmt(wOf(f.weights, key))}`).join("  ")}
              onClick={() => setWeights({ ...f.weights })}
            >
              {f.name}
            </button>
            <button
              type="button"
              className="todo-formula-preset-x"
              aria-label={`Delete formula ${f.name}`}
              onClick={() => setTodoPrefs({ formulas: formulas.filter((x) => x.id !== f.id) })}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={saveName}
          placeholder="Name this formula"
          aria-label="Formula name"
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button type="button" className="todo-btn" disabled={!saveName.trim()} onClick={save}>
          Save
        </button>
      </div>

      <div className="todo-formula-grid">
        {TERMS.map(({ key, label, hint, color }) => (
          <label key={key} style={{ ["--term" as string]: color }}>
            <div className="todo-label">
              {label} <span className="todo-formula-share">{fmt((wOf(weights, key) / wSum) * 100, 0)}%</span>
            </div>
            <div className="todo-formula-dial">
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                aria-label={`${label} weight slider`}
                value={wOf(weights, key)}
                onChange={(e) => setW(key, Number.parseFloat(e.target.value))}
              />
              <input
                id={`pw-${key}`}
                type="number"
                min="0"
                step="0.25"
                value={wOf(weights, key)}
                onChange={(e) => setW(key, Number.parseFloat(e.target.value))}
              />
            </div>
            <p className="todo-hint">{hint}</p>
          </label>
        ))}
      </div>

      {mathOpen && (
        <div className="todo-math" aria-label="The math">
          <section className="todo-math-card is-wide">
            <h4>The score</h4>
            <p className="todo-math-eq">
              S(t) = <span className="todo-math-big">Σ</span>
              <Sub s="j" /> w<Sub s="j" /> φ<Sub s="j" />(t), &nbsp; S ∈ [0, Σw] = [0, {fmt(wSum)}]
            </p>
            <p className="todo-math-eq is-live">
              S ={" "}
              {TERMS.map(({ key, sym, color }, i) => (
                <span key={key} style={{ color }}>
                  {i > 0 && " + "}
                  {fmt(wOf(weights, key))}·φ<Sub s={sym} />
                </span>
              ))}
            </p>
            <ul className="todo-math-defs">
              {TERMS.map(({ key, sym, def, color }) => (
                <li key={key} style={{ color }}>
                  φ<Sub s={sym} /> = {def}
                </li>
              ))}
            </ul>
            <p className="todo-hint">
              Each φ is clamped to [0, 1]. ∂S/∂w<Sub s="j" /> = φ<Sub s="j" />: nudge a weight and each task moves by its own φ.
            </p>
          </section>

          <section className="todo-math-card is-wide">
            <h4>
              Weight simplex <span className="todo-hint">ŵ<Sub s="j" /> = w<Sub s="j" /> / Σw</span>
            </h4>
            <svg viewBox="0 0 400 22" className="todo-math-svg" role="img" aria-label="Normalized weights">
              {(() => {
                let x = 0
                return TERMS.map(({ key, sym, color }) => {
                  const w = (wOf(weights, key) / wSum) * 400
                  const el = (
                    <g key={key}>
                      <rect x={x} y={2} width={Math.max(0, w - 1)} height={18} fill={color} opacity={0.85} />
                      {w > 26 && (
                        <text x={x + w / 2} y={15} textAnchor="middle" className="todo-math-svg-label">
                          {sym} {fmt(wOf(weights, key) / wSum, 2)}
                        </text>
                      )}
                    </g>
                  )
                  x += w
                  return el
                })
              })()}
            </svg>
          </section>

          <section className="todo-math-card is-wide">
            <h4>
              Top {top.length} as stacks of w<Sub s="j" />φ<Sub s="j" />
            </h4>
            {top.length === 0 ? (
              <p className="todo-hint">No open tasks to score.</p>
            ) : (
              <svg viewBox={`0 0 400 ${top.length * 22 + 14}`} className="todo-math-svg" role="img" aria-label="Score contributions">
                {top.map((r, i) => {
                  let x = 150
                  const scale = 220 / maxTotal
                  return (
                    <g key={r.task.id} transform={`translate(0 ${i * 22})`}>
                      <text x={146} y={14} textAnchor="end" className="todo-math-svg-name">
                        {itemTitleOrUntitled(r.task).slice(0, 24)}
                      </text>
                      {TERMS.map(({ key, color }) => {
                        const w = r.now[key] * scale
                        const el = <rect key={key} x={x} y={3} width={Math.max(0, w)} height={14} fill={color} opacity={0.85} />
                        x += w
                        return el
                      })}
                      <text x={x + 4} y={14} className="todo-math-svg-num">
                        {fmt(r.now.total)}
                      </text>
                    </g>
                  )
                })}
                <line x1={150} x2={150} y1={0} y2={top.length * 22} className="todo-math-axis" />
              </svg>
            )}
          </section>

          <section className="todo-math-card">
            <h4>
              Spread of φ<Sub s="j" /> over {rows.length} tasks
            </h4>
            <svg viewBox="0 0 220 120" className="todo-math-svg" role="img" aria-label="Distribution of each signal">
              {TERMS.map(({ key, sym, color }, j) => {
                const vals = rows.map((r) => r.phi[key])
                const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
                const y = 12 + j * 22
                return (
                  <g key={key}>
                    <text x={2} y={y + 4} className="todo-math-svg-name" fill={color}>
                      φ{sym}
                    </text>
                    <line x1={24} x2={214} y1={y} y2={y} className="todo-math-axis" />
                    {vals.slice(0, 200).map((v, i) => (
                      <circle key={i} cx={24 + v * 190} cy={y + (((i * 7) % 9) - 4) * 0.9} r={1.8} fill={color} opacity={0.45} />
                    ))}
                    <line x1={24 + mean * 190} x2={24 + mean * 190} y1={y - 7} y2={y + 7} stroke={color} strokeWidth={2} />
                  </g>
                )
              })}
              <text x={24} y={118} className="todo-math-svg-num">0</text>
              <text x={210} y={118} className="todo-math-svg-num">1</text>
            </svg>
            <p className="todo-hint">Dots are tasks; the bar is the mean, E[φ].</p>
          </section>

          <section className="todo-math-card">
            <h4>Unlock curve φ<Sub s="k" />(k) = 1 − 1/(1+k)</h4>
            <svg viewBox="0 0 220 120" className="todo-math-svg" role="img" aria-label="Unlock curve">
              <line x1={20} x2={214} y1={100} y2={100} className="todo-math-axis" />
              <line x1={20} x2={20} y1={8} y2={100} className="todo-math-axis" />
              <line x1={20} x2={214} y1={8} y2={8} className="todo-math-axis is-dashed" />
              <path
                d={Array.from({ length: 61 }, (_, i) => {
                  const k = i / 6
                  return `${i ? "L" : "M"}${20 + (k / 10) * 194},${100 - (1 - 1 / (1 + k)) * 92}`
                }).join(" ")}
                fill="none"
                stroke="#3d7f9a"
                strokeWidth={2}
              />
              {rows
                .filter((r) => r.phi.unlocks > 0)
                .slice(0, 40)
                .map((r) => {
                  const k = 1 / (1 - r.phi.unlocks) - 1
                  return <circle key={r.task.id} cx={20 + (Math.min(k, 10) / 10) * 194} cy={100 - r.phi.unlocks * 92} r={2.5} fill="#3d7f9a" />
                })}
              <text x={22} y={116} className="todo-math-svg-num">k = 0</text>
              <text x={186} y={116} className="todo-math-svg-num">10</text>
              <text x={24} y={18} className="todo-math-svg-num">1</text>
            </svg>
            <p className="todo-hint">Concave: the first task waiting counts most. Dots are your tasks with something waiting.</p>
          </section>

          <section className="todo-math-card">
            <h4>Rank agreement</h4>
            <p className="todo-math-eq">
              ρ = 1 − 6Σd² / n(n²−1) = <strong>{fmt(rho, 3)}</strong>
            </p>
            <p className="todo-hint">
              Spearman ρ between this formula’s order and the default’s, over {rows.length} tasks. 1 means the same order.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
