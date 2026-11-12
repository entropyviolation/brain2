/**
 * components/Bim/report-card.tsx — The plan BIM proposes from a status report
 *
 * Shared by the desktop console and the phone terminal. Shows how the message was read (the trace),
 * then one block per proposed change: why, the evidence, editable fields, and Accept / Reject.
 * Nothing is saved until Accept. Edits are kept as typed and used at accept time.
 */
"use client"

import { acceptAll, acceptEffect, reconsiderEffect, rejectAll, rejectEffect } from "@/lib/report-bimby/decide"
import { useReportStore } from "@/lib/report-bimby/store"
import type { Effect, EffectField } from "@/lib/report-bimby/types"
import "./report-card.css"

const KIND_LABEL: Record<Effect["kind"], string> = { inventory: "INVENTORY", cycle: "CYCLE", intake: "INTAKE", timeblock: "ACTIVITY", sleep: "SLEEP", line: "FILE", verdict: "LINK", feeling: "FEEL" }
const STATUS_LABEL: Record<Effect["status"], string> = { pending: "WAITING", working: "SAVING…", applied: "SAVED", rejected: "REJECTED", failed: "FAILED" }

function FieldInput({ planId, effectId, field, locked }: { planId: string; effectId: string; field: EffectField; locked: boolean }) {
  const setField = useReportStore((s) => s.setField)
  const id = `${effectId}-${field.key}`
  const common = { id, value: field.value, disabled: locked, onChange: (v: string) => setField(planId, effectId, field.key, v) }
  return (
    <label className="rc-field" htmlFor={id}>
      <span>{field.label}</span>
      {field.type === "select" ? (
        <select id={id} value={common.value} disabled={locked} onChange={(e) => common.onChange(e.target.value)}>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={field.type === "datetime" ? "datetime-local" : field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? 0 : undefined}
          value={common.value}
          disabled={locked}
          onChange={(e) => common.onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function EffectBlock({ planId, effect }: { planId: string; effect: Effect }) {
  const locked = effect.status === "applied" || effect.status === "rejected" || effect.status === "working"
  return (
    <article className={`rc-effect is-${effect.status}`} data-kind={effect.kind}>
      <header>
        <span className="rc-kind">{KIND_LABEL[effect.kind]}</span>
        <b>{effect.title}</b>
        <span className="rc-status">{STATUS_LABEL[effect.status]}</span>
      </header>
      <details open={effect.status === "pending"}>
        <summary>why ({effect.reasoning.length}){effect.evidence.length ? ` · evidence (${effect.evidence.length})` : ""}</summary>
        <ul className="rc-why">{effect.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ul>
        {effect.evidence.length ? <div className="rc-evidence">{effect.evidence.map((r, i) => <p key={i}>{r}</p>)}</div> : null}
      </details>
      <div className="rc-fields">
        {effect.fields.map((f) => <FieldInput key={f.key} planId={planId} effectId={effect.id} field={f} locked={locked} />)}
      </div>
      {effect.status === "working" ? <div className="rc-bar" role="progressbar" aria-label="Saving" aria-busy="true"><i /></div> : null}
      {effect.result ? <p className={`rc-result${effect.status === "failed" ? " is-bad" : ""}`}>{effect.result}{effect.status === "applied" ? " Send undo to reverse it." : ""}</p> : null}
      <div className="rc-actions">
        {effect.status === "pending" || effect.status === "failed" ? (
          <>
            <button type="button" data-no95 className="rc-accept" onClick={() => acceptEffect(planId, effect.id)}>{effect.status === "failed" ? "Try again" : "Accept"}</button>
            <button type="button" data-no95 onClick={() => rejectEffect(planId, effect.id)}>Reject</button>
          </>
        ) : null}
        {effect.status === "rejected" ? <button type="button" data-no95 onClick={() => reconsiderEffect(planId, effect.id)}>Reconsider</button> : null}
      </div>
    </article>
  )
}

export function ReportCard({ reportId }: { reportId: string }) {
  const plan = useReportStore((s) => s.plans[reportId])
  if (!plan) return <p className="rc-gone">This plan is no longer kept on this device.</p>
  const pending = plan.effects.filter((e) => e.status === "pending").length
  const saving = plan.effects.some((e) => e.status === "working")
  return (
    <section className="rc" aria-label="BIM's plan for your report">
      <details className="rc-trace" open>
        <summary>how I read it ({plan.trace.length} steps)</summary>
        <ol>{plan.trace.map((t, i) => <li key={i}>{t}</li>)}</ol>
      </details>
      {plan.effects.map((e) => <EffectBlock key={e.id} planId={plan.id} effect={e} />)}
      {pending > 1 && !saving ? (
        <div className="rc-actions rc-all">
          <button type="button" data-no95 className="rc-accept" onClick={() => acceptAll(plan.id)}>Accept all {pending}</button>
          <button type="button" data-no95 onClick={() => rejectAll(plan.id)}>Reject all</button>
        </div>
      ) : null}
    </section>
  )
}
