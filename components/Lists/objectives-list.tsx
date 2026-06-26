/**
 * components/Lists/objectives-list.tsx — Objectives in the Lists panel
 *
 * Mirrors goals-store objectives (same data as Home → Goals). View, edit, and
 * append objectives from Home or All in Lists.
 */
"use client"

import { useMemo, useState } from "react"
import { useGoalsStore } from "@/lib/goals-store"
import type { Objective } from "@/lib/types"
import { ObjectiveDetailDialog } from "@/components/Home/Goals/ObjectiveDetailDialog"
import { periodKeyFor } from "@/lib/objectives"

function activePriorityCount(objective: Objective): number {
  return (objective.priorities ?? []).filter((p) => p.periodKey === periodKeyFor(p.period)).length
}

export function ObjectivesList() {
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const addObjective = useGoalsStore((s) => s.addObjective)

  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const active = useMemo(() => objectives.filter((o) => !o.archived), [objectives])
  const archived = useMemo(() => objectives.filter((o) => o.archived), [objectives])
  const goalCount = (id: string) => goals.filter((g) => g.objectiveIds.includes(id)).length

  const handleAdd = () => {
    const title = newTitle.trim()
    if (!title) return
    addObjective({ title, description: newDesc.trim() || undefined })
    setNewTitle("")
    setNewDesc("")
  }

  const renderRow = (objective: Objective) => {
    const prio = activePriorityCount(objective)
    return (
      <div
        key={objective.id}
        className="fm-link-row"
        style={{ cursor: "pointer" }}
        onClick={() => setOpenId(objective.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpenId(objective.id)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="fm-link-text" style={{ flex: 1 }}>
          {objective.title}
          {objective.description ? (
            <span style={{ display: "block", fontSize: 10, opacity: 0.75, marginTop: 2 }}>{objective.description}</span>
          ) : null}
        </span>
        <span className="fm-icon-badge" title="Linked goals">
          {goalCount(objective.id)} goals
        </span>
        {prio > 0 && (
          <span className="fm-icon-badge" title="Active priorities" style={{ marginLeft: 4 }}>
            ★ {prio}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="fm-sunken" style={{ padding: 0 }}>
      <div className="fm-quickadd" style={{ margin: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong>Life directions</strong>
          <span style={{ fontSize: 11 }}>
            {active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ""}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <input
            className="fm-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New objective title…"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
          />
          <input
            className="fm-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
          />
          <button className="fm-btn fm-btn-sm" onClick={handleAdd} disabled={!newTitle.trim()}>
            + Add Objective
          </button>
        </div>
      </div>

      <div className="fm-linklist" style={{ paddingTop: 0 }}>
        {active.length === 0 && archived.length === 0 && (
          <div className="fm-empty">
            <p>No objectives yet. Add your first life direction above.</p>
          </div>
        )}
        {active.map(renderRow)}
        {archived.length > 0 && (
          <>
            <div className="fm-search-group-label" style={{ padding: "8px 8px 4px" }}>
              Archived
            </div>
            {archived.map(renderRow)}
          </>
        )}
      </div>

      {openId && <ObjectiveDetailDialog objectiveId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
