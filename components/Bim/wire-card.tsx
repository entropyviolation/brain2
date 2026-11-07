/**
 * components/Bim/wire-card.tsx — The plan BIM proposes for wiring a module or a habit's detail view
 *
 * Shared by the desktop console and the phone terminal. One block per step: why, the fields (a
 * habit, a module, what it counts, what it is about), the checks it passed or failed against your
 * real habits and a sample report, and Accept / Reject. A step whose checks fail cannot be
 * accepted. Under the steps, a box to tweak: say what to change and the plan is rebuilt in place.
 * Nothing is saved until Accept.
 */
"use client"

import { useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { checkStep, stepPasses } from "@/lib/wire-bimby/checks"
import { acceptAllSteps, acceptStep, reconsiderStep, rejectAllSteps, rejectStep, reviseWire } from "@/lib/wire-bimby/decide"
import { useWireStore } from "@/lib/wire-bimby/store"
import type { WireField, WireStep } from "@/lib/wire-bimby/types"
import "./report-card.css"

const KIND_LABEL: Record<WireStep["kind"], string> = { feed: "CONNECT", breakdown: "BREAKDOWN", entry: "ENTRY", track: "TRACK" }
const STATUS_LABEL: Record<WireStep["status"], string> = { pending: "WAITING", applied: "SAVED", rejected: "REJECTED", failed: "FAILED" }

function Field({ planId, stepId, field, locked }: { planId: string; stepId: string; field: WireField; locked: boolean }) {
  const setField = useWireStore((s) => s.setField)
  const id = `${stepId}-${field.key}`
  return (
    <label className="rc-field" htmlFor={id}>
      <span>{field.label}</span>
      {field.free ? (
        <input id={id} type="text" value={field.value} disabled={locked} onChange={(e) => setField(planId, stepId, field.key, e.target.value)} />
      ) : (
      <select id={id} value={field.value} disabled={locked} onChange={(e) => setField(planId, stepId, field.key, e.target.value)}>
        {field.options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      )}
    </label>
  )
}

function StepBlock({ planId, step }: { planId: string; step: WireStep }) {
  const habits = useHabitsStore((s) => s.tasks)
  const types = useItemTypeStore((s) => s.types)
  const locked = step.status === "applied" || step.status === "rejected"
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const pens = (scopes.find((s) => s.id === "activity")?.pens ?? []).map((p) => ({ id: p.id, name: p.name, parentIds: p.parentIds ?? (p.parentId ? [p.parentId] : []), feedModule: p.moduleFeed?.moduleId }))
  const checks = checkStep(step, { habits, pens, types: types.map((t) => ({ id: t.id, name: t.name, pluralName: t.pluralName })) })
  const passes = stepPasses(checks)
  return (
    <article className={`rc-effect is-${step.status}`} data-kind={step.kind}>
      <header>
        <span className="rc-kind">{KIND_LABEL[step.kind]}</span>
        <b>{step.title}</b>
        <span className="rc-status">{STATUS_LABEL[step.status]}</span>
      </header>
      <details open={step.status === "pending"}>
        <summary>why ({step.reasoning.length}) · checks ({checks.filter((c) => c.ok).length}/{checks.length})</summary>
        <ul className="rc-why">{step.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </details>
      <div className="rc-fields">
        {step.fields.map((f) => <Field key={f.key} planId={planId} stepId={step.id} field={f} locked={locked} />)}
      </div>
      <ul className="rc-checks" aria-label="Checks">
        {checks.map((c, i) => <li key={i} className={c.ok ? "" : "is-bad"}>{c.text}</li>)}
      </ul>
      {step.result ? <p className={`rc-result${step.status === "failed" ? " is-bad" : ""}`}>{step.result}{step.status === "applied" ? " Send undo to reverse it." : ""}</p> : null}
      <div className="rc-actions">
        {step.status === "pending" || step.status === "failed" ? (
          <>
            <button type="button" data-no95 className="rc-accept" disabled={!passes} onClick={() => acceptStep(planId, step.id)}>{step.status === "failed" ? "Try again" : "Accept"}</button>
            <button type="button" data-no95 onClick={() => rejectStep(planId, step.id)}>Reject</button>
          </>
        ) : null}
        {step.status === "rejected" ? <button type="button" data-no95 onClick={() => reconsiderStep(planId, step.id)}>Reconsider</button> : null}
      </div>
    </article>
  )
}

export function WireCard({ wireId }: { wireId: string }) {
  const plan = useWireStore((s) => s.plans[wireId])
  const [tweak, setTweak] = useState("")
  const [miss, setMiss] = useState("")
  if (!plan) return <p className="rc-gone">This plan is no longer kept on this device.</p>
  const pending = plan.steps.filter((s) => s.status === "pending").length
  return (
    <section className="rc" aria-label="BIM's plan for wiring your habits">
      <details className="rc-trace" open>
        <summary>how I read it ({plan.trace.length} steps){plan.revisions ? ` · changed ${plan.revisions}×` : ""}</summary>
        <ol>{plan.trace.map((t, i) => <li key={i}>{t}</li>)}</ol>
      </details>
      {plan.steps.map((s) => <StepBlock key={s.id} planId={plan.id} step={s} />)}
      {pending > 1 ? (
        <div className="rc-actions rc-all">
          <button type="button" data-no95 className="rc-accept" onClick={() => acceptAllSteps(plan.id)}>Accept all {pending}</button>
          <button type="button" data-no95 onClick={() => rejectAllSteps(plan.id)}>Reject all</button>
        </div>
      ) : null}
      <form
        className="rc-tweak"
        onSubmit={(e) => {
          e.preventDefault()
          if (!tweak.trim()) return
          const ok = reviseWire(plan.id, tweak)
          setMiss(ok ? "" : "I could not build a plan from that change. The current plan is unchanged.")
          if (ok) setTweak("")
        }}
      >
        <label htmlFor={`${plan.id}-tweak`} className="rc-rev">Tweak or retry: say what to change</label>
        <textarea id={`${plan.id}-tweak`} value={tweak} onChange={(e) => setTweak(e.target.value)} placeholder="also let me type pages in by hand; use the weekly reading habit instead…" />
        <div className="rc-actions"><button type="submit" data-no95 disabled={!tweak.trim()}>Rebuild plan</button></div>
        {miss ? <p className="rc-result is-bad">{miss}</p> : null}
      </form>
    </section>
  )
}
