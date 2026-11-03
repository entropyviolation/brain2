/**
 * components/friend-details/PixelOrb.tsx — A task's orb, as a pixel sprite
 *
 * Takes the background-removed orb or gem photo (`iconFor` in
 * `components/Icons/Icon.tsx`), draws it at 16×16, hardens the alpha edge,
 * steps the colors a little, and traces the same warm outline as `PixelIcon`.
 * Shown scaled up with `image-rendering: pixelated`. One small canvas per
 * row; the photo is decoded once by the browser cache.
 */
"use client"

import { useEffect, useRef } from "react"
import { iconFor } from "@/components/Icons/Icon"
import { PIXEL_PALETTE } from "@/components/friend-details/PixelIcon"
import { friendMissionItemId } from "@/lib/friend-mission"
import { useTaskStore } from "@/lib/task-store"

const GRID = 16
const INNER = 14
const STEP = 36

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const OUTLINE = hexRgb(PIXEL_PALETTE.k)

/** Pixelate RGBA in place: hard alpha, stepped color, 1px outline around the shape. */
export function pixelateOrb(data: Uint8ClampedArray, size: number): void {
  const solid = new Uint8Array(size * size)
  for (let i = 0; i < size * size; i += 1) {
    const at = i * 4
    if (data[at + 3] >= 128) {
      solid[i] = 1
      data[at + 3] = 255
      for (let c = 0; c < 3; c += 1) data[at + c] = Math.min(255, Math.round(data[at + c] / STEP) * STEP)
    } else {
      data[at + 3] = 0
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      if (solid[i]) continue
      const near =
        (x > 0 && solid[i - 1]) || (x < size - 1 && solid[i + 1]) || (y > 0 && solid[i - size]) || (y < size - 1 && solid[i + size])
      if (!near) continue
      const at = i * 4
      data[at] = OUTLINE[0]
      data[at + 1] = OUTLINE[1]
      data[at + 2] = OUTLINE[2]
      data[at + 3] = 255
    }
  }
}

export function PixelOrb({ src, size = 18, className }: { src: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !src) return
    let live = true
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      const ctx = live ? canvas.getContext("2d", { willReadFrequently: true }) : null
      if (!ctx) return
      const pad = (GRID - INNER) / 2
      ctx.clearRect(0, 0, GRID, GRID)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, pad, pad, INNER, INNER)
      try {
        const frame = ctx.getImageData(0, 0, GRID, GRID)
        pixelateOrb(frame.data, GRID)
        ctx.putImageData(frame, 0, 0)
      } catch {
        // A cross-origin photo taints the canvas; the soft downsample still reads as a sprite.
      }
    }
    img.src = src
    return () => {
      live = false
    }
  }, [src])

  return (
    <canvas
      ref={ref}
      className={`friend-pixel is-orb${className ? ` ${className}` : ""}`}
      width={GRID}
      height={GRID}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

/** The orb photo for a mission's task: its custom icon, else its stable orb. Habits get a stable orb by id; whims and affection have none. */
export function useMissionOrbSrc(taskId: string | null | undefined): string {
  const itemId = friendMissionItemId(taskId)
  const custom = useTaskStore((s) => (itemId ? s.tasks.find((task) => task.id === itemId)?.icon : undefined))
  if (itemId) return iconFor(itemId, custom)
  if (taskId?.startsWith("habit:")) return iconFor(taskId)
  return ""
}
