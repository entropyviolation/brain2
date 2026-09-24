/**
 * components/ui/window-sand-close.tsx — opt-in window → sand.
 *
 * Any captioned window can use this. On a real close (after unsaved-changes,
 * if that guard exists), call `start()`. The live window hides and a canvas
 * shows the same rectangle crumbling into sand from the ×, dropping, and
 * piling underneath in the colors of its pixels.
 *
 * `prefers-reduced-motion: reduce` skips the canvas and closes immediately.
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { captureWindow } from "./window-sand-capture"
import {
  WINDOW_SAND_MS,
  applySnapshotColors,
  createSandGrid,
  releaseSand,
  stepSand,
  type SandGrid,
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
 */
export function useWindowSandClose({ open, onOpenChange }: UseArgs) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const originRef = useRef<HTMLButtonElement | null>(null)
  const [active, setActive] = useState(false)
  const [geom, setGeom] = useState<WindowSandGeom | null>(null)
  const [capture, setCapture] = useState<Promise<ImageData | null> | null>(null)

  const finish = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const start = useCallback(() => {
    if (windowSandPrefersReducedMotion()) {
      onOpenChange(false)
      return
    }
    const el = panelRef.current
    if (!el) {
      onOpenChange(false)
      return
    }
    const shot = captureWindow(el)
    setCapture(shot)
    setGeom(measureWindow(el, originRef.current))
    setActive(true)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
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

function paint(ctx: CanvasRenderingContext2D, grid: SandGrid, frame: ImageData) {
  const { cols, rows, state, color } = grid
  const data = frame.data
  data.fill(0)
  for (let i = 0; i < state.length; i++) {
    if (state[i] === 0) continue
    const c = color[i] ?? 0
    const o = i * 4
    data[o] = (c >> 16) & 255
    data[o + 1] = (c >> 8) & 255
    data[o + 2] = c & 255
    data[o + 3] = 255
  }
  ctx.putImageData(frame, 0, 0)
}

type CanvasProps = {
  geom: WindowSandGeom
  capture: Promise<ImageData | null> | null
  onDone: () => void
}

export function WindowSandClose({ geom, capture, onDone }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    let dead = false
    let grid: SandGrid | null = null
    let frame: ImageData | null = null
    let ctx: CanvasRenderingContext2D | null = null
    let raf = 0
    const start = performance.now()

    const boot = (shot: ImageData | null) => {
      if (dead || !canvas) return
      grid = createSandGrid(geom, shot)
      canvas.width = grid.cols
      canvas.height = grid.rows
      canvas.style.width = `${grid.cols * grid.grain}px`
      canvas.style.height = `${grid.rows * grid.grain}px`
      ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      frame = ctx.createImageData(grid.cols, grid.rows)
      paint(ctx, grid, frame)
    }

    boot(null)
    const pending = capture
    if (pending) {
      pending.then((shot) => {
        if (dead || !shot || !grid) return
        applySnapshotColors(grid, geom, shot)
      }).catch(() => {})
    }

    const timer = window.setTimeout(() => {
      onDoneRef.current()
    }, WINDOW_SAND_MS)

    // One powder step per 60Hz frame. If a frame arrives late, catch up so the
    // pour still reaches the basin before the wall-clock close. Cap the burst
    // so a stalled tab cannot dump the window in a single paint.
    const STEP_MS = 1000 / 60
    let simPrev = start
    let acc = 0
    if (ctx && grid && frame) {
      const loop = (now: number) => {
        if (dead || !ctx || !grid || !frame) return
        const t = now - start
        releaseSand(grid, t)
        acc += Math.min(200, Math.max(0, now - simPrev))
        simPrev = now
        let burst = 0
        while (acc >= STEP_MS && burst < 12) {
          stepSand(grid, burst % 2 === 0)
          acc -= STEP_MS
          burst += 1
        }
        paint(ctx, grid, frame)
        if (t < WINDOW_SAND_MS) raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [geom, capture])

  if (typeof document === "undefined") return null

  return createPortal(
    <canvas
      ref={canvasRef}
      className="window-sand-canvas"
      data-testid="window-sand-canvas"
      aria-hidden
      style={{
        position: "fixed",
        left: geom.left,
        top: geom.top,
        zIndex: 200,
      }}
    />,
    document.body,
  )
}
