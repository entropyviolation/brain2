/**
 * components/Lab/NodeDetailLab/MockDischarge.tsx — Concept I · Discharge
 *
 * Smoked glass. State and level are gas tubes (Xe done, Ar open, Ne locked).
 * Est / spent / ends are nixie digits. Time is a scope trace that runs past
 * the estimate in red. Points are chrome bearings that drop into a tube with
 * physics. Needs and unlocks are a patch bay: wires into the node and out.
 * Egg: click a tube for its emission spectrum. Click the state tube 5× to strike.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { StepTier } from "@/lib/types"
import { AddNeed, Picker, toPts, TypeOn, useCountUp, useFlash } from "./kit"
import { fmtPct, noteDate, NOTE_PROMPT, type NodeModel, type Ref } from "./model"

const GAS = {
  done: { sym: "Xe", z: 54, name: "Xenon", hue: "#bfe3ff", lines: [467, 473, 480, 492, 529] },
  open: { sym: "Ar", z: 18, name: "Argon", hue: "#b49cff", lines: [420, 434, 451, 697, 750] },
  locked: { sym: "Ne", z: 10, name: "Neon", hue: "#ff6a4a", lines: [585, 607, 640, 650, 703] },
  min: { sym: "Kr", z: 36, name: "Krypton", hue: "#e8f0ff", lines: [431, 446, 557, 587, 760] },
  goal: { sym: "Ar", z: 18, name: "Argon", hue: "#b49cff", lines: [420, 434, 451, 697, 750] },
  exceptional: { sym: "Hg", z: 80, name: "Mercury", hue: "#7ff0ff", lines: [405, 436, 546, 577, 579] },
} as const
type GasKey = keyof typeof GAS

function nm2rgb(nm: number) {
  const h = Math.max(0, Math.min(300, ((700 - nm) / 300) * 300))
  return `hsl(${h} 100% 60%)`
}

function Tube({ gas, label, striking, onClick }: { gas: GasKey; label: string; striking?: boolean; onClick?: () => void }) {
  const g = GAS[gas]
  const [spec, setSpec] = useState(false)
  return (
    <button type="button" className={`dx-tube${striking ? " is-strike" : ""}`} style={{ ["--gas" as string]: g.hue }} onClick={() => (setSpec((s) => !s), onClick?.())} title={`${g.name} — click for its spectrum`}>
      <span className="dx-tube-glass">
        <i className="dx-tube-arc" />
        <b>{g.sym}</b>
        <small>{g.z}</small>
      </span>
      <span className="dx-tube-label">{label}</span>
      {spec ? (
        <span className="dx-spec" aria-label={`${g.name} emission lines`}>
          {g.lines.map((l) => (
            <i key={l} style={{ left: `${((l - 380) / 400) * 100}%`, background: nm2rgb(l) }} title={`${l} nm`} />
          ))}
          <em>{g.name} · lines in nm</em>
        </span>
      ) : null}
    </button>
  )
}

function Nixie({ value, unit }: { value: string; unit: string }) {
  const f = useFlash(value)
  return (
    <span className={`dx-nixie${f}`}>
      <span className="dx-nixie-row">
        {value.split("").map((c, i) => (
          <span key={i} className="dx-nixie-cell">
            <span className="dx-nixie-ghost">8</span>
            <span className="dx-nixie-lit">{c}</span>
          </span>
        ))}
      </span>
      <small>{unit}</small>
    </span>
  )
}

// ── Scope: est vs spent ──────────────────────────────────────────────

function Scope({ est, spent, math, showMath }: { est: number; spent: number; math: NodeModel["math"]; showMath: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ est, spent })
  live.current = { est, spent }
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")!
    let raf = 0
    const draw = (t: number) => {
      const W = (c.width = c.clientWidth * 2)
      const H = (c.height = c.clientHeight * 2)
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = "rgba(127,240,255,.10)"
      ctx.lineWidth = 1
      for (let x = 0; x <= 10; x++) (ctx.beginPath(), ctx.moveTo((x / 10) * W, 0), ctx.lineTo((x / 10) * W, H), ctx.stroke())
      for (let y = 0; y <= 6; y++) (ctx.beginPath(), ctx.moveTo(0, (y / 6) * H), ctx.lineTo(W, (y / 6) * H), ctx.stroke())
      const { est: e, spent: s } = live.current
      const span = Math.max(e, s, 1) * 1.15
      const ex = (e / span) * W
      const sx = (s / span) * W
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = "rgba(180,156,255,.7)"
      ctx.beginPath(), ctx.moveTo(ex, 0), ctx.lineTo(ex, H), ctx.stroke()
      ctx.setLineDash([])
      const seg = (from: number, to: number, color: string) => {
        ctx.strokeStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 16
        ctx.lineWidth = 3
        ctx.beginPath()
        for (let x = from; x <= to; x += 2) {
          const y = H / 2 + Math.sin(x / 26 + t / 260) * (H * 0.28) * Math.sin((x / W) * Math.PI * 0.9 + 0.2)
          if (x === from) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      }
      seg(0, Math.min(sx, ex), "#7ff0ff")
      if (sx > ex) seg(ex, sx, "#ff5a4a")
      ctx.fillStyle = "#7ff0ff"
      ctx.beginPath(), ctx.arc(sx, H / 2, 5, 0, Math.PI * 2), ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  const over = spent - est
  return (
    <figure className="dx-scope">
      <canvas ref={ref} aria-label={`Spent ${spent} minutes of ${est} estimated`} />
      <figcaption>
        <span>EST {est}m</span>
        <span>SPENT {spent}m</span>
        <span className={over > 0 ? "is-over" : undefined}>{over > 0 ? `+${over}m past est` : `${est - spent}m left`}</span>
      </figcaption>
      {showMath && math ? (
        <p className="dx-math">
          ρ = Σdᵢ / ΣLᵢ = {math.done}/{math.leaves} = <b>{fmtPct(math.rho)}</b> &nbsp;·&nbsp; σ = ¹⁄ₙ Σ dᵢ/Lᵢ = <b>{fmtPct(math.sigma)}</b> &nbsp;·&nbsp; Δ = {math.sigma != null && math.rho != null ? `${Math.round((math.sigma - math.rho) * 100)}pt` : "—"}
        </p>
      ) : null}
    </figure>
  )
}

// ── Bearings: points as chrome balls ─────────────────────────────────

function Bearings({ count, onChange, disabled, gas = "#b49cff", label, sub }: { count: number; onChange: (n: number | undefined) => void; disabled?: boolean; gas?: string; label: string; sub?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const balls = useRef<{ x: number; y: number; vx: number; vy: number }[]>([])
  const target = useRef(count)
  target.current = Math.min(count, 60)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")!
    let raf = 0
    const R = 9
    const loop = () => {
      const W = (c.width = c.clientWidth * 2)
      const H = (c.height = c.clientHeight * 2)
      const B = balls.current
      while (B.length < target.current) B.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: -R * 2 - Math.random() * 40, vx: (Math.random() - 0.5) * 2, vy: 0 })
      while (B.length > target.current) {
        const b = B.pop()!
        void b
      }
      const r = R * 2
      for (const b of B) {
        b.vy += 0.9
        b.x += b.vx
        b.y += b.vy
        if (b.y > H - r) (b.y = H - r), (b.vy *= -0.35), (b.vx *= 0.9)
        if (b.x < r) (b.x = r), (b.vx *= -0.5)
        if (b.x > W - r) (b.x = W - r), (b.vx *= -0.5)
      }
      for (let k = 0; k < 3; k++)
        for (let i = 0; i < B.length; i++)
          for (let j = i + 1; j < B.length; j++) {
            const a = B[i], b = B[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 0.01
            if (d < r * 2) {
              const push = (r * 2 - d) / 2
              const nx = dx / d, ny = dy / d
              a.x -= nx * push, a.y -= ny * push
              b.x += nx * push, b.y += ny * push
              const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
              if (rel < 0) (a.vx += rel * nx * 0.5), (a.vy += rel * ny * 0.5), (b.vx -= rel * nx * 0.5), (b.vy -= rel * ny * 0.5)
            }
          }
      ctx.clearRect(0, 0, W, H)
      for (const b of B) {
        const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
        g.addColorStop(0, "#ffffff")
        g.addColorStop(0.25, "#d9dde6")
        g.addColorStop(0.6, "#5d6370")
        g.addColorStop(0.85, "#1b1e25")
        g.addColorStop(1, gas)
        ctx.fillStyle = g
        ctx.beginPath(), ctx.arc(b.x, b.y, r, 0, Math.PI * 2), ctx.fill()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [gas])
  const shown = useCountUp(count)
  return (
    <div className={`dx-bear${disabled ? " is-off" : ""}`} style={{ ["--gas" as string]: gas }}>
      <span className="dx-bear-label">{label}</span>
      <button type="button" className="dx-bear-glass" disabled={disabled} title="Click to drop a bearing (+1). Right-click to lift one (−1)." onClick={() => onChange(count + 1)} onContextMenu={(e) => (e.preventDefault(), onChange(Math.max(0, count - 1)))}>
        <canvas ref={ref} />
        {count > 60 ? <em>+{count - 60}</em> : null}
      </button>
      <span className="dx-bear-read">
        <button type="button" disabled={disabled || count <= 0} aria-label={`${label} minus one`} onClick={() => onChange(Math.max(0, count - 1))}>
          −
        </button>
        <input type="number" min={0} disabled={disabled} aria-label={label} value={shown} onChange={(e) => onChange(toPts(e.target.value))} />
        <button type="button" disabled={disabled} aria-label={`${label} plus one`} onClick={() => onChange(count + 1)}>
          +
        </button>
      </span>
      {sub ? <span className="dx-bear-sub">{sub}</span> : null}
    </div>
  )
}

// ── Patch bay ────────────────────────────────────────────────────────

const KIND_GAS: Record<string, string> = { first: "#b49cff", resource: "#7ff0ff", await: "#ff6a4a", unlock: "#bfe3ff" }

function PatchBay({ n }: { n: NodeModel }) {
  const [adding, setAdding] = useState<null | "need" | "unlock">(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [spark, setSpark] = useState<string | null>(null)
  const L = n.needs, R = n.unlocks
  const rows = Math.max(L.length, R.length, 1)
  const H = Math.max(150, rows * 46 + 30)
  const y = (i: number, len: number) => (H / (len + 1)) * (i + 1)
  const live = (r: Ref) => r.state === "open" || r.state === "wait"
  const node = (r: Ref, side: "l" | "r", i: number, len: number) => (
    <div key={r.key} className={`dx-jack is-${r.kind} is-${r.state}${focus === r.key ? " is-focus" : ""}`} style={{ top: y(i, len) - 17, [side === "l" ? "left" : "right"]: 0, ["--gas" as string]: KIND_GAS[r.kind] }}>
      <button type="button" className="dx-jack-name" onClick={() => setFocus(focus === r.key ? null : r.key)} title={`${r.label} · ${r.hint} · ${r.state}`}>
        <i />
        {r.label}
      </button>
      {focus === r.key ? (
        <span className="dx-jack-acts">
          {r.canLog ? (
            <button type="button" onClick={() => (setSpark(r.key), setTimeout(() => (n.act.log(r.id), setSpark(null)), 700))}>
              log
            </button>
          ) : null}
          {r.canOpen ? (
            <button type="button" onClick={() => n.act.open(r)}>
              open
            </button>
          ) : null}
          <button type="button" onClick={() => (n.act.removeNeed(r), setFocus(null))}>
            unplug
          </button>
        </span>
      ) : null}
    </div>
  )
  return (
    <section className="dx-bay" aria-label="Needs and unlocks">
      <header className="dx-sec">
        <h3>Patch bay</h3>
        <span>
          {L.length} in · {R.length} out
        </span>
      </header>
      <div className="dx-bay-board" style={{ height: H }}>
        <svg className="dx-wires" viewBox={`0 0 400 ${H}`} preserveAspectRatio="none" aria-hidden>
          {L.map((r, i) => {
            const d = `M 150 ${y(i, L.length)} C 180 ${y(i, L.length)}, 175 ${H / 2}, 200 ${H / 2}`
            return (
              <g key={r.key} className={`dx-wire is-${r.state}`} style={{ ["--gas" as string]: KIND_GAS[r.kind] }}>
                <path d={d} />
                {live(r) ? <path d={d} className="dx-wire-flow" /> : null}
                {spark === r.key ? <circle r="5" className="dx-spark"><animateMotion dur="0.7s" path={d} fill="freeze" /></circle> : null}
              </g>
            )
          })}
          {R.map((r, i) => (
            <g key={r.key} className={`dx-wire is-${n.state === "done" ? "done" : "open"}`} style={{ ["--gas" as string]: KIND_GAS.unlock }}>
              <path d={`M 200 ${H / 2} C 225 ${H / 2}, 220 ${y(i, R.length)}, 250 ${y(i, R.length)}`} />
              {n.state !== "done" ? <path d={`M 200 ${H / 2} C 225 ${H / 2}, 220 ${y(i, R.length)}, 250 ${y(i, R.length)}`} className="dx-wire-flow" /> : null}
            </g>
          ))}
        </svg>
        <div className="dx-bay-col is-l">{L.length ? L.map((r, i) => node(r, "l", i, L.length)) : <p className="dx-quiet" style={{ top: H / 2 - 10 }}>Needs nothing yet.</p>}</div>
        <div className={`dx-core is-${n.state}`} style={{ top: H / 2 - 22 }}>
          <span>{n.state}</span>
        </div>
        <div className="dx-bay-col is-r">{R.map((r, i) => node(r, "r", i, R.length))}</div>
      </div>
      <div className="dx-ports">
        <button type="button" className="dx-port" aria-pressed={adding === "need"} onClick={() => setAdding(adding === "need" ? null : "need")}>
          <i /> Plug a need
        </button>
        <button type="button" className="dx-port" aria-pressed={adding === "unlock"} disabled={!n.unlockOptions.length} onClick={() => setAdding(adding === "unlock" ? null : "unlock")}>
          <i /> Make {n.isTask ? "a task" : "a step"} wait on this
        </button>
      </div>
      {adding === "need" ? <AddNeed cls="dx" n={n} onDone={() => setAdding(null)} /> : null}
      {adding === "unlock" ? <Picker cls="dx" placeholder={`Make ${n.isTask ? "a task" : "a step"} wait on this…`} options={n.unlockOptions} onPick={n.act.addUnlock} onDone={() => setAdding(null)} /> : null}
    </section>
  )
}

// ── Notes: phosphor log ──────────────────────────────────────────────

function Terminal({ n }: { n: NodeModel }) {
  const [draft, setDraft] = useState("")
  const [fresh, setFresh] = useState<string | null>(null)
  const send = () => {
    if (!draft.trim()) return
    n.act.addNote(draft)
    setFresh(draft.trim())
    setDraft("")
  }
  return (
    <section className="dx-term" aria-label="Notes">
      <header className="dx-sec">
        <h3>
          Log {n.due ? <i className="dx-due" title="Pushed 3+ times. A note here quiets the dot." /> : null}
        </h3>
        <span>{n.notes.length} entries</span>
      </header>
      <div className="dx-term-screen">
        <label className="dx-prompt">
          <span>&gt;</span>
          <textarea rows={2} value={draft} placeholder={n.due ? NOTE_PROMPT : "a note on this task…"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), send())} />
        </label>
        <button type="button" className="dx-send" disabled={!draft.trim()} onClick={send}>
          LOG ⌘↩
        </button>
        <ol>
          {n.notes.map((a) => (
            <li key={a.id}>
              <time>{noteDate(a.date)}</time>
              <p>
                <TypeOn text={a.text} on={fresh === a.text} />
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ── Plate ────────────────────────────────────────────────────────────

export function MockDischarge({ n, showMath }: { n: NodeModel; showMath: boolean }) {
  const [hits, setHits] = useState(0)
  const [strike, setStrike] = useState(false)
  const doneFlash = useFlash(n.state)
  useEffect(() => {
    if (hits < 5) return
    setStrike(true)
    setHits(0)
    const t = setTimeout(() => setStrike(false), 1600)
    return () => clearTimeout(t)
  }, [hits])
  const p = n.points
  const tierGas: Record<StepTier, string> = { min: GAS.min.hue, goal: GAS.goal.hue, exceptional: GAS.exceptional.hue }
  return (
    <article className={`dx${strike ? " is-strike" : ""}${doneFlash}`}>
      <div className="dx-glare" aria-hidden />
      <header className="dx-head">
        <p className="dx-path">{n.path.join("  ›  ")}</p>
        <h2>{n.name}</h2>
        <div className="dx-tubes">
          <Tube gas={n.state} label={n.state} striking={strike} onClick={() => setHits((h) => h + 1)} />
          {n.tier ? <Tube gas={n.tier} label={n.tier === "min" ? "bare min" : n.tier} striking={strike} /> : null}
          <div className="dx-nixies">
            <Nixie value={String(n.est)} unit="est" />
            <Nixie value={String(n.spent)} unit="spent" />
            {n.ends ? <Nixie value={`${n.ends.done}/${n.ends.leaves}`} unit="ends" /> : null}
          </div>
        </div>
      </header>

      <Scope est={n.est} spent={n.spent} math={n.math} showMath={showMath} />

      <section className="dx-pts" aria-label="Points">
        <header className="dx-sec">
          <h3>Points</h3>
          <span className="dx-total">{p.total}</span>
          {p.canByLevel ? (
            <span className="dx-seg" role="group" aria-label="Points mode">
              <button type="button" aria-pressed={!p.byLevel} onClick={() => n.act.setByLevel(false)}>
                On done
              </button>
              <button type="button" aria-pressed={p.byLevel} onClick={() => n.act.setByLevel(true)}>
                By level
              </button>
            </span>
          ) : null}
        </header>
        <div className="dx-bears">
          {p.byLevel ? (
            p.rungs.map((r) => <Bearings key={r.tier} label={r.short} gas={tierGas[r.tier]} count={r.value ?? 0} disabled={!r.inside} onChange={(v) => n.act.setRung(r.tier, v)} sub={!r.inside ? "no step" : r.reached ? "reached ●" : r.label} />)
          ) : (
            <Bearings label="On done" count={p.onDone.value ?? p.onDone.fallback ?? 0} onChange={n.act.setOnDone} sub={p.onDone.caption} />
          )}
          {p.each.show ? <Bearings label="Each step" gas="#7ff0ff" count={p.each.value ?? p.each.fallback ?? 0} onChange={n.act.setEach} sub={p.each.caption} /> : null}
        </div>
        {p.onDone.resetTo != null && !p.byLevel ? (
          <button type="button" className="dx-reset" onClick={() => n.act.setOnDone(undefined)}>
            ↺ Back to {n.isTask ? "the rule" : "inherited"} ({p.onDone.resetTo})
          </button>
        ) : null}
      </section>

      <PatchBay n={n} />

      <div className="dx-keys">
        {!n.isTask ? (
          <button type="button" className="dx-key" onClick={n.act.openStepItem}>
            ↗ Step item
          </button>
        ) : null}
        <button type="button" className="dx-key is-strike" onClick={() => (setStrike(true), setTimeout(() => setStrike(false), 1200), n.act.toggleDone())}>
          {n.state === "done" ? "Reopen" : "Strike done"}
        </button>
      </div>

      <Terminal n={n} />
    </article>
  )
}
