"use client"

/**
 * components/BabyGame/Casa.tsx — walking about inside the cottage
 *
 * A mode of `BabyGame.tsx` that covers the stage with its own 304×192 canvas (smoothed by `HiRes`, like the world) and its own
 * loop: arrows or WASD to walk, Shift to run, E at a spot to use it. Esc leaves; the parent's key handler does that. The
 * world stands still meanwhile, like behind every other panel. The plan is `lib/baby-game/casa.ts`, the paint `casa-paint.ts`.
 */

import { useEffect, useRef, useState } from "react"
import { PLACEMENTS } from "@/lib/baby-game/casa-furniture"
import { floorOf, newWalker, spotNear, stepWalker, takeStairs, type Walker } from "@/lib/baby-game/casa"
import { drawCasa } from "./casa-paint"
import { HI, HiRes } from "./hires"
import { CASA_H as VIEW_H, CASA_W as VIEW_W } from "./render"

type Props = {
  night: boolean
  petSprite: string
  /** Out through the door. */
  onExit: () => void
  /** The bed was used; the parent decides whether you are tired enough. */
  onBed: () => void
  /** A thing looked at: its line. */
  onLook: (text: string) => void
}

export function Casa({ night, petSprite, onExit, onBed, onLook }: Props) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const walker = useRef<Walker>(newWalker(0))
  const keys = useRef(new Set<string>())
  /** Pieces switched off (lamps) or playing (the record players), by index into `PLACEMENTS`. */
  const off = useRef(new Set<number>())
  const music = useRef(new Set<number>())
  const rummaged = useRef(0)
  const [label, setLabel] = useState<string | null>(null)
  const [floorName, setFloorName] = useState(floorOf(0).name)
  const cb = useRef({ onExit, onBed, onLook })
  cb.current = { onExit, onBed, onLook }

  useEffect(() => {
    const act = () => {
      const w = walker.current
      const spot = spotNear(w)
      if (!spot) return
      if (spot.kind === "exit") cb.current.onExit()
      else if (spot.kind === "bed") cb.current.onBed()
      else if (spot.kind === "look") cb.current.onLook(spot.text ?? spot.label)
      else if (spot.kind === "use") {
        const pc = PLACEMENTS[spot.piece!]!
        const name = pc.id.replace(/-/g, " ")
        if (spot.use === "lamp") {
          const was = off.current.has(spot.piece!)
          if (was) off.current.delete(spot.piece!)
          else off.current.add(spot.piece!)
          cb.current.onLook(was ? `You switch the ${name} on. The corner gets kinder.` : `You switch the ${name} off. The dark leans in, curious.`)
        } else if (spot.use === "sit") {
          w.x = pc.x
          w.y = pc.y + 7
          w.facing = "front"
          w.sit = true
          cb.current.onLook(pc.look ?? `You sit on the ${name}. It takes you in without a word.`)
        } else if (spot.use === "music") {
          const on = !music.current.has(spot.piece!)
          if (on) music.current.add(spot.piece!)
          else music.current.delete(spot.piece!)
          cb.current.onLook(on ? "The needle lands. Something between rain and a cello fills the room." : "The needle lifts. The room remembers the tune a little longer.")
        } else {
          const finds = ["a button the colour of a pond", "a note that says only: later", "a spool of silver thread", "one glove, very sure of itself", "a dried flower pressed flat as a promise", "nothing, but warm nothing", "a tiny key to something you have not met yet"]
          cb.current.onLook(`In the ${name} you find ${finds[rummaged.current++ % finds.length]}. You put it back where it was happier.`)
        }
      }
      else {
        takeStairs(w, spot)
        setFloorName(floorOf(w.floor).name)
      }
    }
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      const k = e.key.toLowerCase()
      if (k === "e" || k === " " || k === "enter") {
        if (!e.repeat) act()
        return
      }
      keys.current.add(k)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  useEffect(() => {
    const display = canvas?.getContext("2d")
    if (!canvas || !display) return
    const hi = new HiRes(VIEW_W, VIEW_H)
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const real = Math.min(0.5, (now - last) / 1000)
      last = now
      const k = keys.current
      const dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0)
      const dy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0)
      for (let left = real; left > 0; left -= 0.05) stepWalker(walker.current, { dx, dy, run: k.has("shift") }, Math.min(0.05, left))
      const spot = spotNear(walker.current)
      const next = spot ? spot.label : null
      setLabel((p) => (p === next ? p : next))
      drawCasa(hi.lowCtx, { w: walker.current, t: now / 1000, night, petSprite, near: spot?.id ?? null, off: off.current, music: music.current })
      hi.present(display)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [canvas, night, petSprite])

  return (
    <div className="bg-casa">
      <canvas ref={setCanvas} width={VIEW_W * HI} height={VIEW_H * HI} className="bg-canvas" aria-label={floorName} />
      <div className="bg-zone">{floorName}</div>
      {label ? (
        <div className="bg-prompt">
          <kbd>E</kbd> {label}
        </div>
      ) : null}
      <div className="bg-casa-hint">Esc: out the door</div>
    </div>
  )
}
