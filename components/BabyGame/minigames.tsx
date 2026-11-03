/**
 * components/BabyGame/minigames.tsx — The four mini games, each a small plate with its own loop
 *
 * Firefly Glade (a night canvas, pointer or arrows + space), Mossfall Hop (stones up a waterfall), Echo Flower
 * (a memory tune), and Stair Weave (turn the stairs). Each one calls `onDone(grade)` once. The rules and grades are in
 * `lib/baby-game/minigames.ts`; what a grade pays is `engine.playMinigame`. Nothing here touches the save.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FALLS, ECHO, GLADE, MINIGAMES, echoGrade, echoSequence, fallsGrade, gladeGrade, rotateStair, stairGrade, stairPuzzle, stairSolved, STAIR_N, type MinigameId } from "@/lib/baby-game/minigames"
import { paintGrid, playerGrid } from "@/lib/baby-game/sprites"
import { Plate } from "./panels"

type Grade = 0 | 1 | 2
type Props = { seed: number; onDone: (grade: Grade) => void; onLeave: () => void }

const W = 304
const H = 176

const key = (label: string, onClick: () => void, primary = false, disabled = false) => (
  <button type="button" className={`friend-key bg-key${primary ? " is-primary" : ""}`} data-no95="" onClick={onClick} disabled={disabled}>
    {label}
  </button>
)

function Intro({ game, onStart, onLeave }: { game: MinigameId; onStart: () => void; onLeave: () => void }) {
  const def = MINIGAMES[game]
  return (
    <Plate title={def.name} onClose={onLeave}>
      <p>{def.blurb}</p>
      <p className="bg-faint">Costs {def.cost} energy. The prize comes once a day; playing again is just for fun.</p>
      {key("Start", onStart, true)}
    </Plate>
  )
}

function Result({ title, line, grade, onDone }: { title: string; line: string; grade: Grade; onDone: () => void }) {
  return (
    <Plate title={title}>
      <p>{line}</p>
      <p className="bg-faint">{["Not this time.", "Well played.", "Perfect!"][grade]}</p>
      {key("Collect", onDone, true)}
    </Plate>
  )
}

/** A small tone for each note. Silent where there is no audio. */
function beep(freq: number) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.42)
    window.setTimeout(() => void ctx.close(), 600)
  } catch {
    // no audio: the lights are enough
  }
}

const rnd = (a: number) => {
  let t = (a * 2654435761) >>> 0
  t = (t ^ (t >>> 15)) * 2246822519
  return ((t ^ (t >>> 13)) >>> 0) / 4294967296
}

function useCanvasLoop(canvas: HTMLCanvasElement | null, running: boolean, frame: (ctx: CanvasRenderingContext2D, dt: number, t: number) => void) {
  const ref = useRef(frame)
  ref.current = frame
  useEffect(() => {
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !running) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      ref.current(ctx, dt, now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [canvas, running])
}

const fill = (ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// ─── Firefly Glade ─────────────────────────────────────────────────────────

export function FireflyGlade({ seed, onDone, onLeave }: Props) {
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro")
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [caught, setCaught] = useState(0)
  const flies = useRef(
    Array.from({ length: GLADE.count + 4 }, (_, i) => ({ x: 30 + rnd(seed + i) * 240, y: 30 + rnd(seed + i + 50) * 100, a: rnd(seed + i + 90) * 6.28, ph: rnd(seed + i + 130) * 6.28, gone: false })),
  )
  const jar = useRef({ x: W / 2, y: H / 2, shut: 0 })
  const left = useRef(GLADE.seconds)
  const count = useRef(0)
  const keys = useRef(new Set<string>())
  const pops = useRef<Array<{ x: number; y: number; born: number }>>([])
  const glowing = (f: { ph: number }, t: number) => Math.sin(t * 2.2 + f.ph) > 0.1

  const catchNow = () => {
    const j = jar.current
    j.shut = 0.25
    const t = performance.now() / 1000
    for (const f of flies.current) {
      if (!f.gone && glowing(f, t) && Math.hypot(f.x - j.x, f.y - j.y) < 20) {
        f.gone = true
        count.current += 1
        pops.current.push({ x: f.x, y: f.y, born: t })
        setCaught(count.current)
        break
      }
    }
  }

  useEffect(() => {
    if (phase !== "play") return
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(k)) e.preventDefault()
      if (k === " " || k === "enter") {
        if (!e.repeat) catchNow()
      } else keys.current.add(k)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useCanvasLoop(canvas, phase === "play", (ctx, dt, t) => {
    const j = jar.current
    const k = keys.current
    j.x = Math.max(8, Math.min(W - 8, j.x + ((k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0)) * 110 * dt))
    j.y = Math.max(8, Math.min(H - 8, j.y + ((k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0)) * 110 * dt))
    j.shut = Math.max(0, j.shut - dt)
    left.current -= dt
    // the night
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, "#1b2a5e")
    sky.addColorStop(0.6, "#233f7a")
    sky.addColorStop(1, "#1c4a52")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    fill(ctx, "#f4eefc", W - 60, 14, 22, 22)
    fill(ctx, "#cdbfe8", W - 52, 20, 5, 5)
    fill(ctx, "#cdbfe8", W - 44, 27, 4, 4)
    for (let i = 0; i < 8; i++) {
      const tx = i * 44 - 10
      fill(ctx, "#13203f", tx + 14, 40, 8, 100)
      fill(ctx, "#182a52", tx, 20 + (i % 3) * 8, 36, 40)
    }
    fill(ctx, "#12403c", 0, H - 40, W, 40)
    for (let i = 0; i < 30; i++) fill(ctx, i % 2 ? "#1d5a4c" : "#0f3330", (i * 29) % W, H - 40 + ((i * 13) % 36), 3, 6)
    // fireflies
    for (const f of flies.current) {
      if (f.gone) continue
      f.a += (Math.sin(t + f.ph) * 1.4) * dt
      f.x += Math.cos(f.a) * 22 * dt
      f.y += Math.sin(f.a) * 16 * dt
      if (f.x < 12 || f.x > W - 12) f.a = Math.PI - f.a
      if (f.y < 20 || f.y > H - 36) f.a = -f.a
      f.x = Math.max(8, Math.min(W - 8, f.x))
      f.y = Math.max(16, Math.min(H - 32, f.y))
      const on = glowing(f, t)
      if (on) {
        const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 12)
        g.addColorStop(0, "rgba(200,255,190,0.9)")
        g.addColorStop(1, "rgba(200,255,190,0)")
        ctx.fillStyle = g
        ctx.fillRect(f.x - 12, f.y - 12, 24, 24)
      }
      fill(ctx, on ? "#f4ffe8" : "#46605c", f.x - 1, f.y - 1, 3, 3)
    }
    for (const p of pops.current) {
      const age = t - p.born
      ctx.globalAlpha = Math.max(0, 1 - age)
      fill(ctx, "#ffffff", p.x - 1, p.y - age * 20 - 1, 3, 3)
      ctx.globalAlpha = 1
    }
    // the jar
    const open = j.shut === 0
    fill(ctx, "rgba(230,245,255,0.35)", j.x - 8, j.y - 9, 16, 18)
    fill(ctx, "#cfe8ff", j.x - 8, j.y - 9, 2, 18)
    fill(ctx, "#cfe8ff", j.x + 6, j.y - 9, 2, 18)
    fill(ctx, "#cfe8ff", j.x - 8, j.y + 7, 16, 2)
    fill(ctx, open ? "#9a72e0" : "#f0609a", j.x - 9, j.y - 12, 18, 3)
    ctx.fillStyle = "#fff"
    ctx.font = "10px monospace"
    ctx.fillText(`${count.current} caught · ${Math.max(0, Math.ceil(left.current))}s`, 8, 12)
    if (left.current <= 0) setPhase("end")
  })

  if (phase === "intro") return <Intro game="glade" onStart={() => setPhase("play")} onLeave={onLeave} />
  if (phase === "end") return <Result title="Firefly Glade" line={`You caught ${caught} fireflies.`} grade={gladeGrade(caught)} onDone={() => onDone(gladeGrade(caught))} />
  return (
    <Plate title="Firefly Glade" onClose={onLeave} wide>
      <canvas
        ref={setCanvas}
        width={W}
        height={H}
        className="bg-mini-canvas"
        aria-label="Firefly Glade: move the jar with the pointer or arrow keys, catch with click or space"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          jar.current.x = ((e.clientX - r.left) / r.width) * W
          jar.current.y = ((e.clientY - r.top) / r.height) * H
        }}
        onPointerDown={() => catchNow()}
      />
      <p className="bg-faint">Move the jar with the pointer or arrow keys. Click or press space when a firefly is glowing inside it.</p>
    </Plate>
  )
}

// ─── Mossfall Hop ──────────────────────────────────────────────────────────

const ROW_Y = (r: number) => H - 26 - r * 30
const STONE_W = 40

export function MossfallHop({ seed, onDone, onLeave }: Props) {
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro")
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState({ falls: 0, reached: false })
  const rows = useRef(
    Array.from({ length: FALLS.rows }, (_, i) => {
      const dir = i % 2 ? -1 : 1
      const speed = (26 + rnd(seed + i) * 26) * dir
      return { speed, stones: [0, 1, 2].map((n) => ({ x: n * 112 + rnd(seed + i * 7 + n) * 40 })) }
    }),
  )
  const me = useRef({ row: 0, x: W / 2, on: -1, splash: 0, hop: 0, goal: false })
  const falls = useRef(0)
  const sprite = useMemo(() => {
    if (typeof document === "undefined") return null
    const c = document.createElement("canvas")
    c.width = c.height = 32
    const ctx = c.getContext("2d")
    if (!ctx) return null
    paintGrid(ctx, playerGrid("front"), 0, 0, 1)
    return c
  }, [])

  const hop = () => {
    const p = me.current
    if (p.splash > 0 || phase !== "play") return
    const next = p.row + 1
    if (next > FALLS.rows) return
    p.hop = 0.18
    if (next === FALLS.rows + 1) {
      p.goal = true
      return
    }
    const stones = rows.current[next - 1]!.stones
    const idx = stones.findIndex((s) => p.x >= s.x - 2 && p.x <= s.x + STONE_W + 2)
    if (idx >= 0) {
      p.row = next
      p.on = idx
    } else {
      p.splash = 0.8
    }
  }

  const finish = (reached: boolean) => {
    setStatus({ falls: falls.current, reached })
    setPhase("end")
  }

  useEffect(() => {
    if (phase !== "play") return
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(k)) e.preventDefault()
      if (k === " " || k === "enter" || k === "arrowup" || k === "w") {
        if (!e.repeat) hop()
      } else if (k === "arrowleft" || k === "a") me.current.x -= 12
      else if (k === "arrowright" || k === "d") me.current.x += 12
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  })

  useCanvasLoop(canvas, phase === "play", (ctx, dt, t) => {
    const p = me.current
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, "#d6efe4")
    sky.addColorStop(1, "#8cc8c0")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    // light shafts
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.18)"
      ctx.beginPath()
      ctx.moveTo(40 + i * 70, 0)
      ctx.lineTo(70 + i * 70, 0)
      ctx.lineTo(10 + i * 70, H)
      ctx.lineTo(-10 + i * 70, H)
      ctx.fill()
    }
    // the fall
    fill(ctx, "#9fb8a8", 0, 0, 40, H)
    fill(ctx, "#9fb8a8", W - 40, 0, 40, H)
    for (let i = 0; i < 28; i++) fill(ctx, i % 3 ? "#e8f4ff" : "#b5d8f6", 44 + ((i * 17) % (W - 88)), ((t * 90 + i * 31) % H), 2, 14)
    fill(ctx, "#7fb7e8", 40, ROW_Y(0) + 6, W - 80, 30)
    // stones
    rows.current.forEach((row, ri) => {
      for (const s of row.stones) {
        s.x += row.speed * dt
        if (row.speed > 0 && s.x > W) s.x = -STONE_W
        if (row.speed < 0 && s.x < -STONE_W) s.x = W
        const y = ROW_Y(ri + 1)
        fill(ctx, "#6b5a68", s.x, y + 3, STONE_W, 9)
        fill(ctx, "#8fbf6a", s.x - 1, y - 1, STONE_W + 2, 6)
        fill(ctx, "#b6f0a4", s.x + 3, y - 1, 8, 2)
        fill(ctx, "#4f8f4a", s.x + 20, y + 4, 6, 2)
      }
    })
    fill(ctx, "#8fbf6a", 0, ROW_Y(0) + 8, 44, 24)
    fill(ctx, "#8fbf6a", W - 44, ROW_Y(0) + 8, 44, 24)
    fill(ctx, "#6b5a68", 0, ROW_Y(FALLS.rows + 1) + 8, W, 14)
    fill(ctx, "#8fbf6a", 0, ROW_Y(FALLS.rows + 1) + 4, W, 6)
    // you
    if (p.splash > 0) {
      p.splash -= dt
      for (let i = 0; i < 6; i++) fill(ctx, "#ffffff", p.x - 8 + i * 3, ROW_Y(p.row) - 6 - Math.abs(Math.sin(t * 12 + i)) * 10, 2, 2)
      if (p.splash <= 0) {
        falls.current += 1
        p.row = 0
        p.x = W / 2
        p.on = -1
        setStatus({ falls: falls.current, reached: false })
        if (falls.current >= FALLS.lives) finish(false)
      }
    } else {
      if (p.row >= 1 && p.row <= FALLS.rows) {
        const st = rows.current[p.row - 1]!
        p.x += st.speed * dt
        if (p.x < 4 || p.x > W - 4) p.splash = 0.8
      }
      p.hop = Math.max(0, p.hop - dt)
      p.x = Math.max(4, Math.min(W - 4, p.x))
      const lift = p.hop > 0 ? Math.sin((p.hop / 0.18) * Math.PI) * 10 : 0
      const baseY = p.row === 0 ? ROW_Y(0) + 8 : ROW_Y(p.row)
      if (sprite) ctx.drawImage(sprite, Math.round(p.x - 16), Math.round(baseY - 29 - lift))
    }
    ctx.fillStyle = "#1b2a3a"
    ctx.font = "10px monospace"
    ctx.fillText(`row ${p.row}/${FALLS.rows + 1} · falls ${falls.current}/${FALLS.lives}`, 46, 12)
  })

  // hopping from the top stone to the ledge ends the game
  useEffect(() => {
    if (phase !== "play") return
    const timer = window.setInterval(() => {
      const p = me.current
      if (p.goal) finish(true)
    }, 60)
    return () => window.clearInterval(timer)
  })

  if (phase === "intro") return <Intro game="falls" onStart={() => setPhase("play")} onLeave={onLeave} />
  if (phase === "end")
    return (
      <Result
        title="Mossfall Hop"
        line={status.reached ? `Across, with ${status.falls} splash${status.falls === 1 ? "" : "es"}.` : "Three splashes. The waterfall is very patient."}
        grade={fallsGrade(status.reached, status.falls)}
        onDone={() => onDone(fallsGrade(status.reached, status.falls))}
      />
    )
  return (
    <Plate title="Mossfall Hop" onClose={onLeave} wide>
      <canvas ref={setCanvas} width={W} height={H} className="bg-mini-canvas" aria-label="Mossfall Hop" onPointerDown={() => hop()} />
      <div className="bg-mini-row">
        {key("◀", () => (me.current.x -= 12))}
        {key("Hop", hop, true)}
        {key("▶", () => (me.current.x += 12))}
      </div>
      <p className="bg-faint">Space or Hop jumps to the next row, if a stone is under you. Arrows nudge you along your stone.</p>
    </Plate>
  )
}

// ─── Echo Flower ───────────────────────────────────────────────────────────

const PETALS = [
  { color: "#f0609a", note: 262, name: "pink" },
  { color: "#30b8a8", note: 330, name: "teal" },
  { color: "#9a72e0", note: 392, name: "lilac" },
  { color: "#4e9ce8", note: 523, name: "blue" },
]

export function EchoFlower({ seed, onDone, onLeave }: Props) {
  const tune = useMemo(() => echoSequence(seed), [seed])
  const [phase, setPhase] = useState<"intro" | "show" | "you" | "end">("intro")
  const [cleared, setCleared] = useState(0)
  const [lit, setLit] = useState<number | null>(null)
  const [at, setAt] = useState(0)
  const timers = useRef<number[]>([])

  const length = cleared + 2
  const flash = (petal: number, ms = 360) => {
    setLit(petal)
    beep(PETALS[petal]!.note)
    timers.current.push(window.setTimeout(() => setLit(null), ms))
  }

  useEffect(() => {
    if (phase !== "show") return
    setAt(0)
    tune.slice(0, length).forEach((petal, i) => timers.current.push(window.setTimeout(() => flash(petal), 500 + i * 620)))
    timers.current.push(window.setTimeout(() => setPhase("you"), 500 + length * 620))
    return () => {
      timers.current.forEach((x) => window.clearTimeout(x))
      timers.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, length, tune])

  const press = (petal: number) => {
    if (phase !== "you") return
    flash(petal, 220)
    if (petal !== tune[at]) {
      setPhase("end")
      return
    }
    if (at + 1 === length) {
      const next = cleared + 1
      setCleared(next)
      if (next >= ECHO.max - 1) setPhase("end")
      else timers.current.push(window.setTimeout(() => setPhase("show"), 700))
      setAt(0)
    } else setAt(at + 1)
  }

  if (phase === "intro")
    return <Intro game="echo" onStart={() => setPhase("show")} onLeave={onLeave} />
  if (phase === "end") return <Result title="Echo Flower" line={`You sang back ${cleared} tune${cleared === 1 ? "" : "s"}.`} grade={echoGrade(cleared)} onDone={() => onDone(echoGrade(cleared))} />
  return (
    <Plate title="Echo Flower" onClose={onLeave}>
      <div className="bg-echo" aria-label="Echo Flower">
        <div className="bg-echo-beam" aria-hidden="true" />
        <div className="bg-echo-flower">
          {PETALS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              className={`bg-petal bg-petal-${i}${lit === i ? " is-lit" : ""}`}
              style={{ ["--petal" as string]: p.color }}
              aria-label={`${p.name} petal`}
              onClick={() => press(i)}
              disabled={phase !== "you"}
            />
          ))}
          <span className="bg-echo-face" aria-hidden="true">{phase === "you" ? "◡" : "◠"}</span>
        </div>
      </div>
      <p className="bg-faint">{phase === "show" ? "Listen and watch…" : `Your turn: ${at + 1} of ${length}.`} Tunes sung back: {cleared}.</p>
    </Plate>
  )
}

// ─── Stair Weave ───────────────────────────────────────────────────────────

const ARROWS = ["▲", "▶", "▼", "◀"]

export function StairWeave({ seed, onDone, onLeave }: Props) {
  const initial = useMemo(() => stairPuzzle(seed), [seed])
  const [puzzle, setPuzzle] = useState<{ arrows: number[]; start: number; goal: number }>(initial)
  const [turns, setTurns] = useState(0)
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro")
  const solved = stairSolved(puzzle)

  // the cells you would walk through right now
  const trail = useMemo(() => {
    const out = new Set<number>()
    let at = puzzle.start
    while (!out.has(at)) {
      out.add(at)
      if (at === puzzle.goal) break
      const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][puzzle.arrows[at]!]!
      const x = (at % STAIR_N) + d[0]!
      const y = Math.floor(at / STAIR_N) + d[1]!
      if (x < 0 || y < 0 || x >= STAIR_N || y >= STAIR_N) break
      at = y * STAIR_N + x
    }
    return out
  }, [puzzle])

  useEffect(() => {
    if (phase === "play" && solved) {
      const timer = window.setTimeout(() => setPhase("end"), 700)
      return () => window.clearTimeout(timer)
    }
  }, [phase, solved])

  if (phase === "intro") return <Intro game="stairs" onStart={() => setPhase("play")} onLeave={onLeave} />
  const grade = stairGrade(turns, initial.par)
  if (phase === "end") return <Result title="Stair Weave" line={`Solved in ${turns} turns (par ${initial.par}).`} grade={grade} onDone={() => onDone(grade)} />
  return (
    <Plate title="Stair Weave" onClose={onLeave}>
      <div className="bg-stairs" role="grid" aria-label="Stair Weave">
        {puzzle.arrows.map((a, i) => (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={`bg-stair${trail.has(i) ? " is-trail" : ""}${i === puzzle.start ? " is-start" : ""}${i === puzzle.goal ? " is-goal" : ""}`}
            onClick={() => {
              if (solved) return
              setPuzzle(rotateStair(puzzle, i))
              setTurns(turns + 1)
            }}
            aria-label={`stair ${i + 1}, pointing ${["up", "right", "down", "left"][a]}`}
          >
            <b>{i === puzzle.goal ? "⌂" : ARROWS[a]}</b>
            <small>{i === puzzle.start ? "start" : i === puzzle.goal ? "door" : ""}</small>
          </button>
        ))}
      </div>
      <p className="bg-faint">
        Turns: {turns} (par {initial.par}). The lit stairs show where you would walk from the start. {solved ? "A way!" : ""}
      </p>
    </Plate>
  )
}

export const MINIGAME_VIEWS: Record<MinigameId, (p: Props) => React.ReactElement> = {
  glade: FireflyGlade,
  falls: MossfallHop,
  echo: EchoFlower,
  stairs: StairWeave,
}
