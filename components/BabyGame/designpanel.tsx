/**
 * components/BabyGame/designpanel.tsx — Character design: every look, large, with notes for a redesign
 *
 * Opens from the Friends tab of the Journal. Left: the Center of The World and every friend. Right: the chosen
 * character's front, side and back views at a large scale, a status (fine as is, needs redesign, redesigned) and a note.
 * Notes are saved as you type (`lib/baby-game/design-notes.ts`). A dev tool today; later the same panel is where a
 * generated character is reviewed and sent back for another try.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RESIDENTS } from "@/lib/baby-game/cast"
import { DESIGN_STATUS_LABEL, designBrief, loadDesignNotes, redoBriefs, redoCount, saveDesignNotes, withNote, type DesignNotes, type DesignStatus } from "@/lib/baby-game/design-notes"
import { cachedIdle, idlePose } from "@/lib/baby-game/idle"
import { paintGrid, playerGrid, spriteGrid, SPRITE_SIZE, type SpriteView } from "@/lib/baby-game/sprites"
import { cachedWalk, type WalkFrame } from "@/lib/baby-game/walk"

const PLAYER = "player"
const VIEWS: SpriteView[] = ["front", "side", "back"]
const STATUSES: DesignStatus[] = ["keep", "redo", "done"]

const NAMES: Record<string, string> = { [PLAYER]: "The Center of The World", ...Object.fromEntries(RESIDENTS.map((r) => [r.id, r.name])) }
const IDS = [PLAYER, ...RESIDENTS.map((r) => r.id)]

function gridOf(id: string, view: SpriteView): string[] {
  return id === PLAYER ? playerGrid(view) : spriteGrid(id, view)
}

function ViewCanvas({ id, view, scale }: { id: string; view: SpriteView; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (!ref.current || !ctx) return
    ctx.clearRect(0, 0, ref.current.width, ref.current.height)
    paintGrid(ctx, gridOf(id, view), 0, 0, scale)
  }, [id, view, scale])
  return <canvas ref={ref} width={SPRITE_SIZE * scale} height={SPRITE_SIZE * scale} role="img" aria-label={`${NAMES[id] ?? id}, ${view} view`} className="bg-pixel" />
}

type StudioMode = "idle" | "walk" | "run" | "turn"
const MODES: StudioMode[] = ["idle", "walk", "run", "turn"]
const STUDIO_SCALE = 8
const TURN_VIEWS: SpriteView[] = ["front", "side", "back", "side"]

/** The whole character, alive: idle life, walk and run cycles, and a turntable, on a small stage. */
function Studio({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<StudioMode>("idle")
  const [view, setView] = useState<SpriteView>("front")
  const [flip, setFlip] = useState(false)
  const [paused, setPaused] = useState(false)
  const clock = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()
    const draw = () => {
      const t = clock.current
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = "#4d8f4f"
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = "#a98f72"
      ctx.fillRect(0, H - 52, W, 52)
      ctx.fillStyle = "#bda585"
      ctx.fillRect(0, H - 52, W, 3)
      const turn = mode === "turn"
      const v: SpriteView = turn ? TURN_VIEWS[Math.floor(t / 1.2) % TURN_VIEWS.length]! : view
      const base = id === PLAYER ? playerGrid(v) : spriteGrid(id, v)
      let grid: string[] = base
      if (mode === "walk" || mode === "run") {
        const f = (Math.floor(t * (mode === "run" ? 13 : 8)) & 3) as WalkFrame
        grid = cachedWalk(id, base, v, f)
      } else {
        const pose = idlePose(id, t)
        if (pose && pose !== "glance") grid = cachedIdle(id, base, v, pose)
      }
      const size = SPRITE_SIZE * STUDIO_SCALE
      const left = Math.round((W - size) / 2)
      const top = H - 52 - 29 * STUDIO_SCALE
      ctx.fillStyle = "#0000002e"
      ctx.fillRect(W / 2 - 7 * STUDIO_SCALE, H - 52 - 2, 14 * STUDIO_SCALE, 12)
      ctx.save()
      if (flip || (turn && v === "side" && Math.floor(t / 1.2) % 4 === 3)) {
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
      }
      paintGrid(ctx, grid, left, top, STUDIO_SCALE)
      ctx.restore()
    }
    const tick = (now: number) => {
      if (!paused) clock.current += (now - last) / 1000
      last = now
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, mode, view, flip, paused])

  const key = (on: boolean) => `friend-key bg-key${on ? " is-on" : ""}`
  return (
    <section className="bg-studio" aria-label="Studio">
      <canvas ref={ref} width={SPRITE_SIZE * STUDIO_SCALE + 80} height={SPRITE_SIZE * STUDIO_SCALE + 20} className="bg-pixel bg-studio-stage" role="img" aria-label={`${NAMES[id] ?? id}, ${mode}`} />
      <div className="bg-studio-keys">
        <div role="group" aria-label="Animation" className="bg-design-status">
          {MODES.map((m) => (
            <button key={m} type="button" className={key(mode === m)} data-no95="" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Facing" className="bg-design-status">
          {VIEWS.map((v) => (
            <button key={v} type="button" className={key(mode !== "turn" && view === v)} data-no95="" disabled={mode === "turn"} aria-pressed={mode !== "turn" && view === v} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
          <button type="button" className={key(flip)} data-no95="" aria-pressed={flip} onClick={() => setFlip((f) => !f)}>
            flip
          </button>
          <button type="button" className={key(paused)} data-no95="" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "play" : "pause"}
          </button>
        </div>
      </div>
    </section>
  )
}

export function DesignPanel({ initial, onBack }: { initial?: string; onBack: () => void }) {
  const [notes, setNotes] = useState<DesignNotes>({})
  const [loaded, setLoaded] = useState(false)
  const [id, setId] = useState(initial && IDS.includes(initial) ? initial : PLAYER)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setNotes(loadDesignNotes())
    setLoaded(true)
  }, [])

  const change = (patch: { text?: string; status?: DesignStatus }) => {
    setNotes((old) => {
      const next = withNote(old, id, patch)
      saveDesignNotes(next)
      return next
    })
  }

  const note = notes[id]
  const redos = useMemo(() => redoCount(notes), [notes])
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the text is still in the box to copy by hand
    }
  }

  return (
    <div className="bg-design">
      <ul className="bg-design-list" aria-label="Characters">
        {IDS.map((x) => (
          <li key={x}>
            <button type="button" className={`bg-design-pick${x === id ? " is-on" : ""}`} data-no95="" onClick={() => setId(x)} aria-pressed={x === id}>
              <span>{NAMES[x]}</span>
              {notes[x]?.status === "redo" ? <i className="bg-design-dot is-redo" title={DESIGN_STATUS_LABEL.redo} /> : notes[x]?.status === "done" ? <i className="bg-design-dot is-done" title={DESIGN_STATUS_LABEL.done} /> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="bg-design-main">
        <h4>{NAMES[id]}</h4>
        <Studio id={id} />
        <div className="bg-design-views">
          {VIEWS.map((v) => (
            <figure key={v}>
              <ViewCanvas id={id} view={v} scale={6} />
              <figcaption>{v}</figcaption>
            </figure>
          ))}
        </div>
        <div className="bg-design-status" role="group" aria-label="Design status">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`friend-key bg-key${(note?.status ?? "keep") === s ? " is-on" : ""}`} data-no95="" onClick={() => change({ status: s })} aria-pressed={(note?.status ?? "keep") === s}>
              {DESIGN_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="bg-design-note">
          <span>Notes for the redesign</span>
          <textarea
            value={note?.text ?? ""}
            disabled={!loaded}
            rows={4}
            placeholder="Rounder tail, bigger eyes, keep the white paws…"
            onChange={(e) => change({ text: e.target.value })}
          />
        </label>
        <div className="bg-keys">
          <button type="button" className="friend-key bg-key" data-no95="" onClick={() => void copy(designBrief(id, NAMES[id] ?? id, note))}>
            {copied ? "Copied" : "Copy this brief"}
          </button>
          <button type="button" className="friend-key bg-key" data-no95="" disabled={!redos} onClick={() => void copy(redoBriefs(notes, NAMES))}>
            Copy all redo briefs ({redos})
          </button>
          <a className="friend-key bg-key" data-no95="" href="/lab/baby-gens" target="_blank" rel="noreferrer" title="ComfyUI outputs with their recipes, likes and notes">
            Generation log
          </a>
          <button type="button" className="friend-key bg-key" data-no95="" onClick={onBack}>
            Back to friends
          </button>
        </div>
        <small className="bg-faint">Saved in this browser, apart from the village save.</small>
      </div>
    </div>
  )
}
