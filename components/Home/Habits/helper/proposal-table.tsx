/**
 * components/Home/Habits/helper/proposal-table.tsx — One BIMBY line's proposals, as rows to approve
 *
 * Each row: the habit, the day, old → new, and the words it came from. The new value, a miss reason and a
 * shorthand name are editable before Accept. A clause two habits fit shows one key per habit; picking one
 * computes its row. Accept writes that row; Accept all writes every open row. Decided rows stay, greyed.
 */
"use client"

import { useState } from "react"
import { openAsks, openProposals, useHabitsBimby, type BimbyLine } from "@/lib/habit-helper/store"
import type { Proposal } from "@/lib/habit-helper/types"

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

function Editable({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <button type="button" className="hh-inline" data-no95="" title={`Edit ${label}`} onClick={() => setDraft(value)}>
        {value}
      </button>
    )
  }
  const done = (keep: boolean) => {
    if (keep && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return <input className="hh-inline-input" aria-label={label} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false) }} />
}

/** The part of a proposal the person may retype: the value, the reason, or the name. */
function editValue(p: Proposal): { value: string; label: string } {
  if (p.kind === "shorthand") return { value: p.to, label: "shorthand name" }
  if (p.kind === "missed" || p.kind === "reason") return { value: p.write?.missReason ?? "", label: "reason" }
  if (p.write?.text !== undefined) return { value: p.write.text, label: "note" }
  return { value: p.write?.value !== undefined ? String(p.write.value) : p.to, label: "value" }
}

export function ProposalTable({ line, onReasons }: { line: BimbyLine; onReasons: (habitId: string) => void }) {
  const accept = useHabitsBimby((s) => s.accept)
  const dismiss = useHabitsBimby((s) => s.dismiss)
  const edit = useHabitsBimby((s) => s.edit)
  const choose = useHabitsBimby((s) => s.choose)
  const [said, setSaid] = useState("")
  const proposals = line.proposals ?? []
  const asks = openAsks(line)
  if (!proposals.length && !asks.length) return null
  const open = openProposals(line)

  return (
    <div className="hh-board">
      {asks.map((a) => (
        <div key={a.id} className="hh-ask">
          <span>“{a.words}” is which habit?</span>
          {a.options.map((o) => (
            <button key={o.id} type="button" className="hh-cap" data-no95="" onClick={() => choose(line.id, a.id, o.id)}>{o.name}</button>
          ))}
        </div>
      ))}
      {proposals.length ? (
        <table className="hh-table">
          <thead>
            <tr>
              <th>Habit</th>
              <th>Day</th>
              <th>Old → new</th>
              <th>From your words</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => {
              const state = line.decided?.[p.id]
              const ed = editValue(p)
              return (
                <tr key={p.id} className="hh-row" data-state={state ?? "open"} data-kind={p.kind}>
                  <td>
                    <button type="button" className="hh-link" data-no95="" title="Reasons recorded for this habit" onClick={() => onReasons(p.habitId)}>{p.habit}</button>
                  </td>
                  <td>{p.day ? dayLabel(p.day) : "—"}</td>
                  <td>
                    <span className="hh-from">{p.from}</span> →{" "}
                    {p.kind === "missed" ? <b className="hh-to">missed</b> : null}
                    {state ? <b className="hh-to">{p.kind === "missed" ? "" : p.kind === "reason" ? p.write?.missReason : p.to}</b> : <Editable value={ed.value} label={ed.label} onCommit={(v) => edit(line.id, p.id, v)} />}
                    {p.why ? <small className="hh-why">{p.why}</small> : null}
                  </td>
                  <td className="hh-words">“{p.words}”</td>
                  <td className="hh-act">
                    {state ? (
                      <span className="hh-state">{state}</span>
                    ) : (
                      <>
                        <button type="button" className="hh-cap hh-go" data-no95="" onClick={() => setSaid(accept(line.id, [p.id]))}>Accept</button>
                        <button type="button" className="hh-cap" data-no95="" aria-label={`Dismiss ${p.habit}`} onClick={() => dismiss(line.id, p.id)}>×</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
      {open.length > 1 ? (
        <div className="hh-foot">
          <button type="button" className="hh-cap hh-go" data-no95="" onClick={() => setSaid(accept(line.id))}>Accept all {open.length}</button>
        </div>
      ) : null}
      {said ? <p className="hh-said" role="status">{said}</p> : null}
    </div>
  )
}
