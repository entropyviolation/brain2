"use client"

/**
 * components/BabyGame/Casa.tsx — walking about inside the cottage
 *
 * A mode of `BabyGame.tsx` that covers the stage with its own 304×192 canvas (smoothed by `HiRes`, like the world) and its own
 * loop: arrows or WASD to walk, Shift to run, E at a spot to use it. Esc leaves; the parent's key handler does that. The
 * world stands still meanwhile, like behind every other panel. The plan is `lib/baby-game/casa.ts`, the paint `casa-paint.ts`.
 */

import { useEffect, useRef, useState } from "react"
import { floorOf, newWalker, spotNear, stepWalker, takeStairs, type Walker } from "@/lib/baby-game/casa"
import { drawCasa } from "./casa-paint"
import { HI, HiRes } from "./hires"
import { VIEW_H, VIEW_W } from "./render"

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
      drawCasa(hi.lowCtx, { w: walker.current, t: now / 1000, night, petSprite, near: spot?.id ?? null })
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
