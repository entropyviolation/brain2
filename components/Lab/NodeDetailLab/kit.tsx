/**
 * components/Lab/NodeDetailLab/kit.tsx — Small parts every skin shares
 *
 * `Picker` is the search-or-create field (Enter picks the first hit, or makes
 * a new one). `AddNeed` is kind → search. `useFlash` replays a CSS class when a
 * value changes, so a write visibly lands.
 */
"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { NEED_KINDS, type NeedKind, type NodeModel, type Option } from "./model"

export function Picker({ cls, placeholder, options, onPick, onCreate, onDone, autoFocus = true }: { cls: string; placeholder: string; options: Option[]; onPick: (id: string) => void; onCreate?: (name: string) => void; onDone?: () => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("")
  const [hi, setHi] = useState(0)
  const needle = q.trim().toLowerCase()
  const hits = options.filter((o) => !needle || o.label.toLowerCase().includes(needle)).slice(0, 7)
  const exact = hits.some((o) => o.label.toLowerCase() === needle)
  const canCreate = !!(needle && onCreate && !exact)
  const rows = [...hits.map((h) => ({ ...h, create: false })), ...(canCreate ? [{ id: "__new", label: q.trim(), hint: "new", create: true }] : [])]
  const go = (r: (typeof rows)[number]) => {
    if (r.create) onCreate?.(q.trim())
    else onPick(r.id)
    setQ("")
    // Next tick, so the Enter that picked cannot land on the key that opened us.
    if (onDone) setTimeout(onDone, 0)
  }
  return (
    <div className={`${cls}-picker`}>
      <input
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => (setQ(e.target.value), setHi(0))}
        onKeyDown={(e) => {
          if (e.key === "Escape") return (e.stopPropagation(), onDone?.())
          if (e.key === "ArrowDown") return (e.preventDefault(), setHi((h) => Math.min(rows.length - 1, h + 1)))
          if (e.key === "ArrowUp") return (e.preventDefault(), setHi((h) => Math.max(0, h - 1)))
          if (e.key === "Enter" && rows[hi]) (e.preventDefault(), go(rows[hi]))
        }}
      />
      {rows.length ? (
        <div className={`${cls}-menu`} role="listbox">
          {rows.map((r, i) => (
            <button key={r.id} type="button" role="option" aria-selected={i === hi} className={r.create ? "is-create" : undefined} onMouseEnter={() => setHi(i)} onMouseDown={(e) => (e.preventDefault(), go(r))}>
              <span>{r.create ? `+ New “${r.label}”` : r.label}</span>
              {r.hint && !r.create ? <small>{r.hint}</small> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className={`${cls}-menu is-empty`}>Nothing to pick.</div>
      )}
    </div>
  )
}

/** Kind first, then search inside it. `kinds` lets a skin draw its own buttons. */
export function AddNeed({ cls, n, onDone, initial, renderKind }: { cls: string; n: NodeModel; onDone: () => void; initial?: NeedKind; renderKind?: (k: (typeof NEED_KINDS)[number], on: boolean, pick: () => void) => ReactNode }) {
  const [kind, setKind] = useState<NeedKind | null>(initial ?? null)
  const ph: Record<NeedKind, string> = { first: "Search steps and tasks…", resource: "Search items and lists…", await: "Search or name an event…" }
  return (
    <div className={`${cls}-addneed`}>
      <div className={`${cls}-kinds`} role="group" aria-label="Kind of need">
        {NEED_KINDS.map((k) =>
          renderKind ? (
            <span key={k.id}>{renderKind(k, kind === k.id, () => setKind(k.id))}</span>
          ) : (
            <button key={k.id} type="button" className={`is-${k.id}`} aria-pressed={kind === k.id} title={k.title} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ),
        )}
        <button type="button" className={`${cls}-x`} aria-label="Cancel" title="Cancel" onClick={onDone}>
          ×
        </button>
      </div>
      {kind ? <Picker key={kind} cls={cls} placeholder={ph[kind]} options={n.options[kind]} onPick={(id) => n.act.addNeed(kind, id)} onCreate={(name) => n.act.createNeed(kind, name)} onDone={onDone} /> : <p className={`${cls}-hint`}>{NEED_KINDS.map((k) => k.title.split(".")[0]).join(" · ")}</p>}
    </div>
  )
}

/** Adds `is-flash` for a moment whenever `value` changes. */
export function useFlash<T>(value: T, ms = 600) {
  const [on, setOn] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    setOn(true)
    const t = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return on ? " is-flash" : ""
}

/** Eases a shown number toward its target. */
export function useCountUp(target: number, ms = 500) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(a + (target - a) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return Math.round(v)
}

export const toPts = (v: string) => (v === "" ? undefined : Math.max(0, Math.round(Number(v) || 0)))

/** Type-on text, for logs that print. */
export function TypeOn({ text, speed = 18, on = true }: { text: string; speed?: number; on?: boolean }) {
  const [k, setK] = useState(on ? 0 : text.length)
  useEffect(() => {
    if (!on) return setK(text.length)
    setK(0)
    const id = setInterval(() => setK((x) => (x >= text.length ? (clearInterval(id), x) : x + 1)), speed)
    return () => clearInterval(id)
  }, [text, speed, on])
  return <>{text.slice(0, k)}</>
}
