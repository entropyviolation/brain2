/**
 * components/Lab/NodeDetailLab/NodeDetailLab.tsx — The lab bench
 *
 * Route: `/lab/node-detail` (`app/lab/node-detail/page.tsx`). Nothing in the
 * app imports this. Left: pick a task and a node (the task row = whole task).
 * Right: one concept, or all four side by side on the same node, so one edit
 * lands in every skin at once. Keys: 1–4 pick a concept, 0 shows all.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import type { Subtask } from "@/lib/types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { ItemPicker } from "@/components/Lists/item-picker"
import { patchStep } from "@/lib/node-needs"
import { useLab } from "./lab-store"
import { useNode } from "./model"
import { MockDischarge } from "./MockDischarge"
import { MockIndex } from "./MockIndex"
import { MockLace } from "./MockLace"
import { MockArcade } from "./MockArcade"
import "./lab.css"
import "./discharge.css"
import "./index-card.css"
import "./lace.css"
import "./arcade.css"
import { homePixelFaces } from "@/lib/fonts/home-pixel-faces"
import { useStampFontVariables } from "@/lib/fonts/stamp-font-variables"

const CONCEPTS = [
  { id: "discharge", no: "I", name: "Discharge", line: "Gas tubes, nixies, scope trace, bearings, patch bay", C: MockDischarge },
  { id: "index", no: "II", name: "Speed Index", line: "Card catalog drawer, stamps, typewriter keys, cross-reference tree", C: MockIndex },
  { id: "lace", no: "III", name: "Lace Dial", line: "One concentric instrument cut from lace, sheened like nacre", C: MockLace },
  { id: "arcade", no: "IV", name: "Cabinet", line: "Arcade control panel: HUD bars, 7-segment, inventory, quest log", C: MockArcade },
] as const

function StepRows({ steps, depth, pick, sel, tick }: { steps: Subtask[]; depth: number; pick: (id: string) => void; sel: string | null; tick: (s: Subtask) => void }) {
  return (
    <>
      {steps.map((s) => (
        <li key={s.id}>
          <span className={`lab-row${sel === s.id ? " is-sel" : ""}${s.completed ? " is-done" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}>
            <input type="checkbox" checked={s.completed} onChange={() => tick(s)} aria-label={`Done: ${s.description}`} />
            <button type="button" onClick={() => pick(s.id)}>
              {s.description}
            </button>
            {s.tier ? <small className={`lab-tier is-${s.tier}`}>{s.tier === "min" ? "B" : s.tier === "goal" ? "G" : "E"}</small> : null}
          </span>
          {s.subtasks?.length ? (
            <ul>
              <StepRows steps={s.subtasks} depth={depth + 1} pick={pick} sel={sel} tick={tick} />
            </ul>
          ) : null}
        </li>
      ))}
    </>
  )
}

export function NodeDetailLab() {
  const { tasks, mode, dirty, setMode, reset, updateTask, log } = useLab()
  const withSteps = useMemo(() => tasks.filter((t) => t.subtasks?.length), [tasks])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [concept, setConcept] = useState<string>("discharge")
  const [all, setAll] = useState(false)
  const [math, setMath] = useState(false)
  const [clock, setClock] = useState(false)
  const [calm, setCalm] = useState(false)
  useStampFontVariables(homePixelFaces)
  const task = tasks.find((t) => t.id === taskId) ?? withSteps.find((t) => t.id === "lab-task-cds") ?? withSteps[0]
  const n = useNode(task?.id ?? null, stepId)

  useEffect(() => {
    if (task && !taskId) {
      setTaskId(task.id)
      setStepId(task.subtasks?.find((s) => s.subtasks?.length)?.id ?? task.subtasks?.[0]?.id ?? null)
    }
  }, [task, taskId])

  // The house skin restyles every button and field; the studies bring their own.
  useEffect(() => {
    const had = document.body.classList.contains("win95-app")
    document.body.classList.remove("win95-app")
    return () => void (had && document.body.classList.add("win95-app"))
  }, [])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return
      if (e.key >= "1" && e.key <= "4") (setConcept(CONCEPTS[Number(e.key) - 1].id), setAll(false))
      if (e.key === "0") setAll((a) => !a)
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])

  // ▶ clock: one second = one minute spent on the node.
  useEffect(() => {
    if (!clock || !n) return
    const id = setInterval(() => n.act.tick(1), 1000)
    return () => clearInterval(id)
  }, [clock, n])

  const tick = (s: Subtask) => task && updateTask({ ...task, subtasks: patchStep(task.subtasks, s.id, { completed: !s.completed, completedAt: s.completed ? undefined : new Date() }) })
  const shown = all ? CONCEPTS : CONCEPTS.filter((c) => c.id === concept)

  return (
    <div className={`lab ${homePixelFaces}${calm ? " is-calm" : ""}`}>
      <header className="lab-bar">
        <a className="lab-back" href="/" title="Back to the app">
          ← Brain2
        </a>
        <div className="lab-title">
          <b>Node detail lab</b>
          <small>Right bar of the task card · four studies</small>
        </div>
        <nav className="lab-concepts" aria-label="Concept">
          {CONCEPTS.map((c, i) => (
            <button key={c.id} type="button" aria-pressed={!all && concept === c.id} onClick={() => (setConcept(c.id), setAll(false))} title={`${c.line} (key ${i + 1})`}>
              <span>{c.no}</span>
              {c.name}
            </button>
          ))}
          <button type="button" aria-pressed={all} onClick={() => setAll(!all)} title="All four on the same node, live (key 0)">
            <span>∀</span>All four
          </button>
        </nav>
        <div className="lab-switches">
          <label title="Typeset the completion math">
            <input type="checkbox" checked={math} onChange={(e) => setMath(e.target.checked)} /> Show the math
          </label>
          <label title="One second = one minute spent on the picked node">
            <input type="checkbox" checked={clock} onChange={(e) => setClock(e.target.checked)} /> ▶ Clock
          </label>
          <label title="Reduce motion">
            <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} /> Calm
          </label>
          <span className={`lab-mode is-${mode}`} role="group" aria-label="Write mode">
            <button type="button" aria-pressed={mode === "sandbox"} onClick={() => setMode("sandbox")} title="Writes stay in the lab. Follows the real store until you edit.">
              Sandbox
            </button>
            <button type="button" aria-pressed={mode === "live"} onClick={() => (window.confirm("Live writes change your real tasks. Continue?") ? setMode("live") : null)} title="Writes go to your real tasks">
              Live
            </button>
          </span>
          {mode === "sandbox" ? (
            <button type="button" className="lab-reset" disabled={!dirty} onClick={reset} title="Drop lab edits and copy the real store again">
              {dirty ? "↺ Reset copy" : "● following live"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="lab-body">
        <aside className="lab-tree" aria-label="Pick a node">
          <div className="lab-task-pick">
            <span>Task</span>
            <ItemPicker
              compact
              mode="single"
              searchLabel="Task"
              choices={withSteps.map((t) => ({ id: t.id, title: itemTitleOrUntitled(t), icon: t.icon }))}
              selected={task?.id ? [task.id] : []}
              onChange={(ids) => {
                setTaskId(ids[0] ?? "")
                setStepId(null)
              }}
            />
          </div>
          {task ? (
            <ul>
              <li>
                <span className={`lab-row is-root${stepId === null ? " is-sel" : ""}`}>
                  <button type="button" onClick={() => setStepId(null)}>
                    ◎ {itemTitleOrUntitled(task)} <small>whole task</small>
                  </button>
                </span>
                <ul>
                  <StepRows steps={task.subtasks ?? []} depth={1} pick={setStepId} sel={stepId} tick={tick} />
                </ul>
              </li>
            </ul>
          ) : (
            <p>No task with steps.</p>
          )}
          <ol className="lab-log" aria-label="What changed">
            {log
              .slice()
              .reverse()
              .map((l) => (
                <li key={l.at}>{l.text}</li>
              ))}
          </ol>
        </aside>

        <main className={`lab-stage${all ? " is-all" : ""}`}>
          {n
            ? shown.map((c) => (
                <figure key={c.id} className={`lab-frame is-${c.id}`}>
                  <figcaption>
                    <b>
                      {c.no} · {c.name}
                    </b>
                    <span>{c.line}</span>
                  </figcaption>
                  <div className="lab-slot">
                    <c.C n={n} showMath={math} />
                  </div>
                </figure>
              ))
            : null}
        </main>
      </div>
    </div>
  )
}
