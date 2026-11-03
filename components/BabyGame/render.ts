/**
 * components/BabyGame/render.ts — Paints Mossmere Hollow onto a 304×192 canvas
 *
 * The map is painted once into an offscreen canvas (`buildMapCanvas`); every frame copies the camera's slice, then
 * draws what moves: gather nodes, stations, friends and the player sorted by their feet, the day's light, and rain.
 * All colors are cool or earthy, no yellow. The canvas is shown at 3× with `image-rendering: pixelated`.
 */

import { RESIDENTS } from "@/lib/baby-game/cast"
import { act as actOf, hearts, hour, nodeReady, type GameState } from "@/lib/baby-game/engine"
import { paintGrid, playerGrid, spriteGrid } from "@/lib/baby-game/sprites"
import type { Sim } from "@/lib/baby-game/sim"
import { center } from "@/lib/baby-game/sim"
import { GATES, MAP_H, MAP_W, NODES, STATIONS, T, TILE, tileIndex, type World } from "@/lib/baby-game/world"

export const VIEW_W = 304
export const VIEW_H = 192

const h2 = (x: number, y: number, k = 0) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function paintTile(ctx: CanvasRenderingContext2D, tile: number, tx: number, ty: number, tick = 0) {
  const x = tx * TILE
  const y = ty * TILE
  const r = (k: number) => h2(tx, ty, k)
  const speck = (color: string, n: number, k = 1) => {
    for (let i = 0; i < n; i++) px(ctx, color, x + Math.floor(r(k + i) * 15), y + Math.floor(r(k + i + 9) * 15))
  }
  switch (tile) {
    case T.GRASS:
    case T.FLOWER: {
      px(ctx, "#86cc84", x, y, 16, 16)
      speck("#74b872", 5)
      speck("#9ad896", 3, 20)
      if (tile === T.FLOWER) {
        const colors = ["#ffffff", "#ffb3d1", "#e2ceff", "#b4e2ff"]
        const c = colors[Math.floor(r(5) * 4)]!
        const fx = x + 3 + Math.floor(r(6) * 9)
        const fy = y + 3 + Math.floor(r(7) * 9)
        px(ctx, c, fx, fy)
        px(ctx, c, fx + 1, fy + 1)
        px(ctx, c, fx - 1, fy + 1)
        px(ctx, c, fx, fy + 2)
        px(ctx, "#f0609a", fx, fy + 1)
      }
      break
    }
    case T.DARK:
      px(ctx, "#3f7a52", x, y, 16, 16)
      speck("#356c47", 6)
      speck("#4f8f62", 3, 30)
      break
    case T.PATH:
      px(ctx, "#cdb497", x, y, 16, 16)
      speck("#bba083", 6)
      speck("#dcc7ad", 3, 40)
      break
    case T.SAND:
      px(ctx, "#e4d5c4", x, y, 16, 16)
      speck("#d3c2ad", 5)
      break
    case T.SNOW:
      px(ctx, "#eef4fa", x, y, 16, 16)
      speck("#d3e2ef", 6)
      speck("#ffffff", 3, 50)
      break
    case T.HILL:
      px(ctx, "#a98a6e", x, y, 16, 16)
      speck("#957658", 6)
      speck("#bd9e82", 3, 60)
      break
    case T.HAY:
      px(ctx, "#dcc3ae", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, "#c8ac95", x + Math.floor(r(i) * 12), y + 2 + i * 4, 4, 1)
      break
    case T.WATER: {
      px(ctx, "#5aa8e0", x, y, 16, 16)
      const shift = Math.floor(tick * 3) % 16
      px(ctx, "#8cc8f0", x + ((2 + shift + tx * 3) % 12), y + 4, 4, 1)
      px(ctx, "#8cc8f0", x + ((8 + shift + ty * 5) % 12), y + 11, 3, 1)
      px(ctx, "#4a92cc", x + ((5 + tx) % 11), y + 8, 3, 1)
      break
    }
    case T.BRIDGE:
      px(ctx, "#a67c5e", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, "#8a6046", x, y + i * 4 + 3, 16, 1)
      px(ctx, "#bf967a", x, y, 16, 1)
      break
    case T.WALL:
      px(ctx, "#e9e1ea", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, "#cfc5d2", x, y + i * 4 + 3, 16, 1)
      px(ctx, "#b8aebd", x, y, 1, 16)
      break
    case T.ROOF:
      px(ctx, "#c85a76", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, i % 2 ? "#a8405e" : "#d9718a", x, y + i * 4, 16, 2)
      px(ctx, "#7a2c46", x, y + 15, 16, 1)
      break
    case T.DOOR:
      px(ctx, "#e9e1ea", x, y, 16, 16)
      px(ctx, "#6b4630", x + 3, y + 1, 10, 15)
      px(ctx, "#8a5a44", x + 4, y + 2, 8, 6)
      px(ctx, "#b4e2ff", x + 6, y + 3, 4, 3)
      px(ctx, "#ffb3d1", x + 10, y + 10, 2, 2)
      break
    case T.TREE: {
      px(ctx, "#6b4630", x + 6, y + 10, 4, 6)
      px(ctx, "#5a3628", x + 9, y + 10, 1, 6)
      const dark = r(3) < 0.5
      const c1 = dark ? "#2c7a45" : "#3d9a58"
      const c2 = dark ? "#216238" : "#2f8248"
      const c3 = dark ? "#4fa766" : "#62bd78"
      px(ctx, c2, x + 2, y + 3, 12, 8)
      px(ctx, c1, x + 3, y + 1, 10, 9)
      px(ctx, c1, x + 1, y + 5, 14, 4)
      px(ctx, c3, x + 4, y + 2, 4, 2)
      px(ctx, c3, x + 3, y + 4, 2, 2)
      px(ctx, c2, x + 6, y + 9, 8, 2)
      break
    }
    case T.ROCK: {
      px(ctx, "#8e99a4", x + 2, y + 5, 12, 9)
      px(ctx, "#a7b2bc", x + 3, y + 4, 8, 4)
      px(ctx, "#6c7782", x + 3, y + 11, 11, 3)
      px(ctx, "#c8d2da", x + 4, y + 5, 3, 1)
      break
    }
    case T.GATE:
      px(ctx, "#cdb497", x, y, 16, 16)
      break
    default:
      px(ctx, "#86cc84", x, y, 16, 16)
  }
}

/** The whole map once. Gate tiles are painted as path; closed gates are drawn on top each frame. */
export function buildMapCanvas(world: World): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = MAP_W * TILE
  canvas.height = MAP_H * TILE
  const ctx = canvas.getContext("2d")!
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const tile = world.tiles[tileIndex(tx, ty)]!
      if (tile === T.WATER) continue
      paintTile(ctx, tile, tx, ty)
    }
  }
  return canvas
}

const spriteCache = new Map<string, HTMLCanvasElement>()
function spriteCanvas(id: string): HTMLCanvasElement {
  let c = spriteCache.get(id)
  if (!c) {
    c = document.createElement("canvas")
    c.width = c.height = 16
    paintGrid(c.getContext("2d")!, id === "player" ? playerGrid() : spriteGrid(id), 0, 0, 1)
    spriteCache.set(id, c)
  }
  return c
}

function drawNode(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, ready: boolean, t: number) {
  const dim = !ready
  switch (kind) {
    case "berry":
      px(ctx, "#2f8248", x + 2, y + 6, 12, 8)
      px(ctx, "#3d9a58", x + 3, y + 4, 10, 8)
      px(ctx, "#62bd78", x + 4, y + 5, 3, 2)
      if (!dim) for (const [bx, by] of [[5, 7], [9, 6], [7, 10], [11, 9]] as const) px(ctx, "#e04848", x + bx, y + by, 2, 2)
      break
    case "acorn":
      px(ctx, "#5a3628", x + 7, y + 8, 2, 7)
      px(ctx, dim ? "#3d7a50" : "#3d9a58", x + 3, y + 2, 10, 8)
      if (!dim) for (const [bx, by] of [[5, 5], [9, 4], [8, 8]] as const) px(ctx, "#c48e74", x + bx, y + by, 2, 2)
      break
    case "reed":
      for (const bx of [4, 7, 10]) {
        px(ctx, dim ? "#7aa07a" : "#4fbf5a", x + bx, y + 3 + (bx % 3), 1, 11)
        if (!dim) px(ctx, "#8a5a44", x + bx - 1, y + 2 + (bx % 3), 3, 3)
      }
      break
    case "clover":
      for (const [bx, by] of [[4, 8], [9, 6], [7, 11]] as const) {
        px(ctx, dim ? "#7aa87a" : "#2a9a4a", x + bx, y + by, 3, 3)
        px(ctx, dim ? "#7aa87a" : "#4fbf5a", x + bx + 1, y + by - 1, 1, 5)
      }
      break
    case "pebble":
      px(ctx, "#9aa6b0", x + 3, y + 9, 5, 4)
      px(ctx, "#d6dde2", x + 4, y + 9, 3, 1)
      px(ctx, "#8e99a4", x + 9, y + 7, 4, 4)
      break
    case "feather":
      px(ctx, "#ffffff", x + 4, y + 10, 7, 2)
      px(ctx, "#d6dde2", x + 6, y + 8, 5, 2)
      px(ctx, "#9aa6b0", x + 3, y + 12, 3, 1)
      break
    case "mushroom":
      px(ctx, "#fbf1e6", x + 7, y + 9, 3, 5)
      px(ctx, dim ? "#c89aa8" : "#e04848", x + 4, y + 5, 9, 5)
      if (!dim) px(ctx, "#ffffff", x + 6, y + 6, 2, 2)
      break
    case "shell":
      px(ctx, "#e2ceff", x + 4, y + 8, 8, 5)
      px(ctx, "#9a72e0", x + 6, y + 10, 4, 2)
      px(ctx, "#ffffff", x + 5, y + 8, 2, 1)
      break
    case "dig":
      px(ctx, dim ? "#a98a6e" : "#8a6c52", x + 2, y + 8, 12, 6)
      px(ctx, "#a98a6e", x + 4, y + 6, 8, 4)
      if (!dim) {
        px(ctx, "#5a3628", x + 6, y + 9, 1, 1)
        px(ctx, "#5a3628", x + 9, y + 11, 1, 1)
      }
      break
    case "fish":
      px(ctx, "#8cc8f0", x + 3 + Math.floor(Math.sin(t * 3) * 1.4), y + 6, 8, 1)
      px(ctx, "#8cc8f0", x + 5, y + 9, 5, 1)
      if (!dim) px(ctx, "#d6dde2", x + 7 + Math.floor(Math.sin(t * 2) * 2), y + 7, 2, 1)
      break
  }
  if (ready && Math.sin(t * 4 + x) > 0.82) px(ctx, "#ffffff", x + 12, y + 3, 1, 1)
}

function drawStation(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: GameState, t: number) {
  switch (id) {
    case "bench":
      px(ctx, "#8a5a44", x + 1, y + 6, 14, 4)
      px(ctx, "#c48e74", x + 1, y + 5, 14, 2)
      px(ctx, "#5a3628", x + 2, y + 10, 2, 5)
      px(ctx, "#5a3628", x + 12, y + 10, 2, 5)
      px(ctx, "#9aa6b0", x + 4, y + 3, 4, 2)
      px(ctx, "#f0609a", x + 10, y + 3, 3, 2)
      break
    case "stump":
      px(ctx, "#8a5a44", x + 2, y + 5, 12, 9)
      px(ctx, "#c48e74", x + 2, y + 4, 12, 3)
      px(ctx, "#a67c5e", x + 5, y + 5, 6, 1)
      px(ctx, "#b4e2ff", x + 6, y + 1, 4, 3)
      px(ctx, "#4e9ce8", x + 7, y + 2, 2, 1)
      break
    case "board":
      px(ctx, "#5a3628", x + 7, y + 8, 2, 8)
      px(ctx, "#a67c5e", x + 1, y + 1, 14, 9)
      px(ctx, "#f3eef6", x + 3, y + 2, 4, 4)
      px(ctx, "#ffb3d1", x + 9, y + 3, 4, 4)
      px(ctx, "#b4e2ff", x + 5, y + 6, 4, 3)
      break
    case "lamp": {
      const n = s.parts.length
      px(ctx, "#4a5560", x + 7, y + 5, 2, 11)
      px(ctx, "#4a5560", x + 4, y + 14, 8, 2)
      px(ctx, n >= 4 ? "#9aa6b0" : "#4a5560", x + 3, y + 2, 10, 2)
      px(ctx, "#2b1d2e", x + 4, y + 3, 8, 7)
      const colors = ["#f0609a", "#8cc8f0", "#30b8a8", "#9aa6b0", "#ff9a8a"]
      for (let i = 0; i < 5; i++) if (s.parts.length > i) px(ctx, colors[i]!, x + 5 + (i % 3) * 2, y + 4 + Math.floor(i / 3) * 3, 2, 2)
      if (n >= 5) {
        const glow = 0.5 + Math.sin(t * 3) * 0.2
        ctx.fillStyle = `rgba(255,205,190,${0.2 + glow * 0.2})`
        ctx.beginPath()
        ctx.arc(x + 8, y + 7, 22, 0, Math.PI * 2)
        ctx.fill()
        px(ctx, "#ffffff", x + 7, y + 6, 2, 3)
      }
      break
    }
    case "fire": {
      px(ctx, "#5a3628", x + 2, y + 12, 12, 3)
      px(ctx, "#8a5a44", x + 4, y + 11, 8, 2)
      px(ctx, "#9aa6b0", x + 1, y + 13, 3, 2)
      px(ctx, "#9aa6b0", x + 12, y + 13, 3, 2)
      const f = Math.floor(Math.sin(t * 9) * 1.4)
      px(ctx, "#e04848", x + 5, y + 5 + f, 6, 7)
      px(ctx, "#ff9a8a", x + 6, y + 6, 4, 5)
      px(ctx, "#ffd9e6", x + 7, y + 8, 2, 3)
      break
    }
  }
}

export type Pop = { x: number; y: number; born: number; kind: "heart" | "plus" | "bad" | "text"; text?: string }

export type Frame = {
  s: GameState
  sim: Sim
  world: World
  map: HTMLCanvasElement
  t: number
  pops: Pop[]
  /** Friends the companion's nose says you could hand something to. */
  marked: Set<string>
  petSprite: string
  focus: { kind: string; x: number; y: number } | null
  hearts?: typeof hearts
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: Frame) {
  const { s, sim, t } = f
  ctx.imageSmoothingEnabled = false
  const camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, Math.round(sim.px - VIEW_W / 2)))
  const camY = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, Math.round(sim.py - VIEW_H / 2)))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.drawImage(f.map, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)
  ctx.translate(-camX, -camY)

  // water animates, so it is drawn live over the cached map
  const tx0 = Math.floor(camX / TILE)
  const ty0 = Math.floor(camY / TILE)
  for (let ty = ty0; ty <= ty0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++) {
      if (tx < MAP_W && ty < MAP_H && f.world.tiles[tileIndex(tx, ty)] === T.WATER) paintTile(ctx, T.WATER, tx, ty, t)
    }
  }

  const a = actOf(s)
  for (const g of GATES) {
    if (a >= g.act) continue
    const gx = g.x * TILE
    const gy = g.y * TILE
    px(ctx, "#5a3628", gx, gy + 1, 3, 15)
    px(ctx, "#5a3628", gx + 13, gy + 1, 3, 15)
    px(ctx, "#a67c5e", gx + 2, gy + 3, 12, 3)
    px(ctx, "#a67c5e", gx + 2, gy + 9, 12, 3)
    px(ctx, "#8a5a44", gx + 3, gy + 5, 10, 1)
  }

  for (const [id, st] of Object.entries(STATIONS)) drawStation(ctx, id, st.x * TILE, st.y * TILE, s, t)
  for (const n of NODES) {
    if (n.x * TILE < camX - 16 || n.x * TILE > camX + VIEW_W || n.y * TILE < camY - 16 || n.y * TILE > camY + VIEW_H) continue
    drawNode(ctx, n.kind, n.x * TILE, n.y * TILE, nodeReady(s, n.id), t)
  }

  // everything that stands, sorted by its feet
  type Body = { y: number; draw: () => void }
  const bodies: Body[] = []
  const shadow = (x: number, y: number, w: number) => {
    ctx.fillStyle = "rgba(30,20,40,0.22)"
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 3)
  }
  const night = hour(s) >= 22 || hour(s) < 6
  for (const r of RESIDENTS) {
    if (r.act > a) continue
    const npc = sim.npcs[r.id]!
    bodies.push({
      y: npc.y,
      draw: () => {
        const bob = npc.asleep ? 0 : Math.round(Math.abs(Math.sin(t * 5 + npc.x)) * (npc.path.length ? 1.5 : 0.5))
        shadow(npc.x, npc.y + 6, 10)
        ctx.globalAlpha = npc.asleep ? 0.8 : 1
        ctx.drawImage(spriteCanvas(r.id), Math.round(npc.x - 8), Math.round(npc.y - 13 - bob + (npc.asleep ? 3 : 0)))
        ctx.globalAlpha = 1
        if (npc.asleep) {
          px(ctx, "#b4e2ff", npc.x + 4, npc.y - 14 + Math.floor(Math.sin(t * 2) * 1), 3, 1)
          px(ctx, "#b4e2ff", npc.x + 6, npc.y - 17 + Math.floor(Math.sin(t * 2 + 1) * 1), 2, 1)
        } else if (s.weather === "rain" && !r.rainLover) {
          px(ctx, "#2a7a3e", npc.x - 5, npc.y - 20, 10, 2)
          px(ctx, "#4fbf5a", npc.x - 4, npc.y - 21, 8, 1)
        }
        if (f.marked.has(r.id) && !npc.asleep) {
          const bounce = Math.round(Math.sin(t * 6) * 1.5)
          px(ctx, "#f0609a", npc.x - 1, npc.y - 25 + bounce, 2, 5)
          px(ctx, "#f0609a", npc.x - 1, npc.y - 18 + bounce, 2, 2)
        }
        if (npc.gathering && hour(s) >= 18 && Math.sin(t * 2 + npc.x) > 0.9) px(ctx, "#f0609a", npc.x - 6, npc.y - 18, 1, 1)
      },
    })
  }
  const jump = sim.moving ? Math.round(Math.abs(Math.sin(t * (sim.running ? 14 : 9))) * 2) : 0
  bodies.push({
    y: sim.py,
    draw: () => {
      shadow(sim.px, sim.py + 4, 10)
      ctx.drawImage(spriteCanvas("player"), Math.round(sim.px - 8), Math.round(sim.py - 14 - jump))
    },
  })
  bodies.push({
    y: sim.pet.y,
    draw: () => {
      shadow(sim.pet.x, sim.pet.y + 4, 8)
      ctx.drawImage(spriteCanvas(f.petSprite), Math.round(sim.pet.x - 6), Math.round(sim.pet.y - 11 - (sim.moving ? Math.round(Math.abs(Math.sin(t * 9 + 1)) * 2) : 0)), 12, 12)
    },
  })
  bodies.sort((p, q) => p.y - q.y).forEach((b) => b.draw())

  // floating hearts and numbers
  for (const p of f.pops) {
    const age = t - p.born
    const rise = age * 18
    ctx.globalAlpha = Math.max(0, 1 - age / 1.4)
    if (p.kind === "heart") {
      px(ctx, "#f0609a", p.x - 3, p.y - rise - 2, 2, 2)
      px(ctx, "#f0609a", p.x + 1, p.y - rise - 2, 2, 2)
      px(ctx, "#f0609a", p.x - 3, p.y - rise, 6, 2)
      px(ctx, "#f0609a", p.x - 2, p.y - rise + 2, 4, 1)
      px(ctx, "#f0609a", p.x - 1, p.y - rise + 3, 2, 1)
    } else if (p.kind === "bad") {
      px(ctx, "#4e9ce8", p.x - 1, p.y - rise - 4, 2, 4)
      px(ctx, "#4e9ce8", p.x - 1, p.y - rise + 1, 2, 2)
    } else {
      px(ctx, "#ffffff", p.x - 1, p.y - rise, 3, 1)
      px(ctx, "#ffffff", p.x, p.y - rise - 1, 1, 3)
    }
    ctx.globalAlpha = 1
  }

  // the player's focus ring
  if (f.focus) {
    const pulse = 1 + Math.sin(t * 8)
    ctx.strokeStyle = "rgba(255,255,255,0.9)"
    ctx.lineWidth = 1
    ctx.strokeRect(Math.round(f.focus.x - 9 - pulse * 0.4) + 0.5, Math.round(f.focus.y - 16) + 0.5, 18 + pulse * 0.8, 22)
  }

  // light and weather over everything
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const hr = s.minutes / 60
  let tint = ""
  if (hr >= 17 && hr < 20) tint = `rgba(150,90,170,${(hr - 17) / 3 * 0.28})`
  else if (hr >= 20 || hr < 6) tint = `rgba(20,30,80,${night ? 0.5 : 0.4})`
  else if (hr < 7) tint = "rgba(240,150,170,0.12)"
  if (s.weather === "rain") tint = tint || "rgba(70,100,150,0.16)"
  if (tint) {
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  if (s.weather === "rain") {
    ctx.fillStyle = "rgba(220,235,255,0.7)"
    for (let i = 0; i < 70; i++) {
      const rx = (i * 53 + t * 40) % VIEW_W
      const ry = (i * 37 + t * 150) % VIEW_H
      ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 3)
    }
  }
  if (hr >= 18 && s.parts.length >= 1) {
    // the lit lamp and the fire glow through the evening
    const toScreen = (tx: number, ty: number) => [center(tx) - camX, center(ty) - camY] as const
    for (const [id, radius] of [["fire", 46], ["lamp", 18 + s.parts.length * 8]] as const) {
      const [sx, sy] = toScreen(STATIONS[id].x, STATIONS[id].y)
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, radius)
      g.addColorStop(0, id === "fire" ? "rgba(255,170,150,0.35)" : "rgba(255,200,230,0.3)")
      g.addColorStop(1, "rgba(255,200,200,0)")
      ctx.fillStyle = g
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2)
    }
  }
}
