/**
 * components/BabyGame/pixel.tsx — Sprites and item icons as small canvases
 *
 * `PixelSprite` paints one of the twenty 32×32 species (or the Center of The World). `ItemIcon` paints an 8×8 item
 * shape in the item's three tones. Both draw crisp rects, so any `scale` stays sharp.
 */
"use client"

import { useEffect, useRef } from "react"
import { item, SHAPES } from "@/lib/baby-game/items"
import { paintGrid, playerGrid, spriteGrid, SPRITE_PALETTE, SPRITE_SIZE } from "@/lib/baby-game/sprites"

export function itemGrid(id: string): string[] {
  const def = item(id)
  const shape = SHAPES[def.shape] ?? SHAPES.round!
  const [light, main, dark] = def.tones
  return shape.map((row) => row.replace(/L/g, light).replace(/M/g, main).replace(/D/g, dark))
}

export function gridFor(id: string): string[] {
  return id === "player" ? playerGrid("front") : spriteGrid(id, "front")
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
  return <canvas ref={ref} width={SPRITE_SIZE * scale} height={SPRITE_SIZE * scale} role="img" aria-label={label ?? id} className="bg-pixel" />
}

export function ItemIcon({ id, scale = 3 }: { id: string; scale?: number }) {
  const grid = itemGrid(id)
  const ref = useGrid(grid, scale)
  return <canvas ref={ref} width={8 * scale} height={8 * scale} role="img" aria-label={item(id).name} className="bg-pixel" />
}

export { SPRITE_PALETTE }

/** The tool bar's icons: small hand-drawn grids in the sprite palette. */
export type ToolId = "hand" | "hoe" | "seeds" | "can" | "scythe"

const TOOL_GRIDS: Record<Exclude<ToolId, "seeds">, readonly string[]> = {
  hand: ["..k.k.k.", ".kokokok", "kooooook", "kooooook", ".koooopk", "..koopk.", "...kok..", "........"],
  hoe: ["......kk", "....kkSk", ".....kSk", "...kT.kk", "..kT....", ".kT.....", "kT......", "k......."],
  can: ["........", "..kkk...", "kkBBBkk.", "kBbBBBBk", "kBbBBBDk", "kBBBBBDk", ".kkkkkk.", "........"],
  scythe: ["..kkkk..", ".kSwwSk.", "kS.kkkSk", "k..kT.kk", "...kT...", "...kT...", "...kT...", "...kk..."],
}

export function ToolIcon({ id, seed, scale = 4 }: { id: ToolId; seed?: string | null; scale?: number }) {
  if (id === "seeds") return seed ? <ItemIcon id={seed} scale={scale} /> : <ItemIcon id="glowbean-seed" scale={scale} />
  return <GridIcon grid={TOOL_GRIDS[id]} scale={scale} label={id} />
}

function GridIcon({ grid, scale, label }: { grid: readonly string[]; scale: number; label: string }) {
  const ref = useGrid(grid as string[], scale)
  return <canvas ref={ref} width={8 * scale} height={8 * scale} role="img" aria-label={label} className="bg-pixel" />
}
