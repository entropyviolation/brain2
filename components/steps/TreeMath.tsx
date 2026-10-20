/**
 * components/steps/TreeMath.tsx — The task card's completion figure and row gauges
 *
 * `TreeMath`: two mosaic bars over the top-level parts. "by ends" gives each
 * part width ∝ its end nodes (ρ); "by parts" gives each the same width (σ).
 * The fill is that part's done share, so the gap between bars is Δ. Formulas
 * are written out with the real numbers, then B / G / E by the same rule.
 *
 * `SplitGauge`: one row's B / G / E over its children. Nothing on a leaf.
 * Numbers from `lib/tree-math.ts`.
 */
"use client"

import { Fragment, type ReactNode } from "react"
import type { StepTier, Subtask } from "@/lib/types"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT } from "@/lib/step-tiers"
import { formatPercent } from "@/lib/step-progress"
import { splitStats, treeDepth, type Part, type SplitStats, type TierSplit } from "@/lib/tree-math"
import "./tree-math.css"

const pct = (p: number | null) => formatPercent(p)
const Frac = ({ n, d }: { n: ReactNode; d: ReactNode }) => (
  <span className="tm-frac">
    <span>{n}</span>
    <span>{d}</span>
  </span>
)
const V = ({ children }: { children: string }) => <i className="tm-v">{children}</i>

export function Mosaic({ parts, equal, label, value }: { parts: Part[]; equal: boolean; label: string; value: number | null }) {
  return (
    <div className="tm-mosaic">
      <span className="tm-mosaic-label">{label}</span>
      <span className="tm-mosaic-bar">
        {parts.map((p, i) => (
          <span
            key={p.id}
            className={`tm-seg is-${p.tier}`}
            style={{ flexGrow: equal ? 1 : p.leaves }}
            title={`${p.name}: ${p.done}/${p.leaves} ends · ${pct(p.done / p.leaves)}`}
          >
            <span className="tm-seg-fill" style={{ width: `${(p.done / p.leaves) * 100}%` }} />
            <span className="tm-seg-name">{String.fromCharCode(97 + (i % 26))}</span>
          </span>
        ))}
      </span>
      <span className="tm-mosaic-val">{pct(value)}</span>
    </div>
  )
}

export function TreeMath({ steps, tiers, levels, focus }: { steps: readonly Subtask[]; tiers: Map<string, StepTier>; levels: TierSplit; focus?: StepTier }) {
  const all: SplitStats = splitStats(steps, tiers)
  if (!all.parts.length) return null
  const { parts, leaves, done, raw, split } = all
  const delta = raw != null && split != null ? Math.round((split - raw) * 100) : 0
  const shown = parts.length <= 6
  return (
    <figure className="tree-math" aria-label="Completion math">
      <div className="tm-structure">
        <span><V>n</V> = {parts.length} <small>parts</small></span>
        <span><V>L</V> = {leaves} <small>ends</small></span>
        <span><V>h</V> = {treeDepth(steps)} <small>deep</small></span>
      </div>

      <div className="tm-mosaics">
        <Mosaic parts={parts} equal={false} label="by ends" value={raw} />
        <Mosaic parts={parts} equal label="by parts" value={split} />
      </div>

      <div className="tm-formulas">
        <div className="tm-eq" title="Raw: every end node weighs the same">
          <V>ρ</V> = <Frac n={<>Σ<V>d</V><sub>i</sub></>} d={<>Σ<V>L</V><sub>i</sub></>} /> = <Frac n={done} d={leaves} /> = <b>{pct(raw)}</b>
        </div>
        <div className="tm-eq" title="Split: every top-level part weighs the same, however deep">
          <V>σ</V> = <Frac n="1" d={<V>n</V>} />Σ<Frac n={<><V>d</V><sub>i</sub></>} d={<><V>L</V><sub>i</sub></>} /> ={" "}
          {shown ? (
            <>
              <span className="tm-paren">(</span>
              {parts.map((p, i) => (
                <Fragment key={p.id}>
                  {i ? " + " : ""}
                  <Frac n={p.done} d={p.leaves} />
                </Fragment>
              ))}
              <span className="tm-paren">)</span>/{parts.length} ={" "}
            </>
          ) : null}
          <b>{pct(split)}</b>
        </div>
        <div className="tm-eq tm-delta">
          <V>Δ</V> = <V>σ</V> − <V>ρ</V> = <b>{delta > 0 ? "+" : ""}{delta}</b> pts
          <small>{delta > 0 ? " · small parts are ahead" : delta < 0 ? " · big parts are ahead" : " · balanced"}</small>
        </div>
      </div>

      <div className="tm-levels" role="table" aria-label="Levels">
        {STEP_TIERS.map((t) => {
          const s = levels[t]
          return (
            <div key={t} role="row" className={`tm-level is-${t}${focus === t ? " is-focus" : ""}${s ? "" : " is-empty"}`} title={`${STEP_TIER_LABEL[t]}: top-level parts tagged ${STEP_TIER_SHORT[t]}`}>
              <span className="tm-level-tag">{STEP_TIER_SHORT[t]}</span>
              <span className="tm-level-track"><span style={{ width: `${(s?.split ?? 0) * 100}%` }} /></span>
              <span><V>σ</V> {pct(s?.split ?? null)}</span>
              <span className="is-quiet"><V>ρ</V> {pct(s?.raw ?? null)}</span>
              <span className="is-quiet">{s ? `${s.parts.length} · ${s.done}/${s.leaves}` : ""}</span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

/** A row's B / G / E (σ, with ρ in the title). Leaves show nothing: they are just done or not. */
export function SplitGauge({ levels, focus }: { levels: TierSplit | null; focus?: StepTier }) {
  if (!levels) return <span className="level-gauge tm-gauge is-leaf" aria-hidden />
  return (
    <span className="level-gauge tm-gauge" aria-label="Progress">
      {STEP_TIERS.map((t) => {
        const s = levels[t]
        return (
          <span
            key={t}
            className={`level-gauge-cell${s ? "" : " is-empty"}${focus === t ? " is-focus" : ""}`}
            title={`${STEP_TIER_LABEL[t]}: σ ${pct(s?.split ?? null)} · ρ ${pct(s?.raw ?? null)}${s ? ` · ${s.done}/${s.leaves} ends` : ""}`}
          >
            <span className="level-gauge-short">{STEP_TIER_SHORT[t]}</span>
            <span className="level-gauge-track" aria-hidden>
              <span className="level-gauge-fill" style={{ width: `${Math.round((s?.split ?? 0) * 100)}%` }} />
            </span>
            <span className="level-gauge-pct">{pct(s?.split ?? null)}</span>
          </span>
        )
      })}
    </span>
  )
}
