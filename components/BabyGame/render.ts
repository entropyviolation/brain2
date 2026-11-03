/**
 * components/BabyGame/render.ts — Paints Mossmere Hollow onto a 304×192 canvas
 *
 * The map is painted once into an offscreen canvas (`buildMapCanvas`); every frame copies the camera's slice, then
 * draws what moves: gather nodes, stations, friends and the player sorted by their feet, the day's light, and rain.
 * All colors are cool or earthy, no yellow. The canvas is shown at 3× with `image-rendering: pixelated`.
 */

import { RESIDENTS } from "@/lib/baby-game/cast"
import { act as actOf, hearts, hour, nodeReady, type GameState } from "@/lib/baby-game/engine"
import { paintGrid, playerGrid, spriteGrid, SPRITE_FOOT, SPRITE_SIZE } from "@/lib/baby-game/sprites"
import type { Sim } from "@/lib/baby-game/sim"
import { center } from "@/lib/baby-game/sim"
import { CROPS } from "@/lib/baby-game/farm"
import { ZONES, zoneAt } from "@/lib/baby-game/world"
import { drawCampfire, drawCrop, drawNodeArt, drawRain, HOUSE_TILES, paintHouse } from "./art"
import { treeArt, treeAt } from "./trees"
import { GATES, MAP_H, MAP_W, NODES, PLOTS, STATIONS, T, TILE, tileIndex, type World } from "@/lib/baby-game/world"

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

/** Smooth value noise, so neighboring tiles of grass shade into one another instead of repeating. */
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = h2(xi, yi, 77)
  const b = h2(xi + 1, yi, 77)
  const c = h2(xi, yi + 1, 77)
  const d = h2(xi + 1, yi + 1, 77)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

type Nb = { n: number; e: number; s: number; w: number }

function paintTile(ctx: CanvasRenderingContext2D, tile: number, tx: number, ty: number, tick = 0, nb?: Nb) {
  const x = tx * TILE
  const y = ty * TILE
  const r = (k: number) => h2(tx, ty, k)
  const speck = (color: string, n: number, k = 1) => {
    for (let i = 0; i < n; i++) px(ctx, color, x + Math.floor(r(k + i) * 15), y + Math.floor(r(k + i + 9) * 15))
  }
  const blade = (color: string, n: number, k = 1) => {
    for (let i = 0; i < n; i++) {
      const bx = x + 1 + Math.floor(r(k + i) * 13)
      const by = y + 2 + Math.floor(r(k + i + 9) * 12)
      px(ctx, color, bx, by, 1, 2)
      px(ctx, color, bx + 1, by - 1, 1, 1)
    }
  }
  switch (tile) {
    case T.GRASS:
    case T.FLOWER: {
      {
        const n = vnoise(tx * 0.3, ty * 0.3) * 0.7 + vnoise(tx * 0.9 + 9, ty * 0.9) * 0.3
        px(ctx, n < 0.4 ? "#6fb865" : n < 0.62 ? "#7cc46e" : "#8ed17a", x, y, 16, 16)
        // soft mottling inside the tile, so no two tiles read the same
        if (r(30) < 0.5) px(ctx, n < 0.5 ? "#74be68" : "#88cd78", x + 2 + Math.floor(r(31) * 8), y + 2 + Math.floor(r(32) * 8), 4, 3)
        if (r(33) < 0.4) px(ctx, n < 0.5 ? "#68b25e" : "#7cc46e", x + 2 + Math.floor(r(34) * 8), y + 8 + Math.floor(r(35) * 5), 3, 2)
      }
      blade("#58a553", 4)
      blade("#a6e08f", 2, 20)
      // a tuft: three blades leaning, lit on the left
      if (r(36) < 0.35) {
        const tx0 = x + 3 + Math.floor(r(37) * 9)
        const ty0 = y + 6 + Math.floor(r(38) * 8)
        px(ctx, "#3f8a4a", tx0, ty0, 1, 4)
        px(ctx, "#58a553", tx0 + 1, ty0 - 1, 1, 5)
        px(ctx, "#a6e08f", tx0 - 1, ty0 + 1, 1, 3)
        px(ctx, "#3f8a4a", tx0 + 2, ty0 + 1, 1, 3)
      }
      if (tile === T.FLOWER) {
        const colors = ["#e8506a", "#ff9db8", "#ffffff", "#c9a8ff"]
        for (let n = 0; n < 2; n++) {
          const c = colors[Math.floor(r(5 + n) * 4)]!
          const fx = x + 2 + Math.floor(r(6 + n * 3) * 11)
          const fy = y + 3 + Math.floor(r(7 + n * 3) * 10)
          px(ctx, "#3f8a4a", fx, fy + 1, 1, 3)
          px(ctx, c, fx - 1, fy, 3, 1)
          px(ctx, c, fx, fy - 1, 1, 3)
          px(ctx, "#fbf1e6", fx, fy)
        }
      }
      break
    }
    case T.DARK:
      px(ctx, "#356b48", x, y, 16, 16)
      speck("#2b5a3c", 6)
      speck("#47805a", 3, 30)
      speck("#6b4a38", 2, 40)
      break
    case T.PATH: {
      px(ctx, "#d9c19a", x, y, 16, 16)
      speck("#c7ac84", 6)
      speck("#e8d5b4", 3, 40)
      // a few set stones
      for (let i = 0; i < 2; i++) {
        if (r(50 + i) < 0.4) {
          const sx = x + 2 + Math.floor(r(52 + i) * 10)
          const sy = y + 2 + Math.floor(r(54 + i) * 10)
          px(ctx, "#a89472", sx, sy + 1, 3, 2)
          px(ctx, "#c9b794", sx, sy, 3, 1)
        }
      }
      // grass creeping in from any side that borders grass
      if (nb) {
        const edge = (side: number, horizontal: boolean, far: boolean, k: number) => {
          if (side === T.PATH || side === T.BRIDGE || side === T.DOOR || side === T.GATE || side === T.SAND || side === T.STAIRS) return
          for (let i = 0; i < 16; i++) {
            const depth = 1 + Math.floor(r(k + i) * 3)
            const col = r(k + i + 40) < 0.5 ? "#58a553" : "#7cc46e"
            if (horizontal) px(ctx, col, x + i, far ? y + 16 - depth : y, 1, depth)
            else px(ctx, col, far ? x + 16 - depth : x, y + i, depth, 1)
          }
        }
        edge(nb.n, true, false, 200)
        edge(nb.s, true, true, 240)
        edge(nb.w, false, false, 280)
        edge(nb.e, false, true, 320)
      }
      break
    }
    case T.SAND:
      px(ctx, "#ecdcb8", x, y, 16, 16)
      speck("#dccaa2", 5)
      speck("#f6ead0", 2, 20)
      break
    case T.SNOW:
      px(ctx, "#eef4fa", x, y, 16, 16)
      speck("#cfe0ee", 6)
      speck("#ffffff", 3, 50)
      break
    case T.HILL: {
      // bare rock and earth, with moss gathering in soft patches that run across tile edges
      const m = vnoise(tx * 0.45 + 3, ty * 0.45) * 0.7 + vnoise(tx * 1.3, ty * 1.3 + 5) * 0.3
      px(ctx, "#9c8a76", x, y, 16, 16)
      speck("#877664", 6)
      speck("#b3a28c", 3, 60)
      if (m > 0.52) {
        px(ctx, m > 0.64 ? "#6aa05a" : "#7fb06a", x, y, 16, 16)
        blade("#4f8f4a", 3, 80)
        blade("#a6e08f", 2, 90)
        speck("#5f9a52", 4, 95)
      } else if (m > 0.44) {
        for (let i = 0; i < 4; i++) px(ctx, "#7fb06a", x + Math.floor(r(100 + i) * 13), y + Math.floor(r(110 + i) * 13), 3, 2)
      }
      if (r(70) < 0.14) {
        px(ctx, "#8a8294", x + 3, y + 8, 6, 4)
        px(ctx, "#b8b0c4", x + 3, y + 8, 6, 1)
        px(ctx, "#6a6274", x + 3, y + 11, 6, 1)
      }
      break
    }
    case T.HAY: {
      const m = vnoise(tx * 0.4, ty * 0.4 + 8)
      px(ctx, m > 0.55 ? "#7cc46e" : "#dcc3ae", x, y, 16, 16)
      if (m > 0.55) {
        blade("#58a553", 4)
        blade("#a6e08f", 2, 20)
      } else {
        for (let i = 0; i < 4; i++) px(ctx, "#c8ac95", x + Math.floor(r(i) * 12), y + 2 + i * 4, 4, 1)
        for (let i = 0; i < 3; i++) px(ctx, "#ecd9c8", x + Math.floor(r(20 + i) * 12), y + 1 + i * 5, 3, 1)
      }
      break
    }
    case T.WATER: {
      px(ctx, "#3f86c8", x, y, 16, 16)
      const shift = Math.floor(tick * 3) % 16
      px(ctx, "#6fb0e6", x + ((2 + shift + tx * 3) % 12), y + 4, 4, 1)
      px(ctx, "#6fb0e6", x + ((8 + shift + ty * 5) % 12), y + 11, 3, 1)
      px(ctx, "#2f6fb0", x + ((5 + tx) % 11), y + 8, 3, 1)
      break
    }
    case T.BRIDGE:
      px(ctx, "#a67c5e", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, "#8a6046", x, y + i * 4 + 3, 16, 1)
      px(ctx, "#bf967a", x, y, 16, 1)
      break
    case T.WALL:
      px(ctx, "#efe8dc", x, y, 16, 16)
      px(ctx, "#8a5a44", x, y, 2, 16)
      px(ctx, "#8a5a44", x + 14, y, 2, 16)
      px(ctx, "#d6ccbb", x + 2, y + 8, 12, 1)
      px(ctx, "#b8ab94", x + 2, y + 15, 12, 1)
      break
    case T.ROOF:
      px(ctx, "#b9764a", x, y, 16, 16)
      for (let i = 0; i < 4; i++) px(ctx, i % 2 ? "#a5633b" : "#cd8a5c", x, y + i * 4, 16, 2)
      px(ctx, "#7a4326", x, y + 15, 16, 1)
      break
    case T.DOOR:
      px(ctx, "#efe8dc", x, y, 16, 16)
      px(ctx, "#6b4630", x + 3, y + 1, 10, 15)
      px(ctx, "#8a5a44", x + 4, y + 2, 8, 6)
      px(ctx, "#b4d8f0", x + 6, y + 3, 4, 3)
      px(ctx, "#e8506a", x + 10, y + 10, 2, 2)
      break
    case T.TREE: {
      const pine = r(3) < 0.4
      if (pine) {
        px(ctx, "#5a3628", x + 7, y + 11, 2, 5)
        const tiers: Array<[number, number, number]> = [[2, 1, 6], [1, 5, 8], [0, 9, 10]]
        for (const [inset, ty0, w] of tiers) {
          const cx = x + 8 - w / 2 - (inset ? 0 : 0)
          px(ctx, "#1f5a3a", cx, y + ty0 + 1, w, 4)
          px(ctx, "#2b7a4a", cx + 1, y + ty0, w - 2, 3)
          px(ctx, "#4fa066", cx + 2, y + ty0, 2, 1)
        }
        px(ctx, "#1f5a3a", x + 7, y, 2, 2)
      } else {
        px(ctx, "#6b4630", x + 6, y + 9, 4, 7)
        px(ctx, "#4e3224", x + 9, y + 9, 1, 7)
        const light = r(4) < 0.5
        const c1 = light ? "#3d9a58" : "#2c8048"
        const c2 = light ? "#2a7a45" : "#1f6238"
        const c3 = light ? "#7fd08a" : "#62bd78"
        px(ctx, c2, x + 1, y + 4, 14, 8)
        px(ctx, c1, x + 2, y + 1, 12, 9)
        px(ctx, c1, x, y + 5, 16, 4)
        px(ctx, c3, x + 4, y + 2, 5, 2)
        px(ctx, c3, x + 2, y + 5, 3, 2)
        px(ctx, c3, x + 10, y + 4, 2, 2)
        px(ctx, c2, x + 3, y + 10, 10, 2)
        if (r(8) < 0.25) px(ctx, "#e8506a", x + 11, y + 6, 2, 2)
      }
      break
    }
    case T.ROCK: {
      px(ctx, "#8e99a4", x + 2, y + 5, 12, 9)
      px(ctx, "#a7b2bc", x + 3, y + 4, 8, 4)
      px(ctx, "#6c7782", x + 3, y + 11, 11, 3)
      px(ctx, "#c8d2da", x + 4, y + 5, 3, 1)
      px(ctx, "#6fa05a", x + 3, y + 4, 4, 1)
      px(ctx, "#6fa05a", x + 9, y + 12, 4, 2)
      break
    }
    case T.SOIL:
      px(ctx, "#8a6048", x, y, 16, 16)
      speck("#74503a", 5)
      speck("#a37860", 3, 70)
      break
    case T.STONE: {
      // a ruined wall: warm blocks with moss on the shady side
      px(ctx, "#d8cdb8", x, y, 16, 16)
      for (let row = 0; row < 4; row++) {
        px(ctx, "#b8ab94", x, y + row * 4 + 3, 16, 1)
        const off = row % 2 ? 4 : 10
        px(ctx, "#b8ab94", x + off, y + row * 4, 1, 3)
      }
      px(ctx, "#efe6d4", x, y, 16, 1)
      if (r(80) < 0.6) px(ctx, "#6fa05a", x + Math.floor(r(81) * 9), y + 9 + Math.floor(r(82) * 5), 5, 2)
      break
    }
    case T.ARCH: {
      // a pillar with the spring of an arch at its top
      px(ctx, "#d8cdb8", x + 2, y, 12, 16)
      px(ctx, "#efe6d4", x + 2, y, 3, 16)
      px(ctx, "#b8ab94", x + 11, y, 3, 16)
      px(ctx, "#cdbfa6", x, y + 1, 16, 3)
      px(ctx, "#efe6d4", x, y + 1, 16, 1)
      px(ctx, "#6fa05a", x + 3, y + 10, 3, 2)
      px(ctx, "#6fa05a", x + 9, y + 13, 3, 2)
      break
    }
    case T.STAIRS: {
      // steps that run one way here and the other way next door
      const flip = (tx + ty) % 2 === 0
      px(ctx, "#cdbfa6", x, y, 16, 16)
      for (let i = 0; i < 4; i++) {
        const sy = flip ? y + i * 4 : y + 12 - i * 4
        px(ctx, i % 2 ? "#e2d6c0" : "#efe6d4", x, sy, 16, 3)
        px(ctx, "#a89472", x, flip ? sy + 3 : sy - 1, 16, 1)
      }
      px(ctx, "#6fa05a", x + 1, y + 14, 3, 1)
      break
    }
    case T.GATE:
      px(ctx, "#d9c19a", x, y, 16, 16)
      break
    default:
      px(ctx, "#7cc46e", x, y, 16, 16)
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
      // a tree is drawn standing, later; the map only paints the ground beneath it
      const at = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.TREE : world.tiles[tileIndex(x, y)]!)
      paintTile(ctx, tile === T.TREE ? (zoneAt(tx, ty) === "wood" ? T.DARK : T.GRASS) : tile, tx, ty, 0, { n: at(tx, ty - 1), e: at(tx + 1, ty), s: at(tx, ty + 1), w: at(tx - 1, ty) })
    }
  }
  paintHouse(ctx, HOUSE_TILES.x * TILE, HOUSE_TILES.y * TILE)
  return canvas
}

const spriteCache = new Map<string, HTMLCanvasElement>()
function spriteCanvas(id: string, view: "front" | "side" = "front"): HTMLCanvasElement {
  const key = `${id}:${view}`
  let c = spriteCache.get(key)
  if (!c) {
    c = document.createElement("canvas")
    c.width = c.height = SPRITE_SIZE
    paintGrid(c.getContext("2d")!, id === "player" ? playerGrid(view) : spriteGrid(id, view), 0, 0, 1)
    spriteCache.set(key, c)
  }
  return c
}

/** Stand a sprite on a ground line, facing right, or mirrored to face left. */
function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, ground: number, face: 1 | -1) {
  const top = Math.round(ground - SPRITE_FOOT - 1)
  if (face === 1) {
    ctx.drawImage(img, Math.round(x - SPRITE_SIZE / 2), top)
    return
  }
  ctx.save()
  ctx.translate(Math.round(x), 0)
  ctx.scale(-1, 1)
  ctx.drawImage(img, -SPRITE_SIZE / 2, top)
  ctx.restore()
}

function drawNode(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, ready: boolean, t: number) {
  drawNodeArt(ctx, kind, x, y, ready, t)
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
      const colors = ["#f0609a", "#b5c0ff", "#30b8a8", "#9aa6b0", "#ff9a8a"]
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
    case "glade": {
      // a ring of glowcaps around a jar on a stump
      for (const [bx, by] of [[1, 9], [13, 9], [3, 13], [11, 13], [7, 14]] as const) {
        px(ctx, "#6b5a8a", bx, y + by, 2, 2)
        px(ctx, "#b6f0a4", bx, y + by - 1, 2, 1)
      }
      px(ctx, "#8a5a44", x + 4, y + 8, 8, 6)
      px(ctx, "#c48e74", x + 4, y + 7, 8, 2)
      px(ctx, "rgba(220,240,255,0.7)", x + 5, y + 2, 6, 6)
      px(ctx, "#9a72e0", x + 5, y + 1, 6, 2)
      if (Math.sin(t * 3) > -0.3) px(ctx, "#f4ffe8", x + 7, y + 4, 2, 2)
      break
    }
    case "falls": {
      px(ctx, "#6b5a68", x + 1, y + 9, 14, 6)
      px(ctx, "#8fbf6a", x + 1, y + 8, 14, 3)
      px(ctx, "#6b5a68", x + 4, y + 4, 8, 5)
      px(ctx, "#8fbf6a", x + 4, y + 3, 8, 2)
      px(ctx, "#b5d8f6", x + 7, y, 2, 4)
      px(ctx, "#ffffff", x + 7, y + Math.floor((t * 8) % 4), 1, 2)
      break
    }
    case "echo": {
      px(ctx, "rgba(240,230,255,0.35)", x + 3, y, 10, 5)
      px(ctx, "rgba(240,230,255,0.25)", x + 2, y + 5, 12, 5)
      px(ctx, "#2f8248", x + 7, y + 8, 2, 7)
      for (const [dx, dy, c] of [[7, 3, "#f0609a"], [3, 7, "#4e9ce8"], [11, 7, "#9a72e0"], [7, 11, "#30b8a8"]] as const) px(ctx, c, x + dx - 1, y + dy - 1, 4, 4)
      px(ctx, "#fbf1e6", x + 6, y + 6, 4, 4)
      px(ctx, "#2b1d2e", x + 7, y + 7, 1, 1)
      px(ctx, "#2b1d2e", x + 9, y + 7, 1, 1)
      break
    }
    case "stairs": {
      for (let i = 0; i < 5; i++) {
        px(ctx, i % 2 ? "#d6c4b2" : "#e9dccd", x + 1 + i * 3, y + 12 - i * 2, 14 - i * 3, 3)
        px(ctx, "#a8927e", x + 1 + i * 3, y + 14 - i * 2, 14 - i * 3, 1)
      }
      px(ctx, "#2b1d2e", x + 12, y + 2, 3, 5)
      px(ctx, "#f6cfe0", x + 12, y + 3, 3, 3)
      break
    }
    case "fire":
      drawCampfire(ctx, x, y, t)
      break
  }
}

const CROP_COLOR: Record<string, [string, string]> = {
  glowbean: ["#4fd68a", "#b6f0a4"], puffroot: ["#9a72e0", "#e2ceff"], moonmelon: ["#30b8a8", "#a8f4e6"],
  spiralkale: ["#4fbf5a", "#b6f0a4"], twinklegourd: ["#f0609a", "#ffb3d1"], snowpearl: ["#b4e2ff", "#ffffff"],
}

function drawPlot(ctx: CanvasRenderingContext2D, x: number, y: number, p: GameState["farm"][string] | undefined, t: number) {
  if (!p?.tilled) return
  px(ctx, p.watered ? "#5c3f58" : "#7a5070", x + 1, y + 1, 14, 14)
  for (let i = 0; i < 3; i++) {
    px(ctx, p.watered ? "#4a3048" : "#654060", x + 1, y + 3 + i * 4, 14, 1)
    px(ctx, p.watered ? "#78577a" : "#946a86", x + 1, y + 4 + i * 4, 14, 1)
  }
  if (p.watered) px(ctx, "#b5c0ff", x + 3 + Math.floor(Math.abs(Math.sin(t * 2 + x)) * 8), y + 3, 1, 1)
  if (!p.crop) return
  drawCrop(ctx, p.crop, x, y, p.grown / (CROPS[p.crop]!.days), t)
}

/** Butterflies drifting over the flowers. Scenery: nothing happens if you walk into one. */
const FLIES: Array<{ hx: number; hy: number; c: [string, string]; k: number }> = [
  { hx: 20, hy: 17, c: ["#ffb3d1", "#e8506a"], k: 0 }, { hx: 28, hy: 16, c: ["#b4d8f0", "#3f86c8"], k: 1 },
  { hx: 26, hy: 23, c: ["#e2ceff", "#8a6fe0"], k: 2 }, { hx: 8, hy: 8, c: ["#ffffff", "#9aa6b0"], k: 3 },
  { hx: 40, hy: 14, c: ["#ffb3d1", "#e8506a"], k: 4 }, { hx: 20, hy: 30, c: ["#ffd9c0", "#e8915a"], k: 5 },
  { hx: 38, hy: 33, c: ["#b4d8f0", "#3f86c8"], k: 6 }, { hx: 8, hy: 31, c: ["#ffffff", "#9aa6b0"], k: 7 },
]

const flyY = (p: (typeof FLIES)[number], t: number) => p.hy * TILE + 8 + Math.cos(t * 0.37 + p.k) * 10

function drawFly(ctx: CanvasRenderingContext2D, p: (typeof FLIES)[number], t: number) {
  const x = p.hx * TILE + 8 + Math.sin(t * 0.5 + p.k * 2) * 22
  const y = flyY(p, t) - 6 + Math.sin(t * 4 + p.k) * 2
  const flap = Math.sin(t * 14 + p.k * 3) > 0 ? 3 : 1
  ctx.fillStyle = "rgba(30,20,40,0.15)"
  ctx.fillRect(Math.round(x - 2), Math.round(y + 9), 4, 1)
  px(ctx, p.c[1], x - flap - 1, y - 2, flap, 3)
  px(ctx, p.c[1], x + 1, y - 2, flap, 3)
  px(ctx, p.c[0], x - flap - 1, y - 1, flap - 1 || 1, 2)
  px(ctx, p.c[0], x + 2, y - 1, flap - 1 || 1, 2)
  px(ctx, "#2b1d2e", x, y - 2, 1, 4)
}

export type Pop = { x: number; y: number; born: number; kind: "heart" | "plus" | "bad" | "text"; text?: string }

/** Mirror the shore into the water: each row below the water's top edge copies the row above it, rippled and faded. */
function reflect(ctx: CanvasRenderingContext2D, map: HTMLCanvasElement, world: World, tx: number, ty: number, t: number) {
  let top = ty
  while (top > 0 && world.tiles[tileIndex(tx, top - 1)] === T.WATER) top -= 1
  if (top === 0) return
  const depth = (ty - top) * TILE
  for (let row = 0; row < TILE; row++) {
    const d = depth + row
    const src = top * TILE - 1 - d
    if (src < 0) break
    const wobble = Math.round(Math.sin(t * 2.2 + d * 0.55 + tx) * (0.8 + d / 22))
    ctx.globalAlpha = Math.max(0.12, 0.62 - d / 130)
    ctx.drawImage(map, tx * TILE + wobble, src, TILE, 1, tx * TILE, ty * TILE + row, TILE, 1)
  }
  ctx.globalAlpha = 1
  // a cool veil, a bright waterline, and a few glints that come and go
  px(ctx, "rgba(70,130,200,0.18)", tx * TILE, ty * TILE, TILE, TILE)
  if (ty === top) for (let i = 0; i < 3; i++) px(ctx, "rgba(255,255,255,0.7)", tx * TILE + ((i * 6 + tx * 5) % 12), ty * TILE, 3, 1)
  if (Math.sin(t * 1.7 + tx * 2.3 + ty * 1.3) > 0.8) px(ctx, "#ffffff", tx * TILE + 4 + ((tx * 7 + ty * 3) % 8), ty * TILE + 5 + ((tx + ty) % 6), 2, 1)
}

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
      if (tx < MAP_W && ty < MAP_H && f.world.tiles[tileIndex(tx, ty)] === T.WATER) {
        paintTile(ctx, T.WATER, tx, ty, t)
        reflect(ctx, f.map, f.world, tx, ty, t)
      }
    }
  }

  const a = actOf(s)
  for (const g of GATES) {
    if (a >= g.act) continue
    // a shut gate: a stone arch with a plank door and a vine over it
    const gx = g.x * TILE
    const gy = g.y * TILE
    px(ctx, "#d8cdb8", gx, gy, 3, 16)
    px(ctx, "#d8cdb8", gx + 13, gy, 3, 16)
    px(ctx, "#b8ab94", gx + 2, gy, 1, 16)
    px(ctx, "#cdbfa6", gx, gy, 16, 3)
    px(ctx, "#8a5a44", gx + 3, gy + 3, 10, 13)
    for (let i = 0; i < 3; i++) px(ctx, "#6b4630", gx + 5 + i * 3, gy + 3, 1, 13)
    px(ctx, "#6b4630", gx + 3, gy + 8, 10, 1)
    px(ctx, "#6fa05a", gx + 1, gy + 3, 2, 5)
    px(ctx, "#6fa05a", gx + 11, gy + 1, 4, 2)
  }

  for (const [id, st] of Object.entries(STATIONS)) drawStation(ctx, id, st.x * TILE, st.y * TILE, s, t)
  for (const n of NODES) {
    if (n.x * TILE < camX - 16 || n.x * TILE > camX + VIEW_W || n.y * TILE < camY - 16 || n.y * TILE > camY + VIEW_H) continue
    drawNode(ctx, n.kind, n.x * TILE, n.y * TILE, nodeReady(s, n.id), t)
  }

  for (const pl of PLOTS) drawPlot(ctx, pl.x * TILE, pl.y * TILE, s.farm[pl.id], t)
  // fairy-ring mushrooms glow once it is dark
  if (hour(s) >= 19 || hour(s) < 6) {
    for (const n of NODES) {
      if (n.kind !== "mushroom" || n.x * TILE < camX - 16 || n.x * TILE > camX + VIEW_W) continue
      const g = ctx.createRadialGradient(n.x * TILE + 8, n.y * TILE + 8, 1, n.x * TILE + 8, n.y * TILE + 8, 18)
      g.addColorStop(0, "rgba(255,160,220,0.45)")
      g.addColorStop(1, "rgba(255,160,220,0)")
      ctx.fillStyle = g
      ctx.fillRect(n.x * TILE - 10, n.y * TILE - 10, 36, 36)
    }
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
        shadow(npc.x, npc.y + 5, 14)
        ctx.globalAlpha = npc.asleep ? 0.8 : 1
        const next = npc.path[0]
        const across = !!next && Math.abs(center(next[0]) - npc.x) >= Math.abs(center(next[1]) - npc.y)
        drawSprite(ctx, spriteCanvas(r.id, across ? "side" : "front"), npc.x, npc.y + 4 - bob + (npc.asleep ? 2 : 0), npc.face)
        ctx.globalAlpha = 1
        if (npc.asleep) {
          px(ctx, "#b4e2ff", npc.x + 8, npc.y - 22 + Math.floor(Math.sin(t * 2) * 1), 3, 1)
          px(ctx, "#b4e2ff", npc.x + 10, npc.y - 25 + Math.floor(Math.sin(t * 2 + 1) * 1), 2, 1)
        } else if (s.weather === "rain" && !r.rainLover) {
          px(ctx, "#2a7a3e", npc.x - 6, npc.y - 30, 12, 2)
          px(ctx, "#4fbf5a", npc.x - 5, npc.y - 31, 10, 1)
        }
        if (f.marked.has(r.id) && !npc.asleep) {
          const bounce = Math.round(Math.sin(t * 6) * 1.5)
          px(ctx, "#f0609a", npc.x - 1, npc.y - 38 + bounce, 2, 5)
          px(ctx, "#f0609a", npc.x - 1, npc.y - 31 + bounce, 2, 2)
        }
        if (npc.gathering && hour(s) >= 18 && Math.sin(t * 2 + npc.x) > 0.9) px(ctx, "#f0609a", npc.x - 8, npc.y - 26, 1, 1)
      },
    })
  }
  const jump = sim.moving ? Math.round(Math.abs(Math.sin(t * (sim.running ? 14 : 9))) * 2) : 0
  bodies.push({
    y: sim.py,
    draw: () => {
      shadow(sim.px, sim.py + 4, 14)
      drawSprite(ctx, spriteCanvas("player", sim.moving && sim.facing === "side" ? "side" : "front"), sim.px, sim.py + 4 - jump, sim.face)
    },
  })
  bodies.push({
    y: sim.pet.y,
    draw: () => {
      shadow(sim.pet.x, sim.pet.y + 4, 12)
      drawSprite(ctx, spriteCanvas(f.petSprite, sim.moving && sim.facing === "side" ? "side" : "front"), sim.pet.x, sim.pet.y + 4 - (sim.moving ? Math.round(Math.abs(Math.sin(t * 9 + 1)) * 2) : 0), sim.px >= sim.pet.x ? 1 : -1)
    },
  })
  {
    const x0 = Math.max(0, Math.floor(camX / TILE) - 2)
    const x1 = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / TILE) + 2)
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1)
    const y1 = Math.min(MAP_H - 1, Math.ceil((camY + VIEW_H) / TILE) + 5)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (f.world.tiles[tileIndex(tx, ty)] !== T.TREE) continue
        const { kind, variant } = treeAt(tx, ty, zoneAt(tx, ty))
        const art = treeArt(kind, variant)
        const baseY = (ty + 1) * TILE
        const cx = tx * TILE + TILE / 2
        bodies.push({
          y: baseY - 1,
          draw: () => {
            // fade a tree you are standing behind, so you can always see yourself
            const behind = Math.abs(sim.px - cx) < art.reach && sim.py < baseY - 4 && sim.py > baseY - art.rise
            ctx.globalAlpha = behind ? 0.5 : 1
            ctx.drawImage(art.img, Math.round(cx - art.w / 2), baseY - art.h + 2)
            ctx.globalAlpha = 1
          },
        })
      }
    }
  }
  for (const fly of FLIES) bodies.push({ y: flyY(fly, t) + 40, draw: () => drawFly(ctx, fly, t) })
  bodies.sort((p, q) => p.y - q.y).forEach((b) => b.draw())

  // sun shafts through the wood, and fireflies drifting over everything after dark
  {
    const w = ZONES.wood
    for (let i = 0; i < 4; i++) {
      const sx = w.x0 * TILE + 30 + i * 80
      const sway = Math.sin(t * 0.4 + i) * 4
      ctx.fillStyle = "rgba(255,235,250,0.10)"
      ctx.beginPath()
      ctx.moveTo(sx + sway, w.y0 * TILE)
      ctx.lineTo(sx + 26 + sway, w.y0 * TILE)
      ctx.lineTo(sx - 22, (w.y1 + 1) * TILE)
      ctx.lineTo(sx - 48, (w.y1 + 1) * TILE)
      ctx.fill()
    }
  }
  if (night || hour(s) >= 19) {
    for (let i = 0; i < 26; i++) {
      const fx = camX + ((i * 83 + Math.sin(t * 0.5 + i) * 16 + t * 2) % VIEW_W)
      const fy = camY + ((i * 47 + Math.cos(t * 0.4 + i * 2) * 12) % VIEW_H)
      const on = Math.sin(t * 1.8 + i * 1.7) > 0
      if (!on) continue
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7)
      g.addColorStop(0, "rgba(200,255,190,0.8)")
      g.addColorStop(1, "rgba(200,255,190,0)")
      ctx.fillStyle = g
      ctx.fillRect(fx - 7, fy - 7, 14, 14)
      px(ctx, "#f4ffe8", fx, fy)
    }
  }

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
  if (s.weather === "meteor") tint = tint || "rgba(60,40,140,0.12)"
  if (s.weather === "fog") tint = tint || "rgba(225,210,248,0.2)"
  if (tint) {
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  if (s.weather === "rain") drawRain(ctx, VIEW_W, VIEW_H, t)
  if (s.weather === "meteor") {
    for (let i = 0; i < 4; i++) {
      const life = (t * 0.45 + i * 0.27) % 1
      const mx = ((i * 97 + 40) % VIEW_W) + life * -70 + 60
      const my = life * 120 - 10 + i * 6
      ctx.globalAlpha = Math.sin(life * Math.PI)
      for (let k = 0; k < 9; k++) px(ctx, k === 0 ? "#ffffff" : k < 4 ? "#b4e2ff" : "#9a72e0", mx + k * 2, my - k * 1.3, 2, 1)
      ctx.globalAlpha = 1
    }
  }
  if (s.weather === "fog") {
    for (let i = 0; i < 7; i++) {
      const fx = ((i * 71 + t * 6) % (VIEW_W + 80)) - 40
      const fy = 20 + ((i * 53) % (VIEW_H - 30))
      ctx.fillStyle = "rgba(245,238,255,0.22)"
      ctx.fillRect(Math.round(fx), Math.round(fy), 60, 10)
      ctx.fillRect(Math.round(fx) + 10, Math.round(fy) - 4, 40, 18)
    }
  }
  // drifting pollen sparkles, always
  for (let i = 0; i < 16; i++) {
    const sx = (i * 61 + Math.sin(t * 0.6 + i) * 14 + t * 3) % VIEW_W
    const sy = (i * 43 + Math.cos(t * 0.5 + i * 2) * 10 - t * 4 + VIEW_H * 4) % VIEW_H
    if (Math.sin(t * 2 + i * 3) > -0.2) px(ctx, i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd6e8" : "#d6f6ff", sx, sy)
  }
  if (night) {
    // the moon, and a few stars
    const mx = VIEW_W - 30
    ctx.fillStyle = "#f4eefc"
    ctx.beginPath()
    ctx.arc(mx, 20, 8, 0, Math.PI * 2)
    ctx.fill()
    px(ctx, "#d6cde8", mx - 3, 17, 3, 3)
    px(ctx, "#d6cde8", mx + 2, 22, 3, 2)
    for (let i = 0; i < 6; i++) if (Math.sin(t * 1.5 + i * 2) > -0.4) px(ctx, "#ffffff", VIEW_W - 70 + ((i * 23) % 60), 8 + ((i * 11) % 24))
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
