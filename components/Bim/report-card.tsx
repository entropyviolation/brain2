/**
 * components/Bim/report-card.tsx — The plan BIM proposes from a status report
 *
 * Shared by the desktop console and the phone terminal. Shows how the message was read (the trace),
 * then one block per proposed change: why, the evidence, editable fields, and Accept / Reject.
 * Nothing is saved until Accept. Edits are kept as typed and used at accept time.
 * Tap a change's header (or its Reply key) to answer it in chat: the next line you send is read against that change
 * (`lib/report-bimby/card-reply.ts`) and BIM answers with a new card.
 */
"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { knownInstagrams, suggestInstagrams } from "@/lib/known-instagrams"
import { NEUTRAL_HINT, NEUTRAL_LABEL } from "@/lib/accept-grade"
import { acceptAll, acceptEffect, reconsiderEffect, rejectAll, rejectEffect } from "@/lib/report-bimby/decide"
import { useReportStore } from "@/lib/report-bimby/store"
import { useReplyTarget } from "@/lib/report-bimby/reply-target"
import type { Effect, EffectField } from "@/lib/report-bimby/types"
import { useTaskStore } from "@/lib/task-store"
import "./report-card.css"

const KIND_LABEL: Record<Effect["kind"], string> = { inventory: "INVENTORY", cycle: "CYCLE", intake: "INTAKE", timeblock: "ACTIVITY", sleep: "SLEEP", line: "FILE", verdict: "LINK", feeling: "FEEL", person: "PERSON", "person-note": "NOTE", birthday: "BIRTHDAY", reminder: "REMIND", "plan-entry": "PLAN", intention: "INTENT", day: "DAY", amend: "AMEND", pattern: "PATTERN" }
const STATUS_LABEL: Record<Effect["status"], string> = { pending: "WAITING", working: "SAVING…", applied: "SAVED", rejected: "REJECTED", failed: "FAILED" }

/** Text fields that hold prose (a note, a line) read as a full-width box that grows with the words. */
const PROSE_KEYS = new Set(["text", "note", "notes", "body", "about"])
const isProse = (field: EffectField) => field.type === "text" && (PROSE_KEYS.has(field.key) || field.value.length > 40)

function ProseInput({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} id={id} rows={1} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
}

/**
 * The Instagram box: typing suggests handles the vault knows (people's accounts, Instagram import rows).
 * Several handles may be typed with commas; suggestions follow the last one. A handle not in the list is
 * kept as typed, and Accept saves it on the person, so it is known from then on. ↑ ↓ Enter/Tab Esc.
 */
function InstagramInput({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const known = useMemo(() => (open ? knownInstagrams(tasks, lists) : []), [open, tasks, lists])
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(" ")) + 1
  const last = value.slice(cut)
  const rows = useMemo(() => suggestInstagrams(known, last), [known, last])
  const exact = rows[0]?.handle.toLowerCase() === last.replace(/^@+/, "").trim().toLowerCase()
  const show = open && rows.length > 0 && !(exact && rows.length === 1)
  const pick = (handle: string) => {
    onChange(value.slice(0, cut) + handle)
    setOpen(false)
  }
  return (
    <div className="rc-combo">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={show}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((i) => Math.min(rows.length - 1, i + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === "Enter" || e.key === "Tab") {
            if (!rows[active]) return
            e.preventDefault()
            pick(rows[active]!.handle)
          } else if (e.key === "Escape") {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {show ? (
        <ul id={`${id}-list`} role="listbox" className="rc-menu" aria-label="Known Instagram handles">
          {rows.map((k, i) => (
            <li
              key={k.handle}
              role="option"
              aria-selected={i === active}
              data-active={i === active ? "true" : undefined}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(k.handle)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b>@{k.handle}</b>
              {k.who ? <span>{k.who}</span> : null}
            </li>
          ))}
          {!exact && last.trim() ? <li className="rc-menu-new" aria-disabled="true">or keep @{last.replace(/^@+/, "").trim()} as new</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

function FieldInput({ planId, effectId, field, locked }: { planId: string; effectId: string; field: EffectField; locked: boolean }) {
  const setField = useReportStore((s) => s.setField)
  const id = `${effectId}-${field.key}`
  const common = { id, value: field.value, disabled: locked, onChange: (v: string) => setField(planId, effectId, field.key, v) }
  // Decided once, so the box never swaps under the cursor while typing.
  const [prose] = useState(() => isProse(field))
  return (
    <label className={`rc-field${prose ? " is-prose" : ""}`} htmlFor={id}>
      <span>{field.label}</span>
      {prose ? (
        <ProseInput {...common} />
      ) : field.key === "instagram" && field.type === "text" ? (
        <InstagramInput {...common} />
      ) : field.type === "select" ? (
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

/** Mark this change as the one the next chat line answers, and put the cursor in the well. Again unmarks it. */
function useReplyTo(planId: string, effect: Effect) {
  const target = useReplyTarget((s) => s.target)
  const set = useReplyTarget((s) => s.set)
  const on = target?.planId === planId && target.effectId === effect.id
  const toggle = () => {
    set(on ? null : { planId, effectId: effect.id, label: `${KIND_LABEL[effect.kind]} · ${effect.title}` })
    if (!on && typeof document !== "undefined") document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message BIM"]')?.focus()
  }
  return { on, toggle }
}

function EffectBlock({ planId, effect }: { planId: string; effect: Effect }) {
  const locked = effect.status === "applied" || effect.status === "rejected" || effect.status === "working"
  const reply = useReplyTo(planId, effect)
  return (
    <article className={`rc-effect is-${effect.status}${reply.on ? " is-reply" : ""}`} data-kind={effect.kind}>
      <header className="rc-head" role="button" tabIndex={0} title="Reply to this in chat" aria-pressed={reply.on} onClick={reply.toggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), reply.toggle())}>
        <span className="rc-kind">{KIND_LABEL[effect.kind]}</span>
        <b>{effect.title}</b>
        <span className="rc-status">{STATUS_LABEL[effect.status]}{effect.grade === "ok" ? " · NEUTRAL" : ""}</span>
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
            <button type="button" data-no95 title={NEUTRAL_HINT} onClick={() => acceptEffect(planId, effect.id, "ok")}>{NEUTRAL_LABEL}</button>
            <button type="button" data-no95 onClick={() => rejectEffect(planId, effect.id)}>Reject</button>
          </>
        ) : null}
        {effect.status === "rejected" ? <button type="button" data-no95 onClick={() => reconsiderEffect(planId, effect.id)}>Reconsider</button> : null}
        {effect.status !== "working" ? <button type="button" data-no95 className="rc-reply" aria-pressed={reply.on} onClick={reply.toggle}>{reply.on ? "Replying…" : "Reply"}</button> : null}
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
          <button type="button" data-no95 title={NEUTRAL_HINT} onClick={() => acceptAll(plan.id, "ok")}>{NEUTRAL_LABEL} all</button>
          <button type="button" data-no95 onClick={() => rejectAll(plan.id)}>Reject all</button>
        </div>
      ) : null}
    </section>
  )
}
