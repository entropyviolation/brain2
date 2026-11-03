/**
 * components/BabyGame/pixel.tsx — Sprites and item icons as small canvases
 *
 * `PixelSprite` paints one of the twenty 16×16 species (or the Nestkeeper). `ItemIcon` paints an 8×8 item
 * shape in the item's three tones. Both draw crisp rects, so any `scale` stays sharp.
 */
"use client"

import { useEffect, useRef } from "react"
import { item, SHAPES } from "@/lib/baby-game/items"
import { paintGrid, playerGrid, spriteGrid, SPRITE_PALETTE } from "@/lib/baby-game/sprites"

export function itemGrid(id: string): string[] {
  const def = item(id)
  const shape = SHAPES[def.shape] ?? SHAPES.round!
  const [light, main, dark] = def.tones
  return shape.map((row) => row.replace(/L/g, light).replace(/M/g, main).replace(/D/g, dark))
}

export function gridFor(id: string): string[] {
  return id === "player" ? playerGrid() : spriteGrid(id)
}

function useGrid(grid: string[], scale: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintGrid(ctx, grid, 0, 0, scale)
  }, [grid, scale])
  return ref
}

export function PixelSprite({ id, scale = 4, label }: { id: string; scale?: number; label?: string }) {
  const grid = gridFor(id)
  const ref = useGrid(grid, scale)
  return <canvas ref={ref} width={16 * scale} height={16 * scale} role="img" aria-label={label ?? id} className="bg-pixel" />
}

export function ItemIcon({ id, scale = 3 }: { id: string; scale?: number }) {
  const grid = itemGrid(id)
  const ref = useGrid(grid, scale)
  return <canvas ref={ref} width={8 * scale} height={8 * scale} role="img" aria-label={item(id).name} className="bg-pixel" />
}

export { SPRITE_PALETTE }
