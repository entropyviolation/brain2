/**
 * components/Lab/NodeDetailLab/MockArcade.tsx — Concept IV · Cabinet
 *
 * A video-game control panel. CRT marquee with the quest name and stage path.
 * TIME is a health bar that drains from est (red once past it); ENDS is the
 * XP bar. Points sit on 7-segment counters driven by convex arcade buttons.
 * Needs are an inventory grid (⚔ task first, ✦ resource, ⌛ awaiting; USE logs
 * an event). Unlocks are doors. Notes are a dialog box that types itself.
 * Done is a big CLEAR button: STAGE CLEAR with coins. Eggs: ↑↑↓↓←→←→BA turns
 * on TURBO palette; SOUND switch for blips.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { AddNeed, Picker, toPts, TypeOn, useCountUp } from "./kit"
import { fmtPct, noteDate, NOTE_PROMPT, type NodeModel, type Ref } from "./model"

const ICON: Record<string, string> = { first: "⚔", resource: "✦", await: "⌛", unlock: "⛩" }
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]

let audio: AudioContext | null = null
function blip(on: boolean, f = 660, ms = 70) {
  if (!on) return
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = "square"
    o.frequency.value = f
    g.gain.value = 0.04
    o.connect(g).connect(audio.destination)
    o.start()
    o.frequency.exponentialRampToValueAtTime(f * 1.5, audio.currentTime + ms / 1000)
    o.stop(audio.currentTime + ms / 1000)
  } catch {
    /* no audio */
  }
}

function Seg({ value, digits = 3, color = "red" }: { value: number; digits?: number; color?: "red" | "green" | "blue" }) {
  const v = useCountUp(value, 350)
  const s = String(Math.min(v, 10 ** digits - 1)).padStart(digits, " ")
  return (
    <span className={`ar-seg is-${color}`} aria-label={String(value)}>
      <span className="ar-seg-ghost">{"8".repeat(digits)}</span>
      <span className="ar-seg-lit">{s}</span>
    </span>
  )
}

function Btn({ color, label, onClick, disabled, big, sound }: { color: "red" | "blue" | "green" | "white"; label: string; onClick: () => void; disabled?: boolean; big?: boolean; sound: boolean }) {
  return (
    <button type="button" className={`ar-btn is-${color}${big ? " is-big" : ""}`} disabled={disabled} aria-label={label} title={label} onClick={() => (blip(sound, color === "red" ? 330 : 660), onClick())}>
      <span className="ar-btn-cap" />
      <span className="ar-btn-label">{label}</span>
    </button>
  )
}

function Counter({ title, value, onChange, disabled, sub, color, sound, fallback }: { title: string; value?: number; fallback?: number; onChange: (v: number | undefined) => void; disabled?: boolean; sub?: string; color?: "red" | "green" | "blue"; sound: boolean }) {
  const base = value ?? fallback ?? 0
  const [edit, setEdit] = useState(false)
  return (
    <div className={`ar-counter${disabled ? " is-off" : ""}`}>
      <span className="ar-plate">{title}</span>
      {edit ? (
        <input autoFocus type="number" min={0} className="ar-seg-input" defaultValue={value ?? ""} onBlur={(e) => (onChange(toPts(e.target.value)), setEdit(false))} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      ) : (
        <button type="button" className="ar-seg-btn" disabled={disabled} onClick={() => setEdit(true)} title="Click to type a value">
          <Seg value={base} color={color} />
        </button>
      )}
      <span className="ar-pair">
        <Btn color="blue" label="−" sound={sound} disabled={disabled || base <= 0} onClick={() => onChange(Math.max(0, base - 1))} />
        <Btn color="red" label="+" sound={sound} disabled={disabled} onClick={() => onChange(base + 1)} />
      </span>
      {sub ? <span className="ar-sub">{sub}</span> : null}
    </div>
  )
}

function Bar({ label, frac, over, color, right }: { label: string; frac: number; over?: number; color: string; right: string }) {
  const cells = 20
  const lit = Math.round(Math.max(0, Math.min(1, frac)) * cells)
  return (
    <div className="ar-bar" style={{ ["--c" as string]: color }}>
      <span className="ar-bar-label">{label}</span>
      <span className="ar-bar-cells">
        {Array.from({ length: cells }, (_, i) => (
          <i key={i} className={i < lit ? "is-on" : undefined} />
        ))}
        {over ? <b className="ar-bar-over">+{over}</b> : null}
      </span>
      <span className="ar-bar-right">{right}</span>
    </div>
  )
}

function Slot({ r, n, sound }: { r: Ref; n: NodeModel; sound: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`ar-slot is-${r.kind} is-${r.state}${open ? " is-open" : ""}`}>
      <button type="button" className="ar-slot-face" onClick={() => (blip(sound, 880, 40), setOpen(!open))} title={`${r.label} · ${r.hint} · ${r.state}`}>
        <span className="ar-slot-icon">{ICON[r.kind]}</span>
        {r.state === "open" || r.state === "wait" ? <span className="ar-lock">🔒</span> : r.state === "done" ? <span className="ar-check">✓</span> : null}
        <span className="ar-slot-name">{r.label}</span>
      </button>
      {open ? (
        <span className="ar-slot-menu">
          {r.canLog ? (
            <button type="button" onClick={() => (blip(sound, 990, 120), n.act.log(r.id))}>
              ▶ USE
            </button>
          ) : null}
          {r.canOpen ? (
            <button type="button" onClick={() => n.act.open(r)}>
              ▶ VIEW
            </button>
          ) : null}
          <button type="button" onClick={() => (blip(sound, 200, 90), n.act.removeNeed(r))}>
            ▶ DROP
          </button>
        </span>
      ) : null}
    </div>
  )
}

function Clear({ points, onEnd }: { points: number; onEnd: () => void }) {
  const v = useCountUp(points, 900)
  useEffect(() => {
    const t = setTimeout(onEnd, 2300)
    return () => clearTimeout(t)
  }, [onEnd])
  return (
    <div className="ar-clear" onClick={onEnd}>
      {Array.from({ length: 18 }, (_, i) => (
        <i key={i} className="ar-coin" style={{ ["--x" as string]: `${(i * 37) % 100}%`, ["--d" as string]: `${(i % 6) * 0.08}s` }} />
      ))}
      <b>STAGE CLEAR!</b>
      <span>+{v} PTS</span>
    </div>
  )
}

export function MockArcade({ n, showMath }: { n: NodeModel; showMath: boolean }) {
  const [sound, setSound] = useState(false)
  const [turbo, setTurbo] = useState(false)
  const [clear, setClear] = useState(false)
  const [adding, setAdding] = useState<null | "need" | "unlock">(null)
  const [draft, setDraft] = useState("")
  const [fresh, setFresh] = useState<string | null>(null)
  const seq = useRef<string[]>([])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return
      seq.current = [...seq.current, e.key].slice(-KONAMI.length)
      if (seq.current.join() === KONAMI.join()) (setTurbo((t) => !t), blip(true, 1200, 300))
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
  const p = n.points
  const timeLeft = Math.max(0, n.est - n.spent)
  const send = () => draft.trim() && (n.act.addNote(draft), setFresh(draft.trim()), setDraft(""), blip(sound, 520, 60))
  const stage = n.isTask ? "WORLD" : `STAGE ${n.path.length}-${(n.name.length % 9) + 1}`
  return (
    <article className={`ar${turbo ? " is-turbo" : ""}`}>
      <div className="ar-marquee">
        <div className="ar-crt">
          <p className="ar-stage">
            {stage} <span>{n.path.join(" ▸ ")}</span>
          </p>
          <h2>{n.name}</h2>
          <p className="ar-status">
            <span className={`ar-led is-${n.state}`} /> {n.state === "done" ? "CLEARED" : n.state === "locked" ? "LOCKED" : "IN PLAY"}
            {n.tier ? <span className={`ar-badge is-${n.tier}`}>{n.tier === "min" ? "B" : n.tier === "goal" ? "G" : "E"}</span> : null}
            <span className="ar-blink">{n.state === "done" ? "" : "PRESS ▶ TO PLAY"}</span>
          </p>
        </div>
      </div>

      <div className="ar-hud">
        <Bar label="TIME" frac={n.est ? timeLeft / n.est : 0} over={n.spent > n.est ? n.spent - n.est : undefined} color={n.spent > n.est ? "#ff3b3b" : "#3bff7a"} right={`${n.spent}/${n.est}m`} />
        {n.ends ? <Bar label="ENDS" frac={n.ends.done / n.ends.leaves} color="#3bb4ff" right={`${n.ends.done}/${n.ends.leaves}`} /> : null}
        {showMath && n.math ? (
          <p className="ar-math">
            ρ {fmtPct(n.math.rho)} = Σd/ΣL &nbsp; σ {fmtPct(n.math.sigma)} = mean d/L
          </p>
        ) : null}
      </div>

      <section className="ar-deck" aria-label="Points">
        <header className="ar-deck-head">
          <span className="ar-plate is-wide">SCORE {p.total}</span>
          {p.canByLevel ? (
            <span className="ar-toggle" role="group" aria-label="Points mode">
              <button type="button" aria-pressed={!p.byLevel} onClick={() => (blip(sound), n.act.setByLevel(false))}>
                ON DONE
              </button>
              <button type="button" aria-pressed={p.byLevel} onClick={() => (blip(sound), n.act.setByLevel(true))}>
                BY LEVEL
              </button>
            </span>
          ) : null}
        </header>
        <div className="ar-counters">
          {p.byLevel ? (
            p.rungs.map((r) => <Counter key={r.tier} title={`${r.short}${r.reached ? " ★" : ""}`} value={r.value} onChange={(v) => n.act.setRung(r.tier, v)} disabled={!r.inside} sub={r.inside ? r.label : "no step"} color={r.tier === "min" ? "green" : r.tier === "goal" ? "blue" : "red"} sound={sound} />)
          ) : (
            <Counter title="ON DONE" value={p.onDone.value} fallback={p.onDone.fallback} onChange={n.act.setOnDone} sub={p.onDone.caption} sound={sound} />
          )}
          {p.each.show ? <Counter title="EACH STEP" value={p.each.value} fallback={p.each.fallback} onChange={n.act.setEach} sub={p.each.caption} color="green" sound={sound} /> : null}
        </div>
        {p.onDone.resetTo != null && !p.byLevel ? (
          <button type="button" className="ar-text-btn" onClick={() => n.act.setOnDone(undefined)}>
            ↺ CONTINUE? use {n.isTask ? "rule" : "inherited"} {p.onDone.resetTo}
          </button>
        ) : null}
      </section>

      <section className="ar-deck" aria-label="Needs">
        <header className="ar-deck-head">
          <span className="ar-plate is-wide">INVENTORY</span>
          <span className="ar-legend">⚔ first · ✦ resource · ⌛ awaiting</span>
        </header>
        <div className="ar-grid">
          {n.needs.map((r) => (
            <Slot key={r.key} r={r} n={n} sound={sound} />
          ))}
          <button type="button" className="ar-slot is-empty" onClick={() => (blip(sound, 440), setAdding(adding === "need" ? null : "need"))} aria-pressed={adding === "need"}>
            <span className="ar-slot-icon">＋</span>
            <span className="ar-slot-name">{n.needs.length ? "ADD" : "Needs nothing yet"}</span>
          </button>
        </div>
        {adding === "need" ? <AddNeed cls="ar" n={n} onDone={() => setAdding(null)} /> : null}
        <header className="ar-deck-head">
          <span className="ar-plate is-wide">UNLOCKS NEXT</span>
        </header>
        <div className="ar-grid">
          {n.unlocks.map((r) => (
            <Slot key={r.key} r={r} n={n} sound={sound} />
          ))}
          <button type="button" className="ar-slot is-empty" disabled={!n.unlockOptions.length} onClick={() => (blip(sound, 440), setAdding(adding === "unlock" ? null : "unlock"))}>
            <span className="ar-slot-icon">⛩</span>
            <span className="ar-slot-name">{n.isTask ? "Make a task wait" : "Make a step wait"}</span>
          </button>
        </div>
        {adding === "unlock" ? <Picker cls="ar" placeholder="Choose who waits on this…" options={n.unlockOptions} onPick={n.act.addUnlock} onDone={() => setAdding(null)} /> : null}
      </section>

      <section className="ar-controls">
        <Btn color="green" big label={n.state === "done" ? "RETRY" : "CLEAR"} sound={sound} onClick={() => (n.state !== "done" && setClear(true), n.act.toggleDone())} />
        <Btn color="blue" label="▶ +5m" sound={sound} onClick={() => n.act.tick(5)} />
        {!n.isTask ? <Btn color="white" label="↗ ITEM" sound={sound} onClick={n.act.openStepItem} /> : null}
        <label className="ar-switch">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          <span />
          SOUND
        </label>
      </section>

      <section className="ar-dialog" aria-label="Notes">
        <header>
          <span>QUEST LOG</span>
          <span>
            {n.notes.length} {n.due ? <i className="ar-due" title="Pushed 3+ times. A note here quiets the dot." /> : null}
          </span>
        </header>
        <textarea rows={2} value={draft} aria-label="Note" placeholder={n.due ? NOTE_PROMPT : "Write a line in the log…"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), send())} />
        <button type="button" className="ar-text-btn" disabled={!draft.trim()} onClick={send}>
          ▶ LOG (⌘↩)
        </button>
        <ol>
          {n.notes.map((a) => (
            <li key={a.id}>
              <time>{noteDate(a.date)}</time>
              <p>
                <TypeOn text={a.text} speed={40} on={fresh === a.text} />
              </p>
            </li>
          ))}
        </ol>
        <span className="ar-caret">▼</span>
      </section>
      {clear ? <Clear points={p.total} onEnd={() => setClear(false)} /> : null}
    </article>
  )
}
