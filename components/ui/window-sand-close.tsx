/**
 * components/ui/window-sand-close.tsx — opt-in window → sand.
 *
 * Any captioned window can use this. On a real close (after unsaved-changes,
 * if that guard exists), call `start()`. The live window hides and a canvas
 * shows the same rectangle breaking into tiny lit grains from the ×. They
 * tumble, bounce, and heap into a dune. A click on the background, Escape,
 * or the skip × leaves immediately. If it is left alone the wind takes it.
 * Then the dialog unmounts.
 *
 * `prefers-reduced-motion: reduce` skips the canvas and closes immediately.
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { captureWindow } from "./window-sand-capture"
import {
  WINDOW_SAND_MS,
  WINDOW_SAND_PILE_AT,
  WINDOW_SAND_WIND_AT,
  WINDOW_SAND_WIND_MS,
  applySnapshotColors,
  beginWind,
  createSandWorld,
  paintSand,
  sandCanvasBox,
  stepSandWorld,
  type SandWorld,
  type WindowSandGeom,
} from "./window-sand-sim"
import "./window-sand-close.css"

export type { WindowSandGeom }
export { WINDOW_SAND_MS }

export function windowSandPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function measureWindow(el: HTMLElement, origin: HTMLElement | null): WindowSandGeom {
  const box = el.getBoundingClientRect()
  const closeBox = origin?.getBoundingClientRect()
  return {
    left: box.left,
    top: box.top,
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    originX: closeBox ? closeBox.left + closeBox.width / 2 : box.right - 14,
    originY: closeBox ? closeBox.top + closeBox.height / 2 : box.top + 12,
  }
}

type UseArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Wire a window to the sand close.
 * Put `panelRef` on the window element, `originRef` on its × button,
 * and add `hostClass` plus `sourceClass` (when active) to that window.
 * Render `<WindowSandClose />` with the returned props.
 * A second `start()` while sand is playing does nothing, so a click that
 * dismisses the dune cannot restart the pour.
 */
export function useWindowSandClose({ open, onOpenChange }: UseArgs) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const originRef = useRef<HTMLButtonElement | null>(null)
  const activeRef = useRef(false)
  const [active, setActive] = useState(false)
  const [geom, setGeom] = useState<WindowSandGeom | null>(null)
  const [capture, setCapture] = useState<Promise<ImageData | null> | null>(null)

  const finish = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const start = useCallback(() => {
    if (activeRef.current) return
    if (windowSandPrefersReducedMotion()) {
      onOpenChange(false)
      return
    }
    const el = panelRef.current
    if (!el) {
      onOpenChange(false)
      return
    }
    activeRef.current = true
    const shot = captureWindow(el)
    setCapture(shot)
    setGeom(measureWindow(el, originRef.current))
    setActive(true)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
      activeRef.current = false
      setActive(false)
      setGeom(null)
      setCapture(null)
    }
  }, [open])

  const sourceClass = active ? "window-sand-source" : ""

  return {
    panelRef,
    originRef,
    active,
    geom,
    capture,
    start,
    finish,
    /** Always on the window, so the closed-state zoom cannot flash it back. */
    hostClass: "window-sand-host",
    sourceClass,
  }
}

type CanvasProps = {
  geom: WindowSandGeom
  capture: Promise<ImageData | null> | null
  onDone: () => void
}

export function WindowSandClose({ geom, capture, onDone }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)
  const skipRef = useRef<() => void>(() => {})
  onDoneRef.current = onDone

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    let dead = false
    let world: SandWorld | null = null
    let frame: ImageData | null = null
    let ctx: CanvasRenderingContext2D | null = null
    let raf = 0
    let endTimer = 0
    let hurried = false
    let wantWind = false
    const start = performance.now()
    const box = sandCanvasBox(geom)

    const finish = () => {
      if (dead) return
      dead = true
      onDoneRef.current()
    }
    skipRef.current = finish

    const boot = (shot: ImageData | null) => {
      if (dead || !canvas) return
      world = createSandWorld(geom, shot)
      canvas.width = box.width
      canvas.height = box.height
      canvas.style.width = `${box.width}px`
      canvas.style.height = `${box.height}px`
      ctx = canvas.getContext("2d")
      if (!ctx) return
      frame = ctx.createImageData(box.width, box.height)
      paintSand(world, frame.data, box.width, box.height, box.padX, box.padTop)
      ctx.putImageData(frame, 0, 0)
    }

    boot(null)
    const pending = capture
    if (pending) {
      pending.then((shot) => {
        if (dead || !shot || !world || !ctx || !frame) return
        applySnapshotColors(world, geom, shot)
      }).catch(() => {})
    }

    endTimer = window.setTimeout(finish, WINDOW_SAND_MS)

    const onDismiss = (event: PointerEvent) => {
      const raw = event.target
      const el = raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null
      if (el?.closest(".window-sand-skip")) return
      event.preventDefault()
      event.stopPropagation()
      finish()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopImmediatePropagation()
        finish()
        return
      }
      if (event.key === "Enter") wantWind = true
    }
    window.addEventListener("pointerdown", onDismiss, true)
    window.addEventListener("keydown", onKey, true)

    let simPrev = start
    const loop = (now: number) => {
      if (dead || !ctx || !world || !frame) return
      const t = now - start
      if (wantWind && !hurried && t >= WINDOW_SAND_PILE_AT && t < world.windAt) {
        hurried = true
        beginWind(world, t)
        window.clearTimeout(endTimer)
        endTimer = window.setTimeout(finish, WINDOW_SAND_WIND_MS)
      } else if (!hurried && t >= WINDOW_SAND_WIND_AT) {
        hurried = true
      }
      const dt = Math.min(100, Math.max(0, now - simPrev))
      simPrev = now
      stepSandWorld(world, t, dt)
      paintSand(world, frame.data, box.width, box.height, box.padX, box.padTop)
      ctx.putImageData(frame, 0, 0)
      if (!dead && t < WINDOW_SAND_MS + WINDOW_SAND_WIND_MS) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      window.clearTimeout(endTimer)
      window.removeEventListener("pointerdown", onDismiss, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [geom, capture])

  if (typeof document === "undefined") return null

  const box = sandCanvasBox(geom)

  return createPortal(
    <>
      <canvas
        ref={canvasRef}
        className="window-sand-canvas"
        data-testid="window-sand-canvas"
        aria-hidden
        style={{
          position: "fixed",
          left: box.left,
          top: box.top,
          zIndex: 200,
        }}
      />
      <button
        type="button"
        className="window-sand-skip"
        aria-label="Skip"
        style={{ pointerEvents: "auto", zIndex: 400 }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          skipRef.current()
        }}
      >
        ×
      </button>
    </>,
    document.body,
  )
}
