/**
 * components/BabyGame/ambient.ts — the living ground: swaying grass and flowers, water glints, cloud shadows, falling leaves
 *
 * The cached map is flat, so this paints a thin live layer over the tiles in view. Grass leans away from anything that
 * walks through it. All functions take world coordinates (the caller has already translated by the camera).
 */

import { MAP_H, MAP_W, T, TILE, tileIndex, type World } from "@/lib/baby-game/world"

const h = (a: number, b = 0) => {
  let v = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

const BLOOM = ["#f0609a", "#ffffff", "#9a72e0", "#4e9ce8"]

export type Mover = { x: number; y: number }

/** Grass blades and flower heads: sway on a travelling gust, lean away from `movers`. */
export function drawGrass(ctx: CanvasRenderingContext2D, world: World, t: number, camX: number, camY: number, viewW: number, viewH: number, movers: Mover[]) {
  const tx0 = Math.max(0, Math.floor(camX / TILE))
  const ty0 = Math.max(0, Math.floor(camY / TILE))
  const tx1 = Math.min(MAP_W - 1, Math.floor((camX + viewW) / TILE))
  const ty1 = Math.min(MAP_H - 1, Math.floor((camY + viewH) / TILE))
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = world.tiles[tileIndex(tx, ty)]
      if (tile !== T.GRASS && tile !== T.FLOWER) continue
      const flower = tile === T.FLOWER
      const n = flower ? 2 : h(tx, ty) > 0.4 ? 1 : 0
      for (let i = 0; i < n; i++) {
        const bx = tx * TILE + 2 + Math.floor(h(tx, ty * 7 + i) * (TILE - 4))
        const by = ty * TILE + 6 + Math.floor(h(tx * 3 + i, ty) * (TILE - 8))
        const gust = Math.sin(t * 1.5 - (bx + by * 0.5) * 0.045)
        let lean = gust > 0.55 ? 1 : gust < -0.7 ? -1 : 0
        for (const m of movers) {
          const dx = bx - m.x
          const dy = by - (m.y + 4)
          if (Math.abs(dx) < 10 && Math.abs(dy) < 6) lean = dx >= 0 ? 2 : -2
        }
        if (flower) {
          ctx.fillStyle = "#4f8f4a"
          ctx.fillRect(bx, by - 2, 1, 3)
          ctx.fillStyle = BLOOM[Math.floor(h(tx, ty + i * 11) * BLOOM.length)]!
          ctx.fillRect(bx + lean - 1, by - 4, 2, 2)
          if (Math.sin(t * 2 + tx * 3 + ty) > 0.93) {
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(bx + lean, by - 5, 1, 1)
          }
        } else {
          ctx.fillStyle = i ? "#8fcf7a" : "#6fb05f"
          ctx.fillRect(bx, by - 1, 1, 2)
          ctx.fillRect(bx + lean, by - 3, 1, 2)
        }
      }
    }
  }
}

/** Bright glints that wink on the water. */
export function drawGlints(ctx: CanvasRenderingContext2D, world: World, t: number, camX: number, camY: number, viewW: number, viewH: number) {
  const tx0 = Math.max(0, Math.floor(camX / TILE))
  const ty0 = Math.max(0, Math.floor(camY / TILE))
  const tx1 = Math.min(MAP_W - 1, Math.floor((camX + viewW) / TILE))
  const ty1 = Math.min(MAP_H - 1, Math.floor((camY + viewH) / TILE))
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (world.tiles[tileIndex(tx, ty)] !== T.WATER) continue
      for (let i = 0; i < 2; i++) {
        const ph = h(tx, ty * 5 + i) * 6.28
        const s = Math.sin(t * 0.9 + ph)
        if (s < 0.9) continue
        const gx = tx * TILE + Math.floor(h(tx + i, ty) * 13)
        const gy = ty * TILE + Math.floor(h(tx, ty + i) * 13)
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(gx, gy, s > 0.97 ? 3 : 2, 1)
      }
    }
  }
}

/** A few slow cloud shadows, dithered, in daylight only. */
export function drawCloudShadows(ctx: CanvasRenderingContext2D, t: number, camX: number, camY: number, viewW: number, viewH: number) {
  const span = MAP_W * TILE + 400
  ctx.fillStyle = "rgba(20,50,60,0.13)"
  for (let i = 0; i < 3; i++) {
    const cx = ((t * 4 + i * 520) % span) - 200
    const cy = 120 + h(i, 9) * (MAP_H * TILE - 240)
    const rx = 70 + h(i, 3) * 30
    const ry = 30 + h(i, 4) * 14
    if (cx + rx < camX || cx - rx > camX + viewW || cy + ry < camY || cy - ry > camY + viewH) continue
    const x0 = Math.max(Math.floor(cx - rx), camX - (camX % 2))
    const x1 = Math.min(Math.ceil(cx + rx), camX + viewW)
    const y0 = Math.max(Math.floor(cy - ry), camY - (camY % 2))
    const y1 = Math.min(Math.ceil(cy + ry), camY + viewH)
    for (let y = y0 - (y0 % 2); y < y1; y += 2) {
      for (let x = x0 - (x0 % 2); x < x1; x += 2) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if (d > 1) continue
        if (d > 0.45 && ((x >> 1) + (y >> 1)) & 1) continue
        ctx.fillRect(x, y, 2, 2)
      }
    }
  }
}

const LEAF: Record<string, string | null> = { oak: "#6fa05a", pine: null, birch: "#a8d070", blossom: "#f0a0c0" }

/** One leaf (or petal) at a time lets go of a tree and spirals down. Stateless: a loop per tree. */
export function drawLeaf(ctx: CanvasRenderingContext2D, kind: string, tx: number, ty: number, t: number, cx: number, topY: number, baseY: number) {
  const color = LEAF[kind]
  if (!color) return
  const seed = h(tx, ty)
  if (seed < 0.35) return
  const period = 6 + seed * 6
  const u = ((t + seed * 20) % period) / 2.8
  if (u >= 1) return
  const x = cx + (seed - 0.5) * 18 + Math.sin(u * 7 + seed * 9) * 4
  const y = topY + (baseY - topY) * 0.45 + u * (baseY - topY) * 0.5
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), 2, 1)
  if (Math.floor(u * 10) % 2) ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1)
}
