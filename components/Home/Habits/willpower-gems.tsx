/**
 * components/Home/Habits/willpower-gems.tsx — Willpower gems
 *
 * Photographed object at the foot of the Home Dashboard Habits Tab
 * Control Panel. The plate is a skeuomorphic oval button: chrome rim,
 * black-mirror well, press-in click. Clicking the well stirs collected habit
 * gems; grabbing a gem throws it through the same sim. Lift a gem off the
 * plate (including in the Physics lab) and drop it — height and velocity
 * enter the integrator so bounce, collisions, and the lab equations follow.
 * The crystal is a solid (gems do not clip through) and a Y-sort occluder.
 * Physics opens a Win95 lab that plays the identical world (second plate +
 * equations). Gems paint outside the rim. The display is centered in the
 * panel foot. Grab does not stir or press the plate. The lab maps the compact
 * sim onto the larger oval; idle frames do not spin the dialog. Stir is a short
 * whirl, not a scatter bomb. Physics sliders are a painted Win95 thumb over a
 * native range (edits do not snap the world to min). Equations and knob
 * explanations collapse; Show all / Hide all explanations sit on the toolbar.
 */
"use client"

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { orbFor } from "@/components/Icons"
import { removeBackground } from "@/lib/remove-background"
import { useHabitsStore } from "@/lib/habits-store"
import {
  bouncingBallApex,
  bouncingBallTimeToApex,
  bouncingBallTimeToFloor,
  clamp,
  DEFAULT_WILLPOWER_PHYSICS,
  dishPeriod,
  dragWillpowerGem,
  drawY,
  emptyWillpowerWorld,
  grabWillpowerGem,
  hitWillpowerGem,
  makeWillpowerCrystal,
  makeWillpowerGem,
  mapWillpowerPoint,
  poseWillpowerGrab,
  predictedArc,
  releaseWillpowerGem,
  restOrbit,
  sanitizeWillpowerPhysics,
  resolveWillpowerOverlaps,
  scaleWillpowerBodies,
  stepWillpowerWorld,
  stirWillpower,
  stoneIsBehindCrystal,
  viewWillpowerBody,
  willpowerTelemetry,
  worldIsLive,
  WILLPOWER_PHYSICS_FIELDS,
  type WillpowerBody,
  type WillpowerPhysicsParams,
  type WillpowerWorld,
} from "@/lib/willpower-physics"
import type { WillpowerStone } from "@/lib/willpower-stones"
import "./habit-form-dialog.css"

export const DEFAULT_WILLPOWER_ORB = orbFor("willpower")

export function willpowerSrc(stored: string | null | undefined): string {
  return stored || DEFAULT_WILLPOWER_ORB
}

async function readWillpowerFile(file: File): Promise<string> {
  return removeBackground(file, { threshold: 60, size: 256 })
}

const HISTORY = 64
const SAMPLE_MS = 90
const PAINT_MS = 32
const MAX_THROW = 640
const MAX_LIFT_VZ = 1100
const SLOW_MO = 0.38

type LabHistory = { ke: number[]; z: number[]; v: number[]; e: number[] }

function worldFor(el: HTMLElement, prev?: WillpowerWorld): WillpowerWorld {
  const w = el.clientWidth || 160
  const h = el.clientHeight || 96
  const scale = w / 160
  return {
    width: w,
    height: h,
    cx: w / 2,
    cy: h / 2 + 2,
    rx: w * 0.46,
    ry: h * 0.42,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    seed: prev?.seed ?? 1,
    stirAge: prev?.stirAge ?? 99,
    bounces: prev?.bounces ?? 0,
  }
}

function bodiesFor(
  stones: WillpowerStone[],
  world: WillpowerWorld,
  prev: WillpowerBody[],
  params: WillpowerPhysicsParams,
): WillpowerBody[] {
  const crystal = makeWillpowerCrystal(world)
  const orbit = restOrbit(
    stones.length,
    world.cx,
    world.cy,
    Math.min(world.rx, world.ry) * 0.88,
    crystal.r + 6 * world.scale,
  )
  const byId = new Map(prev.map((b) => [b.id, b]))
  const satellites = stones.map((stone, i) => {
    const rest = orbit[i] ?? { x: world.cx, y: world.cy - 28 }
    return makeWillpowerGem(stone.id, rest.x, rest.y, world, params, byId.get(stone.id))
  })
  return resolveWillpowerOverlaps([crystal, ...satellites], params)
}

function localPoint(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function toSim(el: HTMLElement, clientX: number, clientY: number, sim: WillpowerWorld) {
  const local = localPoint(el, clientX, clientY)
  const view = worldFor(el, sim)
  return mapWillpowerPoint(local.x, local.y, view, sim)
}

function worldsMatch(a: WillpowerWorld, b: WillpowerWorld) {
  return Math.abs(a.width - b.width) < 1.5 && Math.abs(a.height - b.height) < 1.5
}

function bindRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (!ref) return
  if (typeof ref === "function") ref(node)
  else (ref as MutableRefObject<T | null>).current = node
}

function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}

function Sparkline({
  values,
  label,
  unit,
  digits = 0,
}: {
  values: number[]
  label: string
  unit?: string
  digits?: number
}) {
  const width = 280
  const height = 48
  const last = values.length ? values[values.length - 1]! : 0
  const max = Math.max(1, ...values, last)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const yAt = (v: number) => height - 8 - ((v - min) / span) * (height - 16)
  const zeroY = yAt(0)
  const d =
    values.length < 2
      ? `M 0 ${zeroY} L ${width} ${zeroY}`
      : values
          .map((v, i) => {
            const x = (i / (values.length - 1)) * width
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yAt(v).toFixed(1)}`
          })
          .join(" ")
  return (
    <figure className="hab-willpower-spark-wrap">
      <figcaption>
        <span>{label}</span>
        <em>
          {fmt(last, digits)}
          {unit ? ` ${unit}` : ""}
        </em>
      </figcaption>
      <svg className="hab-willpower-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} />
        <path d={d} />
      </svg>
    </figure>
  )
}

const KNOB_GROUPS: Array<{ title: string; keys: Array<(typeof WILLPOWER_PHYSICS_FIELDS)[number]["key"]> }> = [
  { title: "Motion", keys: ["g", "restitution", "mass"] },
  { title: "Dish", keys: ["dishK", "friction", "wallRestitution"] },
  { title: "Air", keys: ["linearDrag", "quadDrag", "magnus"] },
  { title: "Stir", keys: ["stirHop", "stirSpeed", "chaos", "repulsion"] },
]

const EQ_CARDS: Array<{
  id: string
  title: ReactNode
  value: (ctx: LabEqCtx) => string
  explain: string
}> = [
  {
    id: "eq-g",
    title: (
      <>
        z̈ = −g
      </>
    ),
    value: (ctx) => `−${fmt(ctx.params.g)} px/s²`,
    explain: "Newton’s second law on the vertical axis. The dish does not change g; it only adds a horizontal pull toward the crystal.",
  },
  {
    id: "eq-vz",
    title: (
      <>
        v<sub>z</sub>(t) = v<sub>z0</sub> − g t
      </>
    ),
    value: (ctx) => `${fmt(ctx.vz0)} − ${fmt(ctx.params.g)} t`,
    explain: "Speed after a hop. The slope is gravity. When this crosses zero the gem is at apex.",
  },
  {
    id: "eq-z",
    title: (
      <>
        z(t) = z<sub>0</sub> + v<sub>z0</sub> t − ½ g t²
      </>
    ),
    value: (ctx) => `${fmt(ctx.z0, 1)} + ${fmt(ctx.vz0)} t − ½(${fmt(ctx.params.g)}) t²`,
    explain: "Height of the tracked gem as a parabola. This is the same bouncing-ball law as a tennis ball, in plate pixels.",
  },
  {
    id: "eq-e",
    title: (
      <>
        e = −v<sub>z</sub>⁺ / v<sub>z</sub>⁻
      </>
    ),
    value: (ctx) => fmt(ctx.params.restitution, 2),
    explain: "Coefficient of restitution on the lacquer. Each bounce multiplies downward speed by e and flips the sign.",
  },
  {
    id: "eq-k",
    title: <>K = ½ m |v|²</>,
    value: (ctx) => `½(${fmt(ctx.mass, 2)}) (${fmt(ctx.speed)})² = ${fmt(ctx.ke)}`,
    explain: "Kinetic energy of the tracked gem. Stir injects K; drag, friction, and inelastic bounce spend it.",
  },
  {
    id: "eq-u",
    title: <>U = m g z + ½ κ r²</>,
    value: (ctx) => `mgz = ${fmt(ctx.pe)} · ½κr² = ${fmt(ctx.dishU)}`,
    explain: "Potential: height in the well plus the dish spring. Gems rest where U is smallest — around the crystal, on the plate.",
  },
]

type LabEqCtx = {
  params: WillpowerPhysicsParams
  z0: number
  vz0: number
  mass: number
  speed: number
  ke: number
  pe: number
  dishU: number
}

function formatKnob(field: (typeof WILLPOWER_PHYSICS_FIELDS)[number], value: number) {
  if (field.key === "quadDrag") return value.toFixed(4)
  return Number(value).toFixed(field.step < 0.1 ? 2 : 0)
}

const PhysicsKnobs = memo(function PhysicsKnobs({
  params,
  open,
  onToggle,
  onChange,
}: {
  params: WillpowerPhysicsParams
  open: ReadonlySet<string>
  onToggle: (id: string) => void
  onChange: (patch: Partial<WillpowerPhysicsParams>) => void
}) {
  return (
    <section
      className="hab-willpower-knobs"
      aria-label="Simulation variables"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {KNOB_GROUPS.map((group) => (
        <div key={group.title} className="hab-willpower-knob-group">
          <h3>{group.title}</h3>
          {group.keys.map((key) => {
            const field = WILLPOWER_PHYSICS_FIELDS.find((f) => f.key === key)
            if (!field) return null
            const shown = open.has(field.key)
            const value = params[field.key]
            const span = field.max - field.min || 1
            const pct = clamp(((value - field.min) / span) * 100, 0, 100)
            return (
              <div key={field.key} className="hab-willpower-knob-block">
                <label className="hab-willpower-knob" title={field.equation}>
                  <span>
                    {field.symbol}
                    <small>{field.label}</small>
                  </span>
                  <span className="hab-willpower-slider">
                    <span className="hab-willpower-slider-track" aria-hidden />
                    <span className="hab-willpower-slider-thumb" style={{ left: `${pct}%` }} aria-hidden />
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={value}
                      aria-valuemin={field.min}
                      aria-valuemax={field.max}
                      aria-valuenow={value}
                      aria-label={`${field.label} ${field.symbol}`}
                      data-no95=""
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isFinite(n)) return
                        onChange({ [field.key]: clamp(n, field.min, field.max) })
                      }}
                    />
                  </span>
                  <em>
                    {formatKnob(field, value)}
                    {field.unit ? ` ${field.unit}` : ""}
                  </em>
                </label>
                <button
                  type="button"
                  className="hab-willpower-explain-toggle"
                  aria-expanded={shown}
                  onClick={() => onToggle(field.key)}
                >
                  {shown ? "Hide explain" : "Explain"} {field.symbol}
                </button>
                {shown ? (
                  <p className="hab-willpower-explain">
                    <code>{field.equation}</code>
                    {field.explain}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
})

function PhysicsLab({
  pose,
  params,
  history,
  bounces,
  slowMo,
  onSlowMo,
  onChange,
  onReset,
}: {
  pose: WillpowerBody[]
  params: WillpowerPhysicsParams
  history: LabHistory
  bounces: number
  slowMo: boolean
  onSlowMo: () => void
  onChange: (patch: Partial<WillpowerPhysicsParams>) => void
  onReset: () => void
}) {
  const gems = pose.filter((b) => !b.pinned)
  const crystal = pose.find((b) => b.pinned)
  const held = gems.find((b) => b.held) ?? null
  const tracked =
    held ??
    gems.reduce<WillpowerBody | null>((best, b) => {
      const ke = 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy + b.vz * b.vz)
      const keBest = best ? 0.5 * best.mass * (best.vx * best.vx + best.vy * best.vy + best.vz * best.vz) : -1
      return ke >= keBest ? b : best
    }, null)
  const z0 = tracked?.z ?? 0
  const vz0 = tracked?.vz ?? 0
  const apex = bouncingBallApex(z0, vz0, params.g)
  const tApex = bouncingBallTimeToApex(vz0, params.g)
  const tFloor = bouncingBallTimeToFloor(z0, vz0, params.g)
  const speed = tracked ? Math.hypot(tracked.vx, tracked.vy, tracked.vz) : 0
  const ke = tracked ? 0.5 * tracked.mass * speed * speed : 0
  const pe = tracked ? tracked.mass * params.g * Math.max(tracked.z, 0) : 0
  const dishR2 =
    tracked && crystal ? (tracked.x - crystal.x) ** 2 + (tracked.y - crystal.y) ** 2 : 0
  const dishU = 0.5 * params.dishK * dishR2
  const airborne = gems.filter((b) => b.z > 0.45).length
  const omega = gems.reduce((s, b) => s + Math.abs(b.omega), 0) / Math.max(gems.length, 1)
  const momentum = gems.reduce((s, b) => s + b.mass * Math.hypot(b.vx, b.vy, b.vz), 0)
  const spinK = gems.reduce((s, b) => s + 0.2 * b.mass * b.r * b.r * b.omega * b.omega, 0)
  const comR =
    crystal && gems.length
      ? gems.reduce((s, b) => s + Math.hypot(b.x - crystal.x, b.y - crystal.y), 0) / gems.length
      : 0
  const packing = crystal
    ? gems.length / Math.max((Math.PI * crystal.r * crystal.r) / 36, 1)
    : 0
  const period = dishPeriod(params.dishK)
  const arc = predictedArc(z0, vz0, params.g, 20)
  const zMax = Math.max(apex, 8, ...arc.map((p) => p.z))
  const tMax = Math.max(arc[arc.length - 1]?.t ?? 0.4, 0.12)
  const arcPath = arc
    .map((p, i) => {
      const x = 16 + (p.t / tMax) * 248
      const y = 40 - (p.z / zMax) * 32
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
  const eqCtx: LabEqCtx = {
    params,
    z0,
    vz0,
    mass: tracked?.mass ?? params.mass,
    speed,
    ke,
    pe,
    dishU,
  }
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const allIds = useMemo(
    () => [
      ...EQ_CARDS.flatMap((c) => [c.id, `${c.id}-why`]),
      ...WILLPOWER_PHYSICS_FIELDS.map((f) => f.key),
      "eq-extra",
      "eq-extra-why",
    ],
    [],
  )
  const showAll = () => setOpen(new Set(allIds))
  const hideAll = () => setOpen(new Set())

  return (
    <div className="hab-willpower-lab" data-physics-lab="willpower-gems">
      <div className="hab-willpower-lab-toolbar">
        <button type="button" className="habit95-btn" onClick={showAll}>
          Show all explanations
        </button>
        <button type="button" className="habit95-btn" onClick={hideAll}>
          Hide all explanations
        </button>
        <button
          type="button"
          className={`habit95-btn${slowMo ? " habit95-btn-default" : ""}`}
          aria-pressed={slowMo}
          onClick={onSlowMo}
        >
          {slowMo ? "Slow-mo on" : "Slow-mo"}
        </button>
      </div>
      <div className="hab-willpower-lab-main">
        <div className="hab-willpower-lab-readout">
          <section className="hab-willpower-eq-block" aria-label="Live equations">
            <h3>{held ? "Held gem" : "Live gem"}</h3>
            <div className="hab-willpower-eq-list">
              {EQ_CARDS.map((card) => {
                const eqOpen = open.has(card.id)
                const whyOpen = open.has(`${card.id}-why`)
                return (
                  <article key={card.id} className="hab-willpower-eq-card">
                    <div className="hab-willpower-eq-row">
                      <button
                        type="button"
                        className="hab-willpower-eq-head"
                        aria-expanded={eqOpen}
                        onClick={() => toggle(card.id)}
                      >
                        <span>
                          {card.title}
                          <small>{eqOpen ? "Hide equation" : "Show equation"}</small>
                        </span>
                      </button>
                      <em>{card.value(eqCtx)}</em>
                    </div>
                    {eqOpen ? <p className="hab-willpower-eq-body">{card.value(eqCtx)}</p> : null}
                    <button
                      type="button"
                      className="hab-willpower-explain-toggle"
                      aria-expanded={whyOpen}
                      onClick={() => toggle(`${card.id}-why`)}
                    >
                      {whyOpen ? "Hide explain" : "Explain"}
                    </button>
                    {whyOpen ? <p className="hab-willpower-explain">{card.explain}</p> : null}
                  </article>
                )
              })}
            </div>
          </section>
          <p className="hab-willpower-eq-meta">
            apex {fmt(apex, 1)} px · t<sub>apex</sub> {fmt(tApex, 2)} s · t<sub>land</sub>{" "}
            {fmt(tFloor, 2)} s · airborne {airborne}/{gems.length} · bounces {bounces}
          </p>
          <section className="hab-willpower-extra" aria-label="More lab quantities">
            <div className="hab-willpower-eq-row">
              <button
                type="button"
                className="hab-willpower-eq-head"
                aria-expanded={open.has("eq-extra")}
                onClick={() => toggle("eq-extra")}
              >
                <span>
                  Extra instruments
                  <small>{open.has("eq-extra") ? "Hide" : "Show"}</small>
                </span>
              </button>
              <em>E {fmt(ke + pe)}</em>
            </div>
            {open.has("eq-extra") ? (
              <dl>
                <div>
                  <dt>ΣE = K + U</dt>
                  <dd>{fmt(ke + pe)}</dd>
                </div>
                <div>
                  <dt>|p| = Σ m|v|</dt>
                  <dd>{fmt(momentum)}</dd>
                </div>
                <div>
                  <dt>K<sub>ω</sub> ≈ ⅕ m r² ω²</dt>
                  <dd>{fmt(spinK)}</dd>
                </div>
                <div>
                  <dt>ω̄</dt>
                  <dd>{fmt(omega, 2)} rad/s</dd>
                </div>
                <div>
                  <dt>T<sub>κ</sub> = 2π/√κ</dt>
                  <dd>{fmt(period, 2)} s</dd>
                </div>
                <div>
                  <dt>⟨r⟩ from crystal</dt>
                  <dd>{fmt(comR, 1)} px</dd>
                </div>
                <div>
                  <dt>packing</dt>
                  <dd>{fmt(packing, 2)}</dd>
                </div>
                <div>
                  <dt>bounces</dt>
                  <dd>{bounces}</dd>
                </div>
              </dl>
            ) : null}
            <button
              type="button"
              className="hab-willpower-explain-toggle"
              aria-expanded={open.has("eq-extra-why")}
              onClick={() => toggle("eq-extra-why")}
            >
              {open.has("eq-extra-why") ? "Hide explain" : "Explain"} instruments
            </button>
            {open.has("eq-extra-why") ? (
              <p className="hab-willpower-explain">
                Total mechanical energy, net momentum, spin kinetic energy, mean spin, the dish
                oscillation period, how far the week’s gems sit from the crystal, packing, and
                floor-bounce count. Energy falls as bounce (e &lt; 1) and drag spend it. Slow-mo
                scales dt so the same laws are easier to watch.
              </p>
            ) : null}
          </section>
          <section className="hab-willpower-graphs" aria-label="Live trajectories">
            <Sparkline values={history.ke} label="ΣK" unit="px²/s²" />
            <Sparkline values={history.e} label="ΣE" unit="" />
            <Sparkline values={history.z} label="z" unit="px" digits={1} />
            <figure className="hab-willpower-spark-wrap">
              <figcaption>
                <span>z(t) next bounce</span>
                <em>{fmt(apex, 1)} px</em>
              </figcaption>
              <svg className="hab-willpower-spark hab-willpower-arc" viewBox="0 0 280 48" aria-hidden>
                <line x1="16" y1="40" x2="264" y2="40" />
                {arcPath ? <path d={arcPath} /> : null}
              </svg>
            </figure>
          </section>
        </div>
        <PhysicsKnobs params={params} open={open} onToggle={toggle} onChange={onChange} />
      </div>
      <footer className="hab-willpower-lab-foot">
        <p>
          Same chrome + black-mirror world as the control-panel plate. Grab a gem without pressing the well.
          Edits persist until reset.
        </p>
        <button type="button" className="habit95-btn habit95-btn-default hab-willpower-lab-reset" onClick={onReset}>
          Reset to default
        </button>
      </footer>
    </div>
  )
}

function WillpowerPlate({
  orbSrc,
  stones,
  pose,
  simWorld,
  stageRef,
  stirring,
  pressed,
  grabId,
  busy,
  label,
  onPlateClick,
  onPlatePointerDown,
  onPlatePointerUp,
  onStonePointerDown,
}: {
  orbSrc: string
  stones: WillpowerStone[]
  pose: WillpowerBody[]
  simWorld: WillpowerWorld
  stageRef?: Ref<HTMLSpanElement>
  stirring: boolean
  pressed: boolean
  grabId: string | null
  busy: boolean
  label: string
  onPlateClick: (event: MouseEvent<HTMLButtonElement>) => void
  onPlatePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPlatePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onStonePointerDown: (event: ReactPointerEvent<HTMLImageElement>, stage: HTMLElement) => void
}) {
  const localStageRef = useRef<HTMLSpanElement | null>(null)
  const [viewWorld, setViewWorld] = useState<WillpowerWorld | undefined>()

  const setStage = useCallback(
    (node: HTMLSpanElement | null) => {
      localStageRef.current = node
      bindRef(stageRef, node)
    },
    [stageRef],
  )

  useLayoutEffect(() => {
    const el = localStageRef.current
    if (!el) return
    let frames = 0
    let raf = 0
    let ro: ResizeObserver | undefined
    const sync = () => {
      if (el.clientWidth < 4 && frames++ < 24) {
        raf = requestAnimationFrame(sync)
        return
      }
      const next = worldFor(el, simWorld)
      setViewWorld((prev) =>
        prev && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      )
    }
    sync()
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(sync)
      ro.observe(el)
    }
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [simWorld])

  const view = viewWorld && !worldsMatch(viewWorld, simWorld) ? viewWorld : undefined
  const shown = view ? pose.map((b) => viewWillpowerBody(b, simWorld, view)) : pose
  const crystal = shown.find((b) => b.pinned)
  const crystalY = crystal ? drawY(crystal) : (view ?? simWorld).cy
  const byId = useMemo(() => new Map(stones.map((stone) => [stone.id, stone])), [stones])
  const satellites = shown.filter((b) => !b.pinned).sort((a, b) => drawY(a) - drawY(b) || a.x - b.x)
  const behind = satellites.filter((b) => stoneIsBehindCrystal(drawY(b), crystalY))
  const front = satellites.filter((b) => !stoneIsBehindCrystal(drawY(b), crystalY))

  const renderStone = (body: WillpowerBody) => {
    const stone = byId.get(body.id)
    if (!stone) return null
    const behindCrystal = stoneIsBehindCrystal(drawY(body), crystalY)
    const size = body.r * 2
    const lift = Math.max(body.z, 0)
    const held = body.held || grabId === body.id
    return (
      <img
        key={stone.id}
        src={stone.src}
        alt=""
        title={held ? `Throw ${stone.name}` : `Grab ${stone.name}`}
        width={size}
        height={size}
        className={`hab-willpower-stone${behindCrystal ? " is-behind" : " is-front"}${lift > 0.8 ? " is-airborne" : ""}${held ? " is-held" : ""}`}
        data-stone-id={stone.id}
        data-depth={behindCrystal ? "behind" : "front"}
        data-held={held ? "true" : undefined}
        loading="lazy"
        decoding="async"
        draggable={false}
        onPointerDown={(event) => {
          const stage = event.currentTarget.parentElement
          if (stage) onStonePointerDown(event, stage)
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        style={{
          left: `${body.x - body.r}px`,
          top: `${drawY(body) - body.r}px`,
          width: `${size}px`,
          height: `${size}px`,
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className={`hab-willpower-gems-hit${stirring ? " is-stirring" : ""}${pressed ? " is-pressed" : ""}${grabId ? " is-holding" : ""}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest(".hab-willpower-stone")) return
        onPlateClick(event)
      }}
      onPointerDown={onPlatePointerDown}
      onPointerUp={onPlatePointerUp}
      onPointerCancel={onPlatePointerUp}
      aria-label={label}
      title="Press the plate to stir. Grab a gem to throw it."
      disabled={busy}
      data-physics="willpower-gems"
      data-no95=""
    >
      <span ref={setStage} className="hab-willpower-stage">
        {behind.map(renderStone)}
        <img src={orbSrc} alt="" className="hab-willpower-crystal" draggable={false} />
        {front.map(renderStone)}
      </span>
      <span className="hab-willpower-gems-label">Willpower gems</span>
    </button>
  )
}

function WillpowerGemsStage({
  orbSrc,
  stones,
  busy,
}: {
  orbSrc: string
  stones: WillpowerStone[]
  busy: boolean
}) {
  const stageRef = useRef<HTMLSpanElement>(null)
  const labStageRef = useRef<HTMLSpanElement>(null)
  const bodiesRef = useRef<WillpowerBody[]>([])
  const worldRef = useRef<WillpowerWorld>(emptyWillpowerWorld())
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const sampleRef = useRef(0)
  const hudRef = useRef(false)
  const paramsRef = useRef(DEFAULT_WILLPOWER_PHYSICS)
  const historyRef = useRef<LabHistory>({ ke: [], z: [], v: [], e: [] })
  const grabRef = useRef<{
    id: string
    stage: HTMLElement
    plateY: number
    lastX: number
    lastY: number
    lastZ: number
    lastT: number
    vx: number
    vy: number
    vz: number
  } | null>(null)
  const skipStirRef = useRef(false)
  const quietStirUntilRef = useRef(0)
  const gestureRef = useRef({ x: 0, y: 0, dragged: false, fromStone: false })
  const [pose, setPose] = useState<WillpowerBody[]>([])
  const [stirring, setStirring] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [grabId, setGrabId] = useState<string | null>(null)
  const hud = useHabitsStore((s) => s.willpowerPhysicsHud)
  const setHud = useHabitsStore((s) => s.setWillpowerPhysicsHud)
  const storeParams = useHabitsStore((s) => s.willpowerPhysics)
  const setParams = useHabitsStore((s) => s.setWillpowerPhysics)
  const [knobs, setKnobs] = useState(() => sanitizeWillpowerPhysics(storeParams))
  const [history, setHistory] = useState(historyRef.current)
  const [slowMo, setSlowMo] = useState(false)
  const [bounces, setBounces] = useState(0)
  const persistTimer = useRef(0)
  const paintRef = useRef(0)
  const slowMoRef = useRef(false)
  const onPhysicsChange = useCallback(
    (patch: Partial<WillpowerPhysicsParams>) => {
      setKnobs((prev) => {
        const next = sanitizeWillpowerPhysics({ ...prev, ...patch })
        paramsRef.current = next
        window.clearTimeout(persistTimer.current)
        persistTimer.current = window.setTimeout(() => setParams(next), 180)
        return next
      })
    },
    [setParams],
  )
  const onPhysicsReset = useCallback(() => {
    window.clearTimeout(persistTimer.current)
    paramsRef.current = DEFAULT_WILLPOWER_PHYSICS
    setKnobs(DEFAULT_WILLPOWER_PHYSICS)
    setParams(DEFAULT_WILLPOWER_PHYSICS)
  }, [setParams])

  hudRef.current = hud
  paramsRef.current = knobs
  slowMoRef.current = slowMo

  const pushHistory = (now: number) => {
    if (!hudRef.current) return
    if (now - sampleRef.current < SAMPLE_MS && sampleRef.current !== 0) return
    sampleRef.current = now
    const tel = willpowerTelemetry(bodiesRef.current, worldRef.current, paramsRef.current)
    const ring = historyRef.current
    ring.ke = [...ring.ke, tel.ke].slice(-HISTORY)
    ring.z = [...ring.z, tel.maxZ].slice(-HISTORY)
    ring.v = [...ring.v, tel.meanSpeed].slice(-HISTORY)
    ring.e = [...ring.e, tel.energy].slice(-HISTORY)
    setHistory({ ke: ring.ke, z: ring.z, v: ring.v, e: ring.e })
    setBounces(worldRef.current.bounces)
  }

  const tick = (now: number) => {
    const last = lastRef.current || now
    lastRef.current = now
    const scale = slowMoRef.current ? SLOW_MO : 1
    const dt = Math.min((now - last) / 1000, 1 / 30) * scale
    const next = stepWillpowerWorld(bodiesRef.current, worldRef.current, dt, paramsRef.current)
    bodiesRef.current = next
    const grabbing = Boolean(grabRef.current)
    if (grabbing || now - paintRef.current >= PAINT_MS || paintRef.current === 0) {
      paintRef.current = now
      setPose(next)
    }
    pushHistory(now)
    const moving = worldIsLive(next)
    if (moving || grabbing) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = 0
      lastRef.current = 0
      paintRef.current = 0
      setStirring(false)
      setPose(next)
    }
  }

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    worldRef.current = worldFor(el, worldRef.current)
    bodiesRef.current = bodiesFor(stones, worldRef.current, bodiesRef.current, paramsRef.current)
    setPose(bodiesRef.current)
  }, [stones])

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      const prev = worldRef.current
      const nextWorld = worldFor(el, prev)
      bodiesRef.current = resolveWillpowerOverlaps(
        scaleWillpowerBodies(
          bodiesFor(stones, nextWorld, bodiesRef.current, paramsRef.current),
          prev,
          nextWorld,
        ),
        paramsRef.current,
      )
      worldRef.current = nextWorld
      setPose(bodiesRef.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [stones])

  useEffect(() => {
    setKnobs(sanitizeWillpowerPhysics(storeParams))
  }, [storeParams])

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimer.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (!hud) return
    sampleRef.current = 0
    pushHistory(performance.now())
  }, [hud])

  const stirAt = (el: HTMLElement, clientX: number, clientY: number) => {
    const sim = toSim(el, clientX, clientY, worldRef.current)
    worldRef.current = worldFor(stageRef.current ?? el, worldRef.current)
    bodiesRef.current = stirWillpower(
      bodiesFor(stones, worldRef.current, bodiesRef.current, paramsRef.current),
      worldRef.current,
      sim.x,
      sim.y,
      paramsRef.current,
    )
    setPose(bodiesRef.current)
    setStirring(true)
    startTick()
  }

  const onPlateClick = (event: MouseEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    const skip =
      skipStirRef.current ||
      gesture.fromStone ||
      gesture.dragged ||
      Boolean(grabRef.current) ||
      performance.now() < quietStirUntilRef.current
    skipStirRef.current = false
    gesture.fromStone = false
    gesture.dragged = false
    if (skip) return
    const stage = event.currentTarget.querySelector(".hab-willpower-stage") as HTMLElement | null
    if (!stage) return
    stirAt(stage, event.clientX, event.clientY)
  }

  const beginGrab = (
    id: string,
    stage: HTMLElement,
    clientX: number,
    clientY: number,
    pointerId?: number,
    captureEl?: HTMLElement,
  ) => {
    skipStirRef.current = true
    quietStirUntilRef.current = performance.now() + 480
    gestureRef.current = { x: clientX, y: clientY, dragged: false, fromStone: true }
    bodiesRef.current = grabWillpowerGem(bodiesRef.current, id)
    const held = bodiesRef.current.find((b) => b.id === id)
    const sim = toSim(stage, clientX, clientY, worldRef.current)
    const now = performance.now()
    grabRef.current = {
      id,
      stage,
      plateY: held?.y ?? sim.y,
      lastX: held?.x ?? sim.x,
      lastY: held?.y ?? sim.y,
      lastZ: held?.z ?? 12,
      lastT: now,
      vx: 0,
      vy: 0,
      vz: 0,
    }
    setGrabId(id)
    setPose(bodiesRef.current)
    setPressed(false)
    startTick()
    if (captureEl && pointerId != null) {
      try {
        captureEl.setPointerCapture(pointerId)
      } catch {
        /* jsdom */
      }
    }
  }

  const onPlatePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (grabRef.current) {
      setPressed(false)
      return
    }
    const fromStone = Boolean((event.target as HTMLElement).closest(".hab-willpower-stone"))
    if (fromStone) return
    const stage = event.currentTarget.querySelector(".hab-willpower-stage") as HTMLElement | null
    if (stage) {
      const sim = toSim(stage, event.clientX, event.clientY, worldRef.current)
      const hit = hitWillpowerGem(bodiesRef.current, sim.x, sim.y)
      if (hit && !hit.pinned) {
        event.preventDefault()
        beginGrab(hit.id, stage, event.clientX, event.clientY, event.pointerId, event.currentTarget)
        return
      }
    }
    gestureRef.current = { x: event.clientX, y: event.clientY, dragged: false, fromStone: false }
    setPressed(true)
  }

  const onPlatePointerUp = () => {
    if (grabRef.current) return
    setPressed(false)
  }

  const onStonePointerDown = (event: ReactPointerEvent<HTMLImageElement>, stage: HTMLElement) => {
    event.preventDefault()
    event.stopPropagation()
    const id = event.currentTarget.getAttribute("data-stone-id")
    if (!id) return
    const sim = toSim(stage, event.clientX, event.clientY, worldRef.current)
    const hit = hitWillpowerGem(bodiesRef.current, sim.x, sim.y) ?? bodiesRef.current.find((b) => b.id === id)
    if (!hit || hit.pinned) return
    beginGrab(hit.id, stage, event.clientX, event.clientY, event.pointerId, event.currentTarget)
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const grab = grabRef.current
      if (grab) {
        const dx = event.clientX - gestureRef.current.x
        const dy = event.clientY - gestureRef.current.y
        if (dx * dx + dy * dy > 49) gestureRef.current.dragged = true
      }
      if (!grab) return
      const stage =
        grab.stage.isConnected
          ? grab.stage
          : labStageRef.current || stageRef.current
      if (!(stage instanceof HTMLElement)) return
      grab.stage = stage
      const sim = toSim(stage, event.clientX, event.clientY, worldRef.current)
      const pose = poseWillpowerGrab(grab.plateY, sim.x, sim.y)
      grab.plateY = pose.plateY
      const dt = Math.max((event.timeStamp || performance.now()) - grab.lastT, 8) / 1000
      let vx = (pose.x - grab.lastX) / dt
      let vy = (pose.y - grab.lastY) / dt
      let vz = (pose.z - grab.lastZ) / dt
      const sp = Math.hypot(vx, vy)
      if (sp > MAX_THROW) {
        vx *= MAX_THROW / sp
        vy *= MAX_THROW / sp
      }
      if (vz > MAX_LIFT_VZ) vz = MAX_LIFT_VZ
      if (vz < -MAX_LIFT_VZ) vz = -MAX_LIFT_VZ
      grab.lastX = pose.x
      grab.lastY = pose.y
      grab.lastZ = pose.z
      grab.lastT = event.timeStamp || performance.now()
      grab.vx = vx
      grab.vy = vy
      grab.vz = vz
      bodiesRef.current = dragWillpowerGem(
        bodiesRef.current,
        grab.id,
        pose.x,
        pose.y,
        vx,
        vy,
        pose.z,
        vz,
      )
      setPose(bodiesRef.current)
    }
    const onUp = () => {
      const grab = grabRef.current
      if (!grab) {
        setPressed(false)
        return
      }
      bodiesRef.current = releaseWillpowerGem(bodiesRef.current, grab.id, grab.vx, grab.vy, grab.vz)
      grabRef.current = null
      skipStirRef.current = true
      quietStirUntilRef.current = performance.now() + 480
      setGrabId(null)
      setPose(bodiesRef.current)
      setStirring(true)
      startTick()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  const plateProps = {
    orbSrc,
    stones,
    pose,
    simWorld: worldRef.current,
    stirring,
    pressed,
    grabId,
    busy,
    onPlateClick,
    onPlatePointerDown,
    onPlatePointerUp,
    onStonePointerDown,
  }

  return (
    <>
      <Dialog open={hud} onOpenChange={setHud}>
        <DialogContent className="habit95-dialog hab-willpower-lab-dialog">
          <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
            <DialogTitle className="habit95-title-text">Willpower gems physics</DialogTitle>
            <button type="button" className="habit95-title-btn" aria-label="Close physics" onClick={() => setHud(false)}>
              ×
            </button>
          </DialogHeader>
          <DialogDescription className="sr-only">
            The same Willpower gems world as the control panel. Stir, grab, or lift gems here. Live
            equations and editable knobs persist until reset.
          </DialogDescription>
          <div className="habit95-body">
            <div className="hab-willpower-lab-play">
              <WillpowerPlate
                {...plateProps}
                stageRef={labStageRef}
                label="Stir Willpower gems"
              />
            </div>
            <PhysicsLab
              pose={pose}
              params={knobs}
              history={history}
              bounces={bounces}
              slowMo={slowMo}
              onSlowMo={() => setSlowMo((v) => !v)}
              onChange={onPhysicsChange}
              onReset={onPhysicsReset}
            />
          </div>
        </DialogContent>
      </Dialog>
      <WillpowerPlate {...plateProps} stageRef={stageRef} label="Stir Willpower gems" />
    </>
  )
}

export function WillpowerGems({ stones = [] }: { stones?: WillpowerStone[] }) {
  const stored = useHabitsStore((s) => s.willpowerImage)
  const hud = useHabitsStore((s) => s.willpowerPhysicsHud)
  const setHud = useHabitsStore((s) => s.setWillpowerPhysicsHud)

  const onPhysicsKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation()
  }

  return (
    <figure
      className="hab-willpower-gems"
      aria-label="Willpower gems"
      data-ui-name="Willpower gems"
      data-ui-docs="components/Home/Habits/README.md"
    >
      <WillpowerGemsStage orbSrc={willpowerSrc(stored)} stones={stones} busy={false} />
      <figcaption>
        <button
          type="button"
          className={`habit-chrome-btn hab-willpower-lab-toggle${hud ? " is-on" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={hud}
          onKeyDown={onPhysicsKey}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setHud(!hud)
          }}
        >
          Physics
        </button>
      </figcaption>
    </figure>
  )
}

export function WillpowerGemsSettingsField() {
  const stored = useHabitsStore((s) => s.willpowerImage)
  const setWillpowerImage = useHabitsStore((s) => s.setWillpowerImage)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      setWillpowerImage(await readWillpowerFile(file))
    } catch (error) {
      console.error("Willpower gems image failed", error)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="hab-willpower-settings">
      <p className="text-xs text-muted-foreground">
        Central willpower crystal at the foot of the Habits Tab Control Panel. Change the crystal here; press the plate
        to stir, grab a gem to throw it. Physics opens a bouncing-ball lab with a live copy of the same plate.
      </p>
      <div className="hab-willpower-settings-row">
        <img src={willpowerSrc(stored)} alt="" className="hab-willpower-preview" />
        <button type="button" className="habit-chrome-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Processing…" : "Change image"}
        </button>
        {stored ? (
          <button type="button" className="habit-chrome-btn" onClick={() => setWillpowerImage(null)}>
            Use default crystal
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )
}

/** @deprecated Use WillpowerGemsSettingsField */
export const WillpowerSettingsField = WillpowerGemsSettingsField
