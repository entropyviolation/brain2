/**
 * components/Home/Tracking/trk-scope.tsx — Bench-scope front panel parts
 *
 * The Home Tracking desk is built like an oscilloscope front panel (Crotech
 * 3132 / Tek 465B): pale gray panels with a black badge header, pale-green
 * section bands, black fluted knobs on printed scales, cream latching push
 * buttons with the label printed beside each, and small slide switches.
 * Design: `docs/TRACKING_REDESIGN.md`, mockup `docs/mockups/tracking-redesign.html`.
 *
 * Every panel has a chrome screw in each corner. Clicking a screw backs it
 * out a little; the fifth click drops it. A plate on two or more screws stays
 * put. On one screw it pivots and swings as a physical pendulum, the last
 * screw walks itself out, and the plate falls — revealing a pixel Julia set on
 * the dark chassis underneath (house LED colors only). Nothing is stored: a
 * refresh puts every plate back. Controls sit above the plate, so the desk
 * keeps working at every stage. Reduced motion just removes the plate.
 *
 * Looks only. Every control here is a plain button / slider / radio with an
 * accessible name; state lives in the caller.
 */
"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import "./tracking-scope.css"

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

const CORNERS = ["tl", "tr", "bl", "br"] as const
type Corner = (typeof CORNERS)[number]
const SCREW_BASE: Record<Corner, number> = { tl: 17, tr: 58, bl: 99, br: 140 }
const TURNS_TO_DROP = 5

type ScrewState = { turns: number; gone: boolean }

export function ScopePanel({
  as: Tag = "div",
  badge,
  name,
  power = "ON",
  label,
  className,
  head,
  julia = 0,
  children,
  ...rest
}: {
  as?: "div" | "aside" | "section" | "main"
  badge?: string
  name?: ReactNode
  /** Lamp caption on the power LED. Omit the header with `badge` unset. */
  power?: string
  label?: string
  className?: string
  /** Extra header content beside the model name. */
  head?: ReactNode
  /** Which Julia set paints the bare chassis (varies per panel). */
  julia?: number
  children?: ReactNode
  "data-ui-name"?: string
  "data-ui-docs"?: string
}) {
  const plateRef = useRef<HTMLDivElement>(null)
  const screwRefs = useRef<Record<Corner, HTMLSpanElement | null>>({ tl: null, tr: null, bl: null, br: null })
  const [screws, setScrews] = useState<Record<Corner, ScrewState>>(() => ({
    tl: { turns: 0, gone: false },
    tr: { turns: 0, gone: false },
    bl: { turns: 0, gone: false },
    br: { turns: 0, gone: false },
  }))
  const [plateGone, setPlateGone] = useState(false)
  const bare = plateGone

  const turn = useCallback((corner: Corner) => {
    setScrews((current) => {
      const screw = current[corner]
      if (screw.gone) return current
      const turns = screw.turns + 1
      return { ...current, [corner]: { turns, gone: turns >= TURNS_TO_DROP } }
    })
  }, [])

  // Drop each screw that just came out; detach the plate when one or none is left.
  const dropped = useRef<Set<Corner>>(new Set())
  useEffect(() => {
    for (const corner of CORNERS) {
      if (!screws[corner].gone || dropped.current.has(corner)) continue
      dropped.current.add(corner)
      const el = screwRefs.current[corner]
      if (el) fx().dropScrew(el, SCREW_BASE[corner] - TURNS_TO_DROP * 85)
    }
    const left = CORNERS.filter((corner) => !screws[corner].gone)
    if (plateGone || left.length > 1) return
    const plate = plateRef.current
    if (!plate) return
    const pivot = left.length === 1 ? screwRefs.current[left[0]] : null
    const pivotCorner = left.length === 1 ? left[0] : null
    fx().releasePlate(plate, pivot, pivotCorner ? screws[pivotCorner].turns : 0, SCREW_BASE[pivotCorner ?? "tl"])
    setPlateGone(true)
    if (pivotCorner) {
      // The pivot screw now lives in the overlay; its own clicks finish it.
      setScrews((current) => ({ ...current, [pivotCorner]: { ...current[pivotCorner], gone: true } }))
      dropped.current.add(pivotCorner)
    }
  }, [screws, plateGone])

  return (
    <Tag
      className={`trk-scope${bare ? " is-bare" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      {...rest}
    >
      <div className="trk-scope-chassis" aria-hidden>
        {bare ? <JuliaCanvas seed={julia} /> : null}
        {CORNERS.map((corner) => (
          <span key={corner} className="trk-standoff" data-corner={corner} />
        ))}
      </div>
      {plateGone ? null : (
        <div ref={plateRef} className="trk-faceplate" aria-hidden>
          {CORNERS.map((corner) => (
            <span key={corner} className="trk-platehole" data-corner={corner} />
          ))}
        </div>
      )}
      {badge ? (
        <div className="trk-scope-head">
          <span className="trk-scope-badge">{badge}</span>
          {name ? <span className="trk-scope-name">{name}</span> : null}
          {head}
          <span className="trk-scope-pwr" aria-hidden>
            <span className="trk-scope-led" />
            {power}
          </span>
        </div>
      ) : null}
      {children}
      {CORNERS.map((corner) => {
        const screw = screws[corner]
        if (screw.gone) return null
        return (
          <span
            key={corner}
            ref={(el) => {
              screwRefs.current[corner] = el
            }}
            className={`trk-screw${screw.turns ? " is-loose" : ""}`}
            data-corner={corner}
            aria-hidden
            style={
              {
                "--r": `${SCREW_BASE[corner] - screw.turns * 85}deg`,
                "--lift": 1 + screw.turns * 0.09,
                "--turns": screw.turns,
              } as CSSProperties
            }
            onClick={(event) => {
              event.stopPropagation()
              turn(corner)
            }}
          />
        )
      })}
    </Tag>
  )
}

/** A band-labelled box on a scope panel. */
export function ScopeSection({
  band,
  children,
  className,
  grow = false,
}: {
  band: string
  children?: ReactNode
  className?: string
  grow?: boolean
}) {
  return (
    <div className={`trk-scope-sect${grow ? " is-grow" : ""}${className ? ` ${className}` : ""}`}>
      <span className="trk-scope-band">{band}</span>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Push key                                                            */
/* ------------------------------------------------------------------ */

export function PushKey({
  label,
  pressed,
  onClick,
  tone = "cream",
  title,
  note,
  stacked = false,
  disabled = false,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  /** cream = tools (green pilot); mint = flags (ice-blue pilot). */
  tone?: "cream" | "mint"
  title?: string
  note?: ReactNode
  /** Label under the key instead of beside it (sort row). */
  stacked?: boolean
  disabled?: boolean
}) {
  return (
    <div className={`trk-push-cell${stacked ? " is-stacked" : ""}`}>
      <span className="trk-push-hole">
        <button
          type="button"
          className="trk-push"
          data-tone={tone}
          data-no95=""
          aria-pressed={pressed}
          aria-label={label}
          title={title ?? label}
          disabled={disabled}
          onClick={onClick}
        />
      </span>
      <span className="trk-push-label" onClick={disabled ? undefined : onClick} aria-hidden>
        {label}
        {note ? <small>{note}</small> : null}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Slide switch                                                        */
/* ------------------------------------------------------------------ */

export function SlideSwitch<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const at = options.length > 1 ? index / (options.length - 1) : 0
  return (
    <div className="trk-slide" role="radiogroup" aria-label={title}>
      <div className="trk-slide-labels">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-no95=""
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div
        className="trk-slide-track"
        aria-hidden
        onClick={() => onChange(options[(index + 1) % options.length].value)}
      >
        <span className="trk-slide-thumb" style={{ left: `calc((100% - 26px) * ${at} + 2px)` }} />
      </div>
      <span className="trk-slide-cap">{title}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Knob                                                                */
/* ------------------------------------------------------------------ */

export type KnobMark = {
  /** Short text printed on the scale. */
  mark: string
  /** CRT readout under the knob. */
  read: string
  /** Accessible name for the scale mark when marks are buttons. */
  label?: string
}

function pointerAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return (Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI
}

function wrapDegrees(delta: number): number {
  const wrapped = ((delta % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/**
 * Black fluted knob on a printed scale. Grab and rotate (detents), click a
 * scale mark to jump, arrow keys step. A wheel over it does nothing, so the
 * page still scrolls. `exposeMarks` makes the marks real buttons (named by
 * `label`) for controls that read as a choice, like TIME/DIV.
 */
export function ScopeKnob({
  title,
  marks,
  index,
  onIndex,
  ariaLabel,
  valueNow,
  size = 112,
  exposeMarks = false,
}: {
  title: string
  marks: readonly KnobMark[]
  index: number
  onIndex: (index: number) => void
  ariaLabel: string
  /** aria-valuenow; defaults to the index. */
  valueNow?: number
  size?: number
  exposeMarks?: boolean
}) {
  const n = marks.length
  const span = Math.min(270, Math.max(0, (n - 1) * 50))
  const ang = (i: number) => (n > 1 ? -span / 2 + (i * span) / (n - 1) : 0)
  const pol = (deg: number, r: number): [number, number] => {
    const a = ((deg - 90) * Math.PI) / 180
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]
  }
  const grab = useRef<{ index: number; last: number; prev: number; swept: number } | null>(null)
  const current = Math.max(0, Math.min(n - 1, index))
  const set = (i: number) => {
    const next = Math.max(0, Math.min(n - 1, i))
    if (next !== current) onIndex(next)
  }

  const ticks: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pol(ang(i), 31)
    const [x2, y2] = pol(ang(i), 37)
    ticks.push(<line key={`m${i}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1.6} />)
    if (i < n - 1) {
      for (let m = 1; m < 5; m++) {
        const a = ang(i) + ((ang(i + 1) - ang(i)) * m) / 5
        const [a1, b1] = pol(a, 33.5)
        const [a2, b2] = pol(a, 37)
        ticks.push(<line key={`s${i}-${m}`} x1={a1} y1={b1} x2={a2} y2={b2} strokeWidth={0.7} />)
      }
    }
  }
  const [s1x, s1y] = pol(-span / 2, 39)
  const [s2x, s2y] = pol(span / 2, 39)

  return (
    <div className="trk-knob-block">
      <span className="trk-knob-title">{title}</span>
      <div className="trk-knob-dial" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" aria-hidden>
          {n > 1 ? (
            <path d={`M${s1x} ${s1y} A39 39 0 ${span > 180 ? 1 : 0} 1 ${s2x} ${s2y}`} fill="none" strokeWidth={0.9} />
          ) : null}
          {ticks}
        </svg>
        {marks.map((mark, i) => {
          const [x, y] = pol(ang(i), 45.5)
          const common = {
            className: "trk-knob-mark",
            "data-current": i === current ? "true" : undefined,
            style: { left: `${x}%`, top: `${y}%` },
            onClick: () => set(i),
          }
          return exposeMarks ? (
            <button
              key={`${i}-${mark.mark}`}
              type="button"
              data-no95=""
              aria-label={mark.label ?? mark.read}
              aria-pressed={i === current}
              {...common}
            >
              {mark.mark}
            </button>
          ) : (
            <span key={`${i}-${mark.mark}`} aria-hidden {...common}>
              {mark.mark}
            </span>
          )
        })}
        <div
          className="trk-knob"
          role="slider"
          tabIndex={0}
          aria-roledescription="dial"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={valueNow ?? current}
          aria-valuetext={marks[current]?.read}
          style={{ transform: `rotate(${ang(current)}deg)` }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const rect = event.currentTarget.parentElement!.getBoundingClientRect()
            grab.current = { index: current, last: current, prev: pointerAngle(event.clientX, event.clientY, rect), swept: 0 }
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              /* pointer already gone */
            }
          }}
          onPointerMove={(event) => {
            const state = grab.current
            if (!state || n < 2) return
            const rect = event.currentTarget.parentElement!.getBoundingClientRect()
            const a = pointerAngle(event.clientX, event.clientY, rect)
            state.swept += wrapDegrees(a - state.prev)
            state.prev = a
            const detent = Math.max(20, span / (n - 1))
            const next = Math.max(0, Math.min(n - 1, state.index + Math.round(state.swept / detent)))
            if (next === state.last) return
            state.last = next
            onIndex(next)
          }}
          onPointerUp={() => {
            grab.current = null
          }}
          onPointerCancel={() => {
            grab.current = null
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault()
              set(current - 1)
            } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault()
              set(current + 1)
            }
          }}
        >
          <span className="trk-knob-skirt" />
          <span className="trk-knob-grip" />
          <span className="trk-knob-cap" />
        </div>
      </div>
      <div className="trk-scope-crt trk-knob-read" aria-hidden>
        {marks[current]?.read}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bare chassis: pixel Julia set in the house LED colors               */
/* ------------------------------------------------------------------ */

const JULIA = [
  [-0.8, 0.156],
  [-0.7269, 0.1889],
  [-0.4, 0.6],
] as const
const STOPS = [
  [2, 8, 6],
  [8, 50, 36],
  [125, 255, 196],
  [154, 215, 255],
  [163, 92, 255],
  [30, 8, 60],
  [2, 8, 6],
]

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false
}

function JuliaCanvas({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const host = cv?.parentElement
    if (!cv || !host) return
    // jsdom has no canvas; the bare chassis just stays dark there.
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return
    const ctx = cv.getContext?.("2d")
    if (!ctx) return
    const W = Math.max(40, Math.round(host.clientWidth / 3))
    const H = Math.max(40, Math.round(host.clientHeight / 3))
    cv.width = W
    cv.height = H
    const img = ctx.createImageData(W, H)
    const n = new Float32Array(W * H)
    const MAX = 140
    const [cr, ci] = JULIA[seed % JULIA.length]
    const tall = H > W
    const sc = 3.3 / Math.max(W, H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let zr = (tall ? y - H / 2 : x - W / 2) * sc
        let zi = (tall ? x - W / 2 : y - H / 2) * sc
        let k = 0
        while (k < MAX && zr * zr + zi * zi < 16) {
          const t = zr * zr - zi * zi + cr
          zi = 2 * zr * zi + ci
          zr = t
          k++
        }
        n[y * W + x] = k >= MAX ? -1 : (k + 1 - Math.log2(Math.log2(Math.sqrt(zr * zr + zi * zi)))) / MAX
      }
    }
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const draw = (phase: number) => {
      const d = img.data
      for (let i = 0; i < n.length; i++) {
        let r = 1
        let g = 4
        let b = 3
        if (n[i] >= 0) {
          const v = Math.sqrt(n[i])
          const u = (((v * 2.4 + phase) % 1) + 1) % 1 * (STOPS.length - 1)
          const j = Math.floor(u)
          const f = u - j
          const A = STOPS[j]
          const B = STOPS[Math.min(STOPS.length - 1, j + 1)]
          const glow = Math.min(1, v * 2.2)
          r = lerp(A[0], B[0], f) * glow
          g = lerp(A[1], B[1], f) * glow
          b = lerp(A[2], B[2], f) * glow
        }
        d[i * 4] = r
        d[i * 4 + 1] = g
        d[i * 4 + 2] = b
        d[i * 4 + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    draw(0)
    if (prefersReducedMotion()) return
    let phase = 0
    let frame = 0
    let raf = requestAnimationFrame(function loop() {
      if (++frame % 3 === 0 && !document.hidden) {
        phase = (phase + 0.004) % 1
        draw(phase)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(raf)
  }, [seed])
  return <canvas ref={ref} />
}

/* ------------------------------------------------------------------ */
/* The overlay: falling screws and plates                              */
/* ------------------------------------------------------------------ */

type Body =
  | { kind: "screw"; el: HTMLElement; x: number; y: number; vx: number; vy: number; th: number; w: number; s: number }
  | {
      kind: "plate"
      el: HTMLElement
      state: "hanging" | "falling"
      cx: number
      cy: number
      W: number
      H: number
      th: number
      om: number
      vx: number
      vy: number
      k: number
      px: number
      py: number
      rx: number
      ry: number
      since: number
      walking: boolean
      pivot: { el: HTMLElement; x: number; y: number; turns: number; base: number; gone: boolean } | null
    }

const G = 2600

let fxSingleton: ReturnType<typeof createFx> | null = null
function fx() {
  if (!fxSingleton) fxSingleton = createFx()
  return fxSingleton
}

function createFx() {
  const layer = document.createElement("div")
  layer.className = "trk-fx"
  document.body.appendChild(layer)
  const bodies: Body[] = []
  let running = false
  let last = 0
  const reduced = prefersReducedMotion()

  const pageRect = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
  }

  const screwClone = (src: HTMLElement, rot: number, at: { x: number; y: number }) => {
    const el = document.createElement("span")
    el.className = "trk-screw is-loose"
    el.style.setProperty("--r", `${rot}deg`)
    el.style.setProperty("--turns", "5")
    el.style.left = "0px"
    el.style.top = "0px"
    el.style.transform = `translate(${at.x - window.scrollX}px, ${at.y - window.scrollY}px)`
    void src
    layer.appendChild(el)
    return el
  }

  const start = () => {
    if (running) return
    running = true
    last = performance.now()
    requestAnimationFrame(tick)
  }

  function dropScrew(src: HTMLElement, rot: number) {
    const at = pageRect(src)
    if (reduced) return
    const el = screwClone(src, rot, at)
    el.style.pointerEvents = "none"
    bodies.push({
      kind: "screw",
      el,
      x: at.x + at.w / 2,
      y: at.y + at.h / 2,
      vx: (Math.random() - 0.5) * 140,
      vy: -170,
      th: 0,
      w: (Math.random() - 0.5) * 18,
      s: 1 + 5 * 0.09,
    })
    start()
  }

  function releasePlate(plate: HTMLElement, pivotScrew: HTMLElement | null, pivotTurns: number, pivotBase: number) {
    if (reduced) return
    const at = pageRect(plate)
    const el = plate.cloneNode(true) as HTMLElement
    el.classList.add("is-fx")
    el.style.width = `${at.w}px`
    el.style.height = `${at.h}px`
    layer.appendChild(el)
    const body: Extract<Body, { kind: "plate" }> = {
      kind: "plate",
      el,
      state: "falling",
      cx: at.x + at.w / 2,
      cy: at.y + at.h / 2,
      W: at.w,
      H: at.h,
      th: 0,
      om: 0,
      vx: 0,
      vy: 0,
      k: (at.w * at.w + at.h * at.h) / 12,
      px: 0,
      py: 0,
      rx: 0,
      ry: 0,
      since: performance.now(),
      walking: false,
      pivot: null,
    }
    if (pivotScrew) {
      const sa = pageRect(pivotScrew)
      body.px = sa.x + sa.w / 2
      body.py = sa.y + sa.h / 2
      body.rx = body.px - body.cx
      body.ry = body.py - body.cy
      body.state = "hanging"
      const pin = screwClone(pivotScrew, pivotBase - pivotTurns * 85, sa)
      pin.style.setProperty("--turns", String(pivotTurns))
      pin.style.setProperty("--lift", String(1 + pivotTurns * 0.09))
      const pivot = { el: pin, x: sa.x, y: sa.y, turns: pivotTurns, base: pivotBase, gone: false }
      body.pivot = pivot
      const turnPivot = () => {
        if (pivot.gone) return
        pivot.turns += 1
        pin.style.setProperty("--r", `${pivot.base - pivot.turns * 85}deg`)
        pin.style.setProperty("--lift", String(1 + pivot.turns * 0.09))
        pin.style.setProperty("--turns", String(pivot.turns))
        if (pivot.turns >= TURNS_TO_DROP) {
          pivot.gone = true
          pin.remove()
          dropScrew(pin, pivot.base - pivot.turns * 85)
          // Release: the centre keeps the velocity it had going round the pivot.
          const dx = body.cx - body.px
          const dy = body.cy - body.py
          body.vx = -dy * body.om
          body.vy = dx * body.om
          body.state = "falling"
        }
      }
      pin.addEventListener("click", (event) => {
        event.stopPropagation()
        turnPivot()
      })
      ;(body as unknown as { turnPivot: () => void }).turnPivot = turnPivot
    }
    bodies.push(body)
    start()
  }

  function tick(now: number) {
    const dt = Math.min(1 / 30, (now - last) / 1000)
    last = now
    const sub = 4
    const h = dt / sub
    const floor = window.scrollY + window.innerHeight + 260
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i]
      if (b.kind === "screw") {
        for (let k = 0; k < sub; k++) {
          b.vy += G * h
          b.x += b.vx * h
          b.y += b.vy * h
          b.th += b.w * h
        }
        b.el.style.transform = `translate(${b.x - 4.5 - window.scrollX}px, ${b.y - 4.5 - window.scrollY}px) rotate(${b.th}rad) scale(${b.s})`
        if (b.y > floor) {
          b.el.remove()
          bodies.splice(i, 1)
        }
        continue
      }
      for (let k = 0; k < sub; k++) {
        if (b.state === "hanging") {
          const c = Math.cos(b.th)
          const s = Math.sin(b.th)
          const dx = -(c * b.rx - s * b.ry)
          const dy = -(s * b.rx + c * b.ry)
          const alpha = (G * dx) / (b.k + dx * dx + dy * dy) - 0.35 * b.om
          b.om += alpha * h
          b.th += b.om * h
          const c2 = Math.cos(b.th)
          const s2 = Math.sin(b.th)
          b.cx = b.px - (c2 * b.rx - s2 * b.ry)
          b.cy = b.py - (s2 * b.rx + c2 * b.ry)
        } else {
          b.vy += G * h
          b.cx += b.vx * h
          b.cy += b.vy * h
          b.th += b.om * h
        }
      }
      b.el.style.transform = `translate(${b.cx - b.W / 2 - window.scrollX}px, ${b.cy - b.H / 2 - window.scrollY}px) rotate(${b.th}rad)`
      if (b.pivot && !b.pivot.gone) {
        b.pivot.el.style.transform = `translate(${b.pivot.x - window.scrollX}px, ${b.pivot.y - window.scrollY}px) scale(var(--lift, 1))`
      }
      // One screw cannot hold a plate that size: after a few swings it walks out.
      if (b.state === "hanging" && !b.walking && now - b.since > 2400) {
        b.walking = true
        const turnPivot = (b as unknown as { turnPivot?: () => void }).turnPivot
        const step = () => {
          if (b.pivot && !b.pivot.gone) {
            turnPivot?.()
            setTimeout(step, 140)
          }
        }
        step()
      }
      if (b.state === "falling" && b.cy - Math.hypot(b.W, b.H) / 2 > floor) {
        b.el.remove()
        bodies.splice(i, 1)
      }
    }
    if (bodies.length) requestAnimationFrame(tick)
    else running = false
  }

  return { dropScrew, releasePlate }
}

/* ------------------------------------------------------------------ */
/* Small readout                                                       */
/* ------------------------------------------------------------------ */

export function ScopeReadout({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <div className="trk-readout" title={title}>
      <span className="trk-readout-plate">{label}</span>
      <div className="trk-scope-crt">{value}</div>
    </div>
  )
}
