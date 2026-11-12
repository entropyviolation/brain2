/**
 * components/Home/Habits/helper/proposal-table.tsx — One BIMBY line's proposals, as rows to approve
 *
 * Each row: the habit, the day, old → new, and the words it came from. The new value, a miss reason and a
 * shorthand name are editable before Accept. A clause two habits fit shows one key per habit; picking one
 * computes its row; "Other" searches every daily habit. Every part of a row is editable before Accept: habit, day,
 * done/undone, amount, note, reason, start and end time. Accept writes that row; Accept all writes every open row. Decided rows stay, greyed.
 */
"use client"

import { useMemo, useState } from "react"
import { NEUTRAL_HINT, NEUTRAL_LABEL } from "@/lib/accept-grade"
import { buildContext } from "@/lib/habit-helper/accept"
import { displayName } from "@/lib/habit-helper/words"
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

const toTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : undefined
}

/** "Other": search every daily habit and pick one. */
function OtherPicker({ habits, onPick }: { habits: { id: string; name: string }[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState("")
  const hits = habits.filter((h) => h.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
  return (
    <span className="hh-other">
      <input className="hh-inline-input" aria-label="Search habits" placeholder="Search habits…" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.map((h) => (
        <button key={h.id} type="button" className="hh-cap" data-no95="" onClick={() => onPick(h.id)}>{h.name}</button>
      ))}
      {!hits.length ? <small className="hh-why">No habit by that name.</small> : null}
    </span>
  )
}

/** The part of a proposal the person may retype: the value, the reason, or the name. */
function editValue(p: Proposal): { value: string; label: string } {
  if (p.kind === "shorthand") return { value: p.to, label: "shorthand name" }
  if (p.kind === "missed" || p.kind === "reason") return { value: p.write?.missReason ?? "", label: "reason" }
  if (p.write?.text !== undefined) return { value: p.write.text, label: "note" }
  return { value: p.write?.value !== undefined ? String(p.write.value) : p.to, label: "value" }
}

/** The editable "new" part of a row, by what the row writes. */
function Value({ p, state, habits, lineId }: { p: Proposal; state?: string; habits: { id: string; kind: string }[]; lineId: string }) {
  const revise = useHabitsBimby((s) => s.revise)
  const edit = useHabitsBimby((s) => s.edit)
  if (p.kind === "rule") return <b className="hh-to">{p.to}</b>
  if (state) return <b className="hh-to">{p.kind === "missed" ? "missed" : p.kind === "reason" ? p.write?.missReason : p.to}</b>
  const kind = habits.find((h) => h.id === p.habitId)?.kind
  if (p.kind === "missed") {
    return (
      <>
        <b className="hh-to">missed</b> because <Editable value={p.write?.missReason ?? ""} label="reason" onCommit={(v) => revise(lineId, p.id, { reason: v })} />
      </>
    )
  }
  if (p.kind === "shorthand" || p.kind === "reason" || p.write?.text !== undefined) {
    const ed = editValue(p)
    return <Editable value={ed.value} label={ed.label} onCommit={(v) => edit(lineId, p.id, v)} />
  }
  return (
    <>
      {p.write?.completed !== undefined || kind === "yesno" ? (
        <select className="hh-inline-input" aria-label="State" value={p.write?.completed === false ? "undone" : "done"} onChange={(e) => revise(lineId, p.id, { done: e.target.value === "done" })}>
          <option value="done">done</option>
          <option value="undone">undone</option>
        </select>
      ) : (
        <Editable value={p.write?.value !== undefined ? String(p.write.value) : p.to} label="value" onCommit={(v) => { const n = Number(v.replace(/[^\d.]/g, "")); if (v.trim() && Number.isFinite(n)) revise(lineId, p.id, { value: n }) }} />
      )}
      {p.write?.value !== undefined ? <span className="hh-unit"> {p.to.replace(/^[\d.]+\s*/, "")}</span> : null}
      {p.span ? (
        <span className="hh-times">
          <input type="time" className="hh-inline-input" aria-label="Start time" value={toTime(p.span.startMin)} onChange={(e) => revise(lineId, p.id, { startMin: fromTime(e.target.value) })} />
          –
          <input type="time" className="hh-inline-input" aria-label="End time" value={toTime(p.span.endMin)} onChange={(e) => revise(lineId, p.id, { endMin: fromTime(e.target.value) })} />
        </span>
      ) : null}
    </>
  )
}

export function ProposalTable({ line, onReasons }: { line: BimbyLine; onReasons: (habitId: string) => void }) {
  const accept = useHabitsBimby((s) => s.accept)
  const dismiss = useHabitsBimby((s) => s.dismiss)
  const choose = useHabitsBimby((s) => s.choose)
  const revise = useHabitsBimby((s) => s.revise)
  const [said, setSaid] = useState("")
  const [other, setOther] = useState<string | null>(null)
  const habits = useMemo(() => buildContext().habits.map((h) => ({ id: h.id, name: displayName(h), kind: h.kind, unit: h.unit })), [line.proposals, line.asks])
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
          {other === a.id ? (
            <OtherPicker habits={habits} onPick={(id) => { setOther(null); choose(line.id, a.id, id) }} />
          ) : (
            <button type="button" className="hh-cap" data-no95="" onClick={() => setOther(a.id)}>Other…</button>
          )}
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
              return (
                <tr key={p.id} className="hh-row" data-state={state ?? "open"} data-kind={p.kind}>
                  <td>
                    {state || p.kind === "shorthand" ? (
                      <button type="button" className="hh-link" data-no95="" title="Reasons recorded for this habit" onClick={() => onReasons(p.habitId)}>{p.habit}</button>
                    ) : (
                      <select className="hh-inline-input" aria-label="Habit" value={p.habitId} onChange={(e) => revise(line.id, p.id, { habitId: e.target.value })}>
                        {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {state || !p.day ? (
                      p.day ? dayLabel(p.day) : "—"
                    ) : (
                      <input type="date" className="hh-inline-input" aria-label="Day" value={p.day} onChange={(e) => e.target.value && revise(line.id, p.id, { day: e.target.value })} />
                    )}
                  </td>
                  <td>
                    <span className="hh-from">{p.from}</span> →{" "}
                    <Value p={p} state={state} habits={habits} lineId={line.id} />
                    {p.needs && !state ? <small className="hh-needs">{p.needs}</small> : null}
                    {p.why ? <small className="hh-why">{p.why}</small> : null}
                  </td>
                  <td className="hh-words">“{p.words}”</td>
                  <td className="hh-act">
                    {state ? (
                      <span className="hh-state">{state}{line.grades?.[p.id] === "ok" ? " · neutral" : ""}</span>
                    ) : (
                      <>
                        <button type="button" className="hh-cap hh-go" data-no95="" onClick={() => setSaid(accept(line.id, [p.id]))}>Accept</button>
                        <button type="button" className="hh-cap" data-no95="" title={NEUTRAL_HINT} onClick={() => setSaid(accept(line.id, [p.id], "ok"))}>{NEUTRAL_LABEL}</button>
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
          <button type="button" className="hh-cap" data-no95="" title={NEUTRAL_HINT} onClick={() => setSaid(accept(line.id, undefined, "ok"))}>{NEUTRAL_LABEL} all</button>
        </div>
      ) : null}
      {said ? <p className="hh-said" role="status">{said}</p> : null}
    </div>
  )
}
