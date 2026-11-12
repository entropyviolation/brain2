/**
 * components/Bim/day-card.tsx — The day plan BIM and you work out together
 *
 * Shared by the desktop console and the phone terminal, under a chat line that has `dayId`. One row per
 * thing: its weight (must / important / if time), a time estimate that says where it came from, where it
 * falls on the clock, and a fold with the reasons (why, what happens if not, resistance, what is in the
 * way). Every field is editable. File puts the rows on To Do today and in follow-through; Start hands them
 * to the Plan BIMBY's run list, drawn here once it is running. Logic: `lib/plan-bimby/day/`.
 */
"use client"

import { lazy, Suspense, useEffect, useState } from "react"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { fileDay, rejectDay, startDayRun } from "@/lib/plan-bimby/day/apply"
import { span } from "@/lib/plan-bimby/day/estimate"
import { reviseDay } from "@/lib/plan-bimby/day/run"
import { hhmm, layout } from "@/lib/plan-bimby/day/schedule"
import { useDayPlanStore } from "@/lib/plan-bimby/day/store"
import { dayItemId, TIER_LABEL, type DayItem, type DayPlan, type DayTier } from "@/lib/plan-bimby/day/types"
import { usePlanRunStore } from "@/lib/plan-bimby/store"
import "./report-card.css"
import "./day-card.css"

const RunView = lazy(() => import("@/components/Lab/PlanBimby/PlanBimbyPanel").then((mod) => ({ default: mod.RunView })))

const SOURCE_LABEL: Record<DayItem["estimate"]["source"], string> = { you: "yours", said: "you said", history: "your history", model: "model guess", rule: "rule of thumb", default: "unknown" }
const LEVELS = ["none", "low", "medium", "high", "very high"]

function useMinute(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function ItemRow({ plan, item, at, clock, over, locked }: { plan: DayPlan; item: DayItem; at: number; clock: string; over: boolean; locked: boolean }) {
  const patchItem = useDayPlanStore((s) => s.patchItem)
  const patch = useDayPlanStore((s) => s.patch)
  const set = (p: Partial<DayItem>) => patchItem(plan.id, item.id, p)
  const move = (by: number) =>
    patch(plan.id, (pl) => {
      const items = [...pl.items]
      const to = at + by
      if (to < 0 || to >= items.length) return pl
      ;[items[at], items[to]] = [items[to]!, items[at]!]
      return { ...pl, items }
    })
  const id = `${plan.id}-${item.id}`
  const done = !!item.doneAt
  const off = locked || done
  const reasons = [item.why, item.ifNot, item.blocker].filter((s) => s.trim()).length + (item.resistance !== undefined ? 1 : 0)
  return (
    <article className={`rc-effect dc-item${done ? " is-applied" : ""}${over && !done ? " is-over" : ""}`} data-tier={item.tier}>
      <header>
        <select aria-label={`Weight of ${item.title}`} className="dc-tier" value={item.tier} disabled={off} onChange={(e) => set({ tier: e.target.value as DayTier })}>
          {(Object.keys(TIER_LABEL) as DayTier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </select>
        <input aria-label="Task" className="dc-title" value={item.title} disabled={off} onChange={(e) => set({ title: e.target.value })} />
        <span className="rc-status">{done ? `DONE${item.actualMin ? ` · ${span(item.actualMin)}` : ""}` : item.filedTaskId ? "ON TO DO" : over ? "PAST THE END" : item.urgent ? "URGENT" : ""}</span>
      </header>
      <div className="dc-time">
        <label htmlFor={`${id}-min`}>
          <input id={`${id}-min`} type="number" min={1} max={600} value={item.estimate.minutes} disabled={off} onChange={(e) => set({ estimate: { minutes: Math.max(1, Math.round(Number(e.target.value) || 1)), source: "you", basis: "You set it." } })} />
          <span>min</span>
        </label>
        <span className="dc-source" data-source={item.estimate.source}>{SOURCE_LABEL[item.estimate.source]}</span>
        {clock ? <span className="dc-clock">{clock}</span> : null}
      </div>
      <p className="dc-basis">{item.estimate.basis}</p>
      {item.subtasks.length || item.note ? <p className="dc-basis">{item.subtasks.length ? `Steps: ${item.subtasks.join(", ")}. ` : ""}{item.note ? `Note: ${item.note}` : ""}</p> : null}
      <details>
        <summary>reasons ({reasons}/4){item.guess && !item.why.trim() ? " · BIM has a guess" : ""}</summary>
        <ul className="rc-why">{item.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <div className="dc-reasons">
          <label htmlFor={`${id}-why`}>
            <span>Why it matters today</span>
            <textarea id={`${id}-why`} value={item.why} disabled={off} placeholder={item.guess?.why ? `BIM's guess: ${item.guess.why}` : "in your words"} onChange={(e) => set({ why: e.target.value })} />
          </label>
          {item.guess?.why && !item.why.trim() && !off ? <button type="button" data-no95 onClick={() => set({ why: item.guess!.why! })}>Keep the guess</button> : null}
          <label htmlFor={`${id}-ifnot`}>
            <span>If it is not done</span>
            <textarea id={`${id}-ifnot`} value={item.ifNot} disabled={off} placeholder={item.guess?.ifNot ? `BIM's guess: ${item.guess.ifNot}` : "what happens"} onChange={(e) => set({ ifNot: e.target.value })} />
          </label>
          {item.guess?.ifNot && !item.ifNot.trim() && !off ? <button type="button" data-no95 onClick={() => set({ ifNot: item.guess!.ifNot! })}>Keep the guess</button> : null}
          <label htmlFor={`${id}-res`}>
            <span>Resistance</span>
            <select id={`${id}-res`} value={item.resistance === undefined ? "" : String(item.resistance)} disabled={off} onChange={(e) => set({ resistance: e.target.value === "" ? undefined : Number(e.target.value) })}>
              <option value="">not said</option>
              {LEVELS.map((l, n) => <option key={l} value={n}>{n} {l}</option>)}
            </select>
          </label>
          <label htmlFor={`${id}-block`}>
            <span>What is in the way</span>
            <input id={`${id}-block`} type="text" value={item.blocker} disabled={off} onChange={(e) => set({ blocker: e.target.value })} />
          </label>
          <label htmlFor={`${id}-steps`}>
            <span>Steps, comma separated</span>
            <input id={`${id}-steps`} type="text" defaultValue={item.subtasks.join(", ")} disabled={off} onBlur={(e) => set({ subtasks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </label>
          {item.taskId && !item.filedTaskId ? (
            <label className="dc-check" htmlFor={`${id}-task`}>
              <input id={`${id}-task`} type="checkbox" checked={!!item.useTask} disabled={off} onChange={(e) => set({ useTask: e.target.checked })} />
              <span>Use the task you already have: “{item.taskTitle}”</span>
            </label>
          ) : null}
        </div>
      </details>
      {off ? null : (
        <div className="rc-actions dc-moves">
          <button type="button" data-no95 aria-label={`Move ${item.title} up`} disabled={at === 0} onClick={() => move(-1)}>↑</button>
          <button type="button" data-no95 aria-label={`Move ${item.title} down`} disabled={at === plan.items.length - 1} onClick={() => move(1)}>↓</button>
          {item.filedTaskId ? null : <button type="button" data-no95 aria-label={`Remove ${item.title}`} onClick={() => patch(plan.id, (pl) => ({ ...pl, items: pl.items.filter((i) => i.id !== item.id) }))}>Remove</button>}
        </div>
      )}
    </article>
  )
}

export function DayCard({ dayId, lineId }: { dayId: string; lineId: string }) {
  const plan = useDayPlanStore((s) => s.plans[dayId])
  const patch = useDayPlanStore((s) => s.patch)
  // The same plan can sit under several chat lines; only the newest one is the live card.
  const newest = useBimChatStore((s) => {
    for (let i = s.lines.length - 1; i >= 0; i--) if (s.lines[i]!.dayId === dayId) return s.lines[i]!.id
    return lineId
  })
  const run = usePlanRunStore((s) => s.run)
  const now = useMinute()
  const [tweak, setTweak] = useState("")
  const [said, setSaid] = useState<{ text: string; bad?: boolean } | null>(null)
  if (!plan) return <p className="rc-gone">This plan is no longer kept on this device.</p>
  if (newest !== lineId) return <p className="rc-gone">The plan card continues under a newer line below.</p>
  const lay = layout(plan, now)
  const rows = new Map(lay.rows.map((r) => [r.id, r]))
  const locked = !!plan.rejected
  const running = !!run && run.id === plan.runId
  const unfiled = plan.items.filter((i) => !i.filedTaskId && !i.doneAt && i.title.trim()).length
  const act = (result: { ok: boolean; message: string }) => setSaid({ text: result.message, bad: !result.ok })
  return (
    <section className={`rc dc${locked ? " is-rejected" : ""}`} aria-label="Your plan for the rest of today">
      <header className="dc-head">
        <b>REST OF TODAY</b>
        <label htmlFor={`${plan.id}-until`}>
          <span>day ends</span>
          <input id={`${plan.id}-until`} type="time" value={plan.until} disabled={locked} onChange={(e) => e.target.value && patch(plan.id, (p) => ({ ...p, until: e.target.value }))} />
        </label>
      </header>
      <p className={`dc-fit${lay.need > lay.left ? " is-bad" : ""}`}>{lay.lines.join(" ")}</p>
      {plan.thinking ? <div className="rc-bar" role="progressbar" aria-label="A model is working on time guesses and reasons" aria-busy="true"><i /></div> : null}
      <details className="rc-trace">
        <summary>how I read it ({plan.trace.length} steps){plan.revisions ? ` · changed ${plan.revisions}×` : ""}</summary>
        <ol>{plan.trace.map((t, i) => <li key={i}>{t}</li>)}</ol>
        {plan.remarks.length ? <p>Heard but not a task: {plan.remarks.join(" · ")}</p> : null}
      </details>
      {plan.items.map((item, at) => {
        const row = rows.get(item.id)
        return <ItemRow key={item.id} plan={plan} item={item} at={at} clock={row ? `${hhmm(row.start)}–${hhmm(row.end)}` : ""} over={!!row?.over} locked={locked} />
      })}
      {locked ? (
        <div className="rc-actions"><button type="button" data-no95 onClick={() => patch(plan.id, (p) => ({ ...p, rejected: false }))}>Reconsider</button></div>
      ) : (
        <>
          <div className="rc-actions">
            <button type="button" data-no95 onClick={() => patch(plan.id, (p) => ({ ...p, items: [...p.items, { id: dayItemId(), title: "", said: "", tier: "rest", urgent: false, subtasks: [], estimate: { minutes: 30, source: "default", basis: "Nothing to go on yet, so 30 min. Change it." }, why: "", ifNot: "", blocker: "", reasons: ["You added it."] }] }))}>+ thing</button>
          </div>
          <div className="rc-actions rc-all">
            <button type="button" data-no95 className="rc-accept" disabled={!plan.items.some((i) => i.title.trim())} onClick={() => act(fileDay(plan.id))}>{plan.filed ? (unfiled ? `Update To Do (+${unfiled})` : "Update To Do") : "Put on To Do today"}</button>
            {running ? null : <button type="button" data-no95 disabled={!plan.items.some((i) => i.title.trim() && !i.doneAt)} onClick={() => act(startDayRun(plan.id))}>{plan.filed ? "Start in Plan BIMBY" : "File and start"}</button>}
            {plan.filed ? null : <button type="button" data-no95 onClick={() => rejectDay(plan.id)}>Reject</button>}
          </div>
        </>
      )}
      {said ? <p className={`rc-result${said.bad ? " is-bad" : ""}`}>{said.text}</p> : null}
      {running ? (
        <div className="dc-run">
          <Suspense fallback={<p>Loading the run list…</p>}><RunView /></Suspense>
        </div>
      ) : null}
      {locked ? null : (
        <form
          className="rc-tweak"
          onSubmit={(e) => {
            e.preventDefault()
            if (!tweak.trim()) return
            const out = reviseDay(plan.id, tweak)
            setSaid(out === null ? { text: "I could not read a change in that. Try “pack will take 2 hours”, “drop shave legs”, “plan ny is a must”, “foxtide first”, or edit the row.", bad: true } : { text: out })
            if (out !== null) setTweak("")
          }}
        >
          <label htmlFor={`${plan.id}-tweak`} className="rc-rev">Say a change</label>
          <textarea id={`${plan.id}-tweak`} value={tweak} onChange={(e) => setTweak(e.target.value)} placeholder="pack will take 2 hours · drop shave legs · also call mom · until 11pm" />
          <div className="rc-actions"><button type="submit" data-no95 disabled={!tweak.trim()}>Change plan</button></div>
        </form>
      )}
    </section>
  )
}
