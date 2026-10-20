/**
 * components/Lab/NodeDetailLab/MockLace.tsx — Concept III · Lace Dial
 *
 * One concentric instrument, cut like lace paper, sheened like nacre. Rings,
 * inside out: ends (a tick per end node), time (spent around est, red past it),
 * points (a knob you drag around; one turn = 20). Needs hang on the left as
 * beads, unlocks on the right. A legend under the dial holds every control
 * as rows. Eggs: flick the lace edge and it spins; Done makes the lace bloom.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { StepTier } from "@/lib/types"
import { AddNeed, Picker, toPts, useCountUp, useFlash } from "./kit"
import { fmtPct, NEED_KINDS, noteDate, NOTE_PROMPT, type NodeModel, type Ref } from "./model"

const C = 180
const TURN = 20
const KIND_INK: Record<string, string> = { first: "var(--lc-violet)", resource: "var(--lc-teal)", await: "var(--lc-rose)", unlock: "var(--lc-ink)" }

const pol = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const
}
function arc(r: number, a0: number, a1: number) {
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99
  const [x0, y0] = pol(r, a0)
  const [x1, y1] = pol(r, a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

function Lace() {
  // Scallops and pierced holes: the cut-paper edge.
  const sc = Array.from({ length: 48 }, (_, i) => i * 7.5)
  return (
    <g className="lc-lace">
      {sc.map((a) => {
        const [x, y] = pol(166, a)
        const [hx, hy] = pol(152, a + 3.75)
        return (
          <g key={a}>
            <circle cx={x} cy={y} r={9} />
            <circle cx={hx} cy={hy} r={2.2} className="lc-hole" />
          </g>
        )
      })}
      <circle cx={C} cy={C} r={160} className="lc-lace-fill" />
      {sc.map((a) => {
        const [x, y] = pol(160, a)
        return <circle key={`p${a}`} cx={x} cy={y} r={3.2} className="lc-hole" />
      })}
    </g>
  )
}

function Dial({ n, onBead, hot }: { n: NodeModel; onBead: (k: string | null) => void; hot: string | null }) {
  const svg = useRef<SVGSVGElement>(null)
  const p = n.points
  const val = p.byLevel ? p.total : p.onDone.value ?? p.onDone.fallback ?? 0
  const shown = useCountUp(val, 300)
  const [spin, setSpin] = useState(0)
  const spinV = useRef(0)
  const drag = useRef<null | { kind: "knob"; last: number; acc: number } | { kind: "spin"; last: number }>(null)
  const angleAt = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 360 - C
    const y = ((e.clientY - r.top) / r.height) * 360 - C
    return { deg: ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360, dist: Math.hypot(x, y) }
  }
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (!drag.current && Math.abs(spinV.current) > 0.05) {
        spinV.current *= 0.965
        setSpin((s) => s + spinV.current)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const down = (e: React.PointerEvent) => {
    const { deg, dist } = angleAt(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (dist > 104 && dist < 132 && !p.byLevel) drag.current = { kind: "knob", last: deg, acc: val * (360 / TURN) }
    else if (dist >= 145) drag.current = { kind: "spin", last: deg }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const { deg } = angleAt(e)
    let delta = deg - d.last
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    d.last = deg
    if (d.kind === "knob") {
      d.acc = Math.max(0, d.acc + delta)
      const next = Math.round(d.acc / (360 / TURN))
      if (next !== val) n.act.setOnDone(next)
    } else {
      spinV.current = delta
      setSpin((s) => s + delta)
    }
  }
  const up = () => (drag.current = null)

  const ends = n.ends
  const span = Math.max(n.est, 1)
  const tFrac = Math.min(1, n.spent / span)
  const over = n.spent > n.est ? Math.min(1, (n.spent - n.est) / span) : 0
  const knobDeg = ((val % TURN) / TURN) * 360
  const turns = Math.floor(val / TURN)
  const [kx, ky] = pol(118, knobDeg)
  const L = n.needs, R = n.unlocks
  const beadAt = (i: number, len: number, side: "l" | "r") => (side === "l" ? 270 + ((i + 1) / (len + 1) - 0.5) * 120 : 90 + ((i + 1) / (len + 1) - 0.5) * 120)
  const tierSpan: Record<StepTier, [number, number]> = { min: [2, 118], goal: [122, 238], exceptional: [242, 358] }
  const maxRung = Math.max(5, ...p.rungs.map((r) => r.value ?? 0))

  return (
    <svg ref={svg} viewBox="0 0 360 360" className={`lc-dial is-${n.state}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={`${n.name}: ${n.state}, ${val} points`}>
      <defs>
        <radialGradient id="lc-pearl" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eef1f6" />
          <stop offset="100%" stopColor="#d8dde8" />
        </radialGradient>
      </defs>
      <g style={{ transform: `rotate(${spin}deg)`, transformOrigin: "180px 180px" }} className="lc-spin">
        <Lace />
      </g>
      <circle cx={C} cy={C} r={136} className="lc-face" />
      {/* bead threads */}
      {L.map((r, i) => {
        const a = beadAt(i, L.length, "l")
        const [x, y] = pol(146, a)
        const [x2, y2] = pol(132, a)
        return <line key={`t${r.key}`} x1={x} y1={y} x2={x2} y2={y2} className={`lc-thread is-${r.state}`} />
      })}
      {/* points ring */}
      <circle cx={C} cy={C} r={118} className="lc-track" />
      {p.byLevel ? (
        p.rungs.map((r) => {
          const [a0, a1] = tierSpan[r.tier]
          const f = (r.value ?? 0) / maxRung
          return (
            <g key={r.tier} className={`lc-rung is-${r.tier}${r.inside ? "" : " is-off"}${r.reached ? " is-reached" : ""}`}>
              <path d={arc(118, a0, a1)} className="lc-rung-bed" />
              {f > 0 ? <path d={arc(118, a0, a0 + (a1 - a0) * f)} className="lc-rung-fill" /> : null}
              <text {...(() => { const [x, y] = pol(118, (a0 + a1) / 2); return { x, y } })()} className="lc-rung-tag">
                {r.short}
              </text>
            </g>
          )
        })
      ) : (
        <>
          {knobDeg > 0.5 ? <path d={arc(118, 0, knobDeg)} className="lc-pts" /> : null}
          {Array.from({ length: TURN }, (_, i) => {
            const [x0, y0] = pol(108, (i / TURN) * 360)
            const [x1, y1] = pol(112, (i / TURN) * 360)
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="lc-detent" />
          })}
          <circle cx={kx} cy={ky} r={10} className="lc-knob" />
          {Array.from({ length: Math.min(turns, 12) }, (_, i) => {
            const [x, y] = pol(128, -i * 6 - 8)
            return <circle key={i} cx={x} cy={y} r={2.4} className="lc-turn" />
          })}
        </>
      )}
      {/* time ring */}
      <circle cx={C} cy={C} r={96} className="lc-track is-thin" />
      {tFrac > 0 ? <path d={arc(96, 0, tFrac * 360)} className="lc-time" /> : null}
      {over > 0 ? <path d={arc(101, 0, over * 360)} className="lc-over" /> : null}
      {/* ends ring */}
      {ends
        ? Array.from({ length: ends.leaves }, (_, i) => {
            const g = 360 / ends.leaves
            return <path key={i} d={arc(80, i * g + 1.5, (i + 1) * g - 1.5)} className={`lc-end${i < ends.done ? " is-on" : ""}`} />
          })
        : null}
      {/* center */}
      <circle cx={C} cy={C} r={66} fill="url(#lc-pearl)" className="lc-core" />
      <text x={C} y={C - 18} className="lc-core-state">
        {n.state}
      </text>
      <text x={C} y={C + 12} className="lc-core-num">
        {shown}
      </text>
      <text x={C} y={C + 30} className="lc-core-unit">
        points
      </text>
      {/* beads */}
      {L.map((r, i) => {
        const [x, y] = pol(148, beadAt(i, L.length, "l"))
        return (
          <circle key={r.key} cx={x} cy={y} r={hot === r.key ? 9 : 7} className={`lc-bead is-${r.state}`} style={{ fill: KIND_INK[r.kind] }} onPointerEnter={() => onBead(r.key)} onPointerLeave={() => onBead(null)}>
            <title>
              {r.label} · {r.hint} · {r.state}
            </title>
          </circle>
        )
      })}
      {R.map((r, i) => {
        const [x, y] = pol(148, beadAt(i, R.length, "r"))
        return (
          <rect key={r.key} x={x - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x} ${y})`} className={`lc-bead is-${r.state}`} style={{ fill: KIND_INK.unlock }} onPointerEnter={() => onBead(r.key)} onPointerLeave={() => onBead(null)}>
            <title>Unlocks {r.label}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function Row({ r, n, hot, setHot }: { r: Ref; n: NodeModel; hot: string | null; setHot: (k: string | null) => void }) {
  return (
    <li className={`lc-row is-${r.state}${hot === r.key ? " is-hot" : ""}`} onPointerEnter={() => setHot(r.key)} onPointerLeave={() => setHot(null)}>
      <i style={{ background: KIND_INK[r.kind] }} className={r.kind === "unlock" ? "is-diamond" : undefined} />
      {r.canOpen ? (
        <button type="button" className="lc-row-name" onClick={() => n.act.open(r)}>
          {r.label}
        </button>
      ) : (
        <span className="lc-row-name">{r.label}</span>
      )}
      <small>{r.state === "wait" ? "waiting" : r.state === "ref" ? r.hint : r.state}</small>
      {r.canLog ? (
        <button type="button" className="lc-mini" onClick={() => n.act.log(r.id)}>
          log
        </button>
      ) : null}
      <button type="button" className="lc-mini is-x" aria-label={`Remove ${r.label}`} onClick={() => n.act.removeNeed(r)}>
        ×
      </button>
    </li>
  )
}

export function MockLace({ n, showMath }: { n: NodeModel; showMath: boolean }) {
  const [hot, setHot] = useState<string | null>(null)
  const [adding, setAdding] = useState<null | "need" | "unlock">(null)
  const [draft, setDraft] = useState("")
  const [pearl, setPearl] = useState({ x: 50, y: 30 })
  const bloom = useFlash(n.state === "done", 1400)
  const p = n.points
  const send = () => draft.trim() && (n.act.addNote(draft), setDraft(""))
  return (
    <article className={`lc${bloom && n.state === "done" ? " is-bloom" : ""}`} style={{ ["--px" as string]: `${pearl.x}%`, ["--py" as string]: `${pearl.y}%` }} onPointerMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect()
      setPearl({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
    }}>
      <header className="lc-head">
        <p className="lc-path">{n.path.join(" · ")}</p>
        <h2>{n.name}</h2>
        <p className="lc-meta">
          {n.tier ? <span className={`lc-tier is-${n.tier}`}>{n.tier === "min" ? "B" : n.tier === "goal" ? "G" : "E"}</span> : null}
          <span>{n.est}m est</span>
          <span className={n.spent > n.est ? "is-over" : undefined}>{n.spent}m spent</span>
          {n.ends ? (
            <span>
              {n.ends.done}/{n.ends.leaves} ends
            </span>
          ) : null}
        </p>
      </header>

      <div className="lc-stage">
        <Dial n={n} hot={hot} onBead={setHot} />
        <p className="lc-hint">{p.byLevel ? "Set each level below" : "Drag the knob around · one turn = 20"} · flick the lace</p>
      </div>

      {showMath && n.math ? (
        <p className="lc-math">
          <span>ρ = Σdᵢ ⁄ ΣLᵢ = {fmtPct(n.math.rho)}</span>
          <span>σ = ¹⁄ₙ Σ dᵢ⁄Lᵢ = {fmtPct(n.math.sigma)}</span>
        </p>
      ) : null}

      <section className="lc-legend" aria-label="Points">
        <h3>
          Points
          {p.canByLevel ? (
            <span className="lc-seg" role="group" aria-label="Points mode">
              <button type="button" aria-pressed={!p.byLevel} onClick={() => n.act.setByLevel(false)}>
                On done
              </button>
              <button type="button" aria-pressed={p.byLevel} onClick={() => n.act.setByLevel(true)}>
                By level
              </button>
            </span>
          ) : null}
        </h3>
        <div className="lc-fields">
          {p.byLevel ? (
            p.rungs.map((r) => (
              <label key={r.tier} className={`lc-field is-${r.tier}${r.inside ? "" : " is-off"}`}>
                <span>
                  {r.short} · {r.label}
                  {r.reached ? " ✓" : ""}
                </span>
                <input type="number" min={0} disabled={!r.inside} value={r.value ?? ""} placeholder="0" onChange={(e) => n.act.setRung(r.tier, toPts(e.target.value))} />
              </label>
            ))
          ) : (
            <label className="lc-field">
              <span>On done</span>
              <input type="number" min={0} value={p.onDone.value ?? ""} placeholder={p.onDone.fallback != null ? String(p.onDone.fallback) : "—"} onChange={(e) => n.act.setOnDone(toPts(e.target.value))} />
              <small>
                {p.onDone.caption}
                {p.onDone.resetTo != null ? (
                  <button type="button" className="lc-mini" onClick={() => n.act.setOnDone(undefined)}>
                    ↺ {p.onDone.resetTo}
                  </button>
                ) : null}
              </small>
            </label>
          )}
          {p.each.show ? (
            <label className="lc-field">
              <span>Each step</span>
              <input type="number" min={0} value={p.each.value ?? ""} placeholder={p.each.fallback != null ? String(p.each.fallback) : "—"} onChange={(e) => n.act.setEach(toPts(e.target.value))} />
              <small>{p.each.caption}</small>
            </label>
          ) : null}
        </div>
      </section>

      <section className="lc-legend" aria-label="Needs">
        <h3>
          Threads <small>● needs · ◆ unlocks</small>
        </h3>
        {n.needs.length || n.unlocks.length ? (
          <ul className="lc-rows">
            {NEED_KINDS.flatMap((k) => n.needs.filter((r) => r.kind === k.id)).map((r) => (
              <Row key={r.key} r={r} n={n} hot={hot} setHot={setHot} />
            ))}
            {n.unlocks.map((r) => (
              <Row key={r.key} r={r} n={n} hot={hot} setHot={setHot} />
            ))}
          </ul>
        ) : (
          <p className="lc-quiet">Needs nothing yet.</p>
        )}
        <div className="lc-adds">
          <button type="button" className="lc-add" aria-pressed={adding === "need"} onClick={() => setAdding(adding === "need" ? null : "need")}>
            ● Hang a need
          </button>
          <button type="button" className="lc-add" aria-pressed={adding === "unlock"} disabled={!n.unlockOptions.length} onClick={() => setAdding(adding === "unlock" ? null : "unlock")}>
            ◆ Make {n.isTask ? "a task" : "a step"} wait
          </button>
        </div>
        {adding === "need" ? <AddNeed cls="lc" n={n} onDone={() => setAdding(null)} /> : null}
        {adding === "unlock" ? <Picker cls="lc" placeholder="Pick what waits on this…" options={n.unlockOptions} onPick={n.act.addUnlock} onDone={() => setAdding(null)} /> : null}
      </section>

      <div className="lc-keys">
        {!n.isTask ? (
          <button type="button" className="lc-add" onClick={n.act.openStepItem}>
            ↗ Step item
          </button>
        ) : null}
        <button type="button" className="lc-add is-done" onClick={n.act.toggleDone}>
          {n.state === "done" ? "Reopen" : "✿ Done"}
        </button>
      </div>

      <section className="lc-legend" aria-label="Notes">
        <h3>
          Notes {n.notes.length ? <span className="lc-count">{n.notes.length}</span> : null}
          {n.due ? <i className="lc-due" title="Pushed 3+ times. A note here quiets the dot." /> : null}
        </h3>
        <div className="lc-compose">
          <textarea rows={2} value={draft} placeholder={n.due ? NOTE_PROMPT : "A note on this task…"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), send())} />
          <button type="button" className="lc-mini is-send" disabled={!draft.trim()} onClick={send}>
            Log ⌘↩
          </button>
        </div>
        <ol className="lc-thread-list">
          {n.notes.map((a, i) => (
            <li key={a.id} style={{ ["--i" as string]: i }}>
              <time>{noteDate(a.date)}</time>
              <p>{a.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}
