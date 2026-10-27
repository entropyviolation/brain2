"use client"

/**
 * Drafts, Parked, and Done shelves.
 */
import { useState, type ReactNode } from "react"
import type { Task } from "@/lib/types"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { allLines, lineIsDone, lineLabel, type SessionPlan } from "@/lib/session-plan"
import { fmtMinutes } from "./format"
import { TIER_LABEL } from "./tiers"

function sessionStamp(plan: SessionPlan): string {
  return plan.endedAt ?? plan.parkedAt ?? plan.startedAt ?? plan.createdAt
}

function ShelfRow({ plan, tasks, children }: { plan: SessionPlan; tasks: Task[]; children: ReactNode }) {
  const lines = allLines(plan)
  const done = lines.filter(({ line }) => lineIsDone(line, tasks)).length
  const when = new Date(sessionStamp(plan)).toLocaleDateString([], { month: "short", day: "numeric" })
  return (
    <li className="todo-session-shelfrow">
      <span className="todo-session-shelfname">{plan.title || "Session"}</span>
      <span className="todo-session-mins">
        {when} · {fmtMinutes(plan.durationMin)} · {done}/{lines.length} lines
        {plan.phase === "done" && plan.reachedTier ? ` · ${plan.reachedTier === "none" ? "no tier" : TIER_LABEL[plan.reachedTier]}` : ""}
        {plan.phase === "run" ? " · running" : plan.phase === "review" ? " · in review" : ""}
      </span>
      <span className="todo-session-shelfkeys">{children}</span>
    </li>
  )
}

function ShelvesView({
  open,
  history,
  tasks,
  onOpen,
  onOpenDone,
  onRunAgain,
  onNew,
}: {
  open: SessionPlan[]
  history: SessionPlan[]
  tasks: Task[]
  onOpen: (id: string) => void
  onOpenDone: (id: string) => void
  onRunAgain: (plan: SessionPlan) => void
  onNew: () => void
}) {
  const remove = useSessionPlanStore((s) => s.remove)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const match = (plan: SessionPlan) =>
    !needle ||
    plan.title.toLowerCase().includes(needle) ||
    (plan.note ?? "").toLowerCase().includes(needle) ||
    allLines(plan).some(({ line }) => lineLabel(line, tasks).toLowerCase().includes(needle))
  const newest = (a: SessionPlan, b: SessionPlan) => sessionStamp(b).localeCompare(sessionStamp(a))
  const drafts = open.filter((p) => p.phase === "draft" && match(p)).sort(newest)
  const parked = open.filter((p) => p.phase !== "draft" && match(p)).sort(newest)
  const done = history.filter(match).sort(newest)
  const shelf = (label: string, count: number, body: ReactNode) => (
    <section className="todo-session-shelf" aria-label={label}>
      <h3 className="todo-session-shelf-head">
        {label} <span className="todo-session-mins">{count}</span>
      </h3>
      <ul className="todo-session-shelflist">{count ? body : <li className="todo-session-empty">None.</li>}</ul>
    </section>
  )
  return (
    <div className="todo-session-shelves">
      <div className="todo-session-pick-bar">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="todo-btn" onClick={onNew}>
          New session
        </button>
      </div>
      {shelf(
        "Drafts",
        drafts.length,
        drafts.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb is-quiet" aria-label={`Delete draft ${p.title}`} onClick={() => remove(p.id)}>
              Delete
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Parked",
        parked.length,
        parked.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              {p.phase === "parked" ? "Open" : "Show"}
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Done",
        done.length,
        done.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpenDone(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb" onClick={() => onRunAgain(p)}>
              Run again
            </button>
          </ShelfRow>
        )),
      )}
    </div>
  )
}

export { ShelvesView }
