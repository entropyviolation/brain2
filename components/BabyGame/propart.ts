/**
 * components/BabyGame/propart.ts — The props drawn from what the player loves and dreads
 *
 * Plain rectangles at the game's native pixel size, like `art.ts`. Each painter gets the tile's top-left (x, y), the clock `t`,
 * and whether it is raining or night, so the orb glows after dark and the puddle ripples in the rain.
 */

type Ctx = CanvasRenderingContext2D
export type PropEnv = { rain: boolean; night: boolean }

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const WOOD = { hi: "#c48e74", mid: "#8a5a44", deep: "#6b4630", dark: "#4e3224" }
const STONE = { hi: "#cdd6dd", mid: "#9aa6b0", deep: "#6c7782", dark: "#4a5560" }
const COBALT = { hi: "#6a8ff0", mid: "#2f5fe0", deep: "#1f3fa0" }

/** A short straight run of pixels, for strings and hands. */
function line(ctx: Ctx, color: string, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let i = 0; i <= steps; i++) px(ctx, color, x0 + ((x1 - x0) * i) / (steps || 1), y0 + ((y1 - y0) * i) / (steps || 1))
}

export function drawTasteProp(ctx: Ctx, kind: string, x: number, y: number, t: number, env: PropEnv): boolean {
  const shadow = (sx = 2, sw = 12) => px(ctx, "rgba(20,30,20,0.25)", x + sx, y + 13, sw, 3)
  switch (kind) {
    case "orb": {
      // a white orb light hovering over a cobalt-capped stone plinth
      shadow(3, 10)
      px(ctx, STONE.mid, x + 5, y + 11, 6, 3)
      px(ctx, STONE.hi, x + 5, y + 11, 6, 1)
      px(ctx, COBALT.mid, x + 4, y + 13, 8, 1)
      px(ctx, STONE.mid, x + 7, y + 8, 2, 3)
      const bob = Math.round(Math.sin(t * 1.6) * 1.2)
      const oy = y + 1 + bob
      const a = env.night ? 0.28 : 0.12
      px(ctx, `rgba(225,240,255,${a})`, x + 1, oy - 4, 14, 14)
      px(ctx, `rgba(235,246,255,${a + 0.12})`, x + 3, oy - 2, 10, 10)
      px(ctx, "#ffffff", x + 6, oy, 4, 1)
      px(ctx, "#ffffff", x + 5, oy + 1, 6, 4)
      px(ctx, "#ffffff", x + 6, oy + 5, 4, 1)
      px(ctx, "#cfe8ff", x + 9, oy + 3, 2, 2)
      px(ctx, "#cfe8ff", x + 7, oy + 5, 2, 1)
      break
    }
    case "puddle": {
      const rows: Array<[number, number, number]> = [[6, 3, 10], [7, 1, 14], [8, 0, 16], [9, 1, 14], [10, 3, 10]]
      for (const [ry, rx, rw] of rows) px(ctx, "#5f93bd", x + rx, y + ry, rw, 1)
      for (const [ry, rx, rw] of rows) px(ctx, "#8ec2e6", x + rx + 1, y + ry, Math.max(1, rw - 2), 1)
      // the sky, and something cobalt standing on the far side, reflected and wobbling
      px(ctx, "#eaf5ff", x + 4, y + 7, 5, 1)
      const wob = Math.round(Math.sin(t * 2) * 1)
      px(ctx, COBALT.mid, x + 11 + wob, y + 7, 1, 2)
      px(ctx, COBALT.hi, x + 12 + wob, y + 8, 1, 2)
      const r = Math.floor((t * (env.rain ? 5 : 1.5)) % 4)
      px(ctx, "rgba(255,255,255,0.55)", x + 6 - r, y + 8, 1, 1)
      px(ctx, "rgba(255,255,255,0.55)", x + 6 + r + 1, y + 8, 1, 1)
      if (env.rain) px(ctx, "rgba(255,255,255,0.4)", x + 10 - (r % 3), y + 9, 1, 1)
      break
    }
    case "prism": {
      shadow(3, 10)
      px(ctx, STONE.mid, x + 4, y + 11, 8, 3)
      px(ctx, STONE.hi, x + 4, y + 11, 8, 1)
      // a glass prism, a white beam in and a muted rainbow out
      for (let i = 0; i < 9; i++) {
        const w = 2 + i
        px(ctx, "#d6eeff", x + 8 - Math.floor(w / 2), y + 2 + i, w, 1)
        px(ctx, "#9ccaec", x + 8 + Math.floor(w / 2) - 1, y + 2 + i, 1, 1)
        px(ctx, "#ffffff", x + 8 - Math.floor(w / 2), y + 2 + i, 1, 1)
      }
      px(ctx, "#ffffff", x, y + 7, 5, 1)
      const band = ["#ff9db8", "#c9a8ff", "#8fa8ff", "#8fe0e8", "#8fe0b8", "#d8f0a8"]
      band.forEach((c, i) => px(ctx, c, x + 10, y + 6 + i, 6, 1))
      if (Math.sin(t * 3) > 0.7) px(ctx, "#ffffff", x + 13, y + 7, 1, 1)
      break
    }
    case "library": {
      shadow(4, 8)
      px(ctx, WOOD.mid, x + 7, y + 11, 2, 4)
      px(ctx, COBALT.mid, x + 3, y + 4, 10, 8)
      px(ctx, COBALT.hi, x + 3, y + 4, 10, 1)
      px(ctx, COBALT.deep, x + 3, y + 11, 10, 1)
      px(ctx, WOOD.mid, x + 2, y + 2, 12, 2)
      px(ctx, WOOD.hi, x + 1, y + 3, 14, 1)
      px(ctx, "#cfeaff", x + 5, y + 5, 6, 5)
      ;["#e0506a", "#4fbf5a", "#c9a8ff", "#ffffff", "#e0506a"].forEach((c, i) => px(ctx, c, x + 5 + i, y + 6 + (i % 2), 1, 4 - (i % 2)))
      px(ctx, COBALT.deep, x + 5, y + 10, 6, 1)
      break
    }
    case "thrift": {
      px(ctx, "rgba(20,30,20,0.25)", x, y + 14, 16, 2)
      px(ctx, STONE.mid, x + 1, y + 2, 1, 12)
      px(ctx, STONE.mid, x + 14, y + 2, 1, 12)
      px(ctx, STONE.hi, x + 1, y + 2, 14, 1)
      const clothes: Array<[string, string, number]> = [["#c8324e", "#8a1f3a", 3], ["#c9a8ff", "#a888e8", 2], ["#8fe0b8", "#5fc098", 3], ["#8fa8ff", "#5f7fd8", 2]]
      clothes.forEach(([c, d, tall], i) => {
        const gx = x + 2 + i * 3
        px(ctx, STONE.deep, gx + 1, y + 3, 1, 1)
        px(ctx, c, gx, y + 4, 3, 6 + tall)
        px(ctx, d, gx + 2, y + 4, 1, 6 + tall)
        if (i === 0) for (let k = 0; k < 8; k += 2) px(ctx, d, gx, y + 5 + k, 3, 1)
      })
      px(ctx, "#ff9db8", x + 12, y + 4, 2, 9)
      px(ctx, "#ffffff", x + 12, y + 7, 2, 1)
      break
    }
    case "collage": {
      shadow(0, 16)
      px(ctx, WOOD.mid, x + 1, y + 9, 14, 3)
      px(ctx, WOOD.hi, x + 1, y + 9, 14, 1)
      px(ctx, WOOD.deep, x + 2, y + 12, 2, 3)
      px(ctx, WOOD.deep, x + 12, y + 12, 2, 3)
      px(ctx, "#f4c0cc", x + 2, y + 5, 5, 5)
      px(ctx, "#8fa8ff", x + 6, y + 3, 4, 6)
      px(ctx, "#8fe0b8", x + 9, y + 6, 5, 4)
      px(ctx, "#ffffff", x + 7, y + 5, 2, 2)
      px(ctx, "#e0506a", x + 11, y + 7, 2, 2)
      px(ctx, "#c9a8ff", x + 3, y + 7, 2, 1)
      px(ctx, STONE.deep, x + 13, y + 5, 1, 3)
      px(ctx, "#e0506a", x + 13, y + 8, 1, 1)
      break
    }
    case "fireworks": {
      shadow(1, 14)
      px(ctx, WOOD.mid, x + 2, y + 8, 12, 6)
      px(ctx, WOOD.hi, x + 2, y + 8, 12, 1)
      px(ctx, WOOD.dark, x + 2, y + 11, 12, 1)
      const rockets: Array<[string, number, number]> = [["#e0506a", 4, 2], ["#2f5fe0", 7, 0], ["#c9a8ff", 10, 3]]
      for (const [c, rx, ry] of rockets) {
        px(ctx, c, rx + x, y + ry + 1, 2, 6)
        px(ctx, "#ffffff", rx + x, y + ry, 2, 1)
        px(ctx, WOOD.deep, rx + x, y + ry + 7, 1, 2)
        if (env.night && Math.sin(t * 7 + rx) > 0.6) px(ctx, "#ffffff", rx + x - 1 + (rx % 2), y + ry - 1, 1, 1)
      }
      break
    }
    case "clock": {
      shadow(4, 8)
      px(ctx, STONE.deep, x + 7, y + 8, 2, 7)
      px(ctx, COBALT.mid, x + 2, y - 1, 12, 12)
      px(ctx, "#f6f0e6", x + 3, y, 10, 10)
      px(ctx, "#f6f0e6", x + 2, y + 1, 12, 8)
      px(ctx, COBALT.deep, x + 2, y + 9, 12, 2)
      for (const [dx, dy] of [[7, 1], [7, 8], [3, 4], [12, 4]] as const) px(ctx, WOOD.dark, x + dx, y + dy, 1, 1)
      const am = t * 0.7
      const ah = t * 0.06
      line(ctx, WOOD.dark, x + 8, y + 5, x + 8 + Math.round(Math.sin(am) * 4), y + 5 - Math.round(Math.cos(am) * 4))
      line(ctx, "#c8324e", x + 8, y + 5, x + 8 + Math.round(Math.sin(ah) * 3), y + 5 - Math.round(Math.cos(ah) * 3))
      px(ctx, "#ff9db8", x + 6, y + 10, 4, 1)
      break
    }
    case "pendulum": {
      shadow(1, 14)
      px(ctx, STONE.deep, x + 1, y, 2, 14)
      px(ctx, STONE.deep, x + 13, y, 2, 14)
      px(ctx, STONE.mid, x + 1, y, 14, 2)
      px(ctx, STONE.dark, x + 1, y + 13, 14, 2)
      const a = Math.sin(t * 2.2) * 0.7
      const bx = x + 8 + Math.round(Math.sin(a) * 8)
      const by = y + 2 + Math.round(Math.cos(a) * 8)
      line(ctx, "#cdd6dd", x + 8, y + 2, bx, by)
      px(ctx, "#cdd6dd", bx - 1, by, 3, 3)
      px(ctx, COBALT.mid, bx, by + 1, 1, 1)
      px(ctx, "#ffffff", bx - 1, by, 1, 1)
      break
    }
    case "ducklings": {
      // a hen and her four ducklings in an orderly line
      const p = Math.sin(t * 0.6)
      const dir = Math.cos(t * 0.6) >= 0 ? 1 : -1
      const head = x + 8 + Math.round(p * 5)
      const body = (bx: number, size: 1 | 2, c: string, i: number) => {
        const hop = Math.floor(t * 6 + i) % 2
        const w = size === 2 ? 5 : 3
        const h = size === 2 ? 4 : 3
        px(ctx, c, bx - Math.floor(w / 2), y + 10 - hop, w, h)
        px(ctx, c, bx + dir * Math.ceil(w / 2), y + 9 - hop, 2, 2)
        px(ctx, "#ffb03a", bx + dir * (Math.ceil(w / 2) + 2), y + 10 - hop, 1, 1)
        px(ctx, "#2a2a36", bx + dir * Math.ceil(w / 2), y + 9 - hop, 1, 1)
      }
      body(head, 2, WOOD.mid, 0)
      for (let i = 1; i <= 4; i++) body(head - dir * (4 + i * 3), 1, "#f6e8b0", i)
      break
    }
    case "sprinkler": {
      px(ctx, "rgba(70,130,190,0.28)", x + 1, y + 11, 14, 4)
      px(ctx, STONE.deep, x + 7, y + 11, 2, 3)
      px(ctx, COBALT.mid, x + 6, y + 10, 4, 2)
      const sweep = Math.sin(t * 1.4)
      for (let k = 0; k < 8; k++) {
        const ph = (t * 2.4 + k / 8) % 1
        const dx = Math.round(sweep * ph * 8)
        const dy = Math.round(-Math.sin(ph * Math.PI) * 7 + ph * 3)
        px(ctx, k % 2 ? "#bfe8ff" : "#ffffff", x + 8 + dx, y + 10 + dy, 1, 1)
        px(ctx, "#bfe8ff", x + 8 - dx, y + 10 + dy, 1, 1)
      }
      break
    }
    case "microscope": {
      shadow(2, 12)
      px(ctx, "#3a4150", x + 3, y + 13, 10, 2)
      px(ctx, STONE.hi, x + 9, y + 5, 2, 8)
      px(ctx, "#2a3036", x + 4, y + 1, 3, 2)
      px(ctx, STONE.hi, x + 5, y + 3, 3, 3)
      px(ctx, STONE.deep, x + 6, y + 6, 3, 3)
      px(ctx, STONE.mid, x + 3, y + 10, 8, 1)
      px(ctx, "#8fd0f0", x + 5, y + 9, 3, 1)
      px(ctx, COBALT.mid, x + 10, y + 7, 2, 2)
      if (Math.sin(t * 2.5) > 0.7) px(ctx, "#ffffff", x + 6, y + 0, 1, 1)
      px(ctx, "#f6f0e6", x + 7, y + 12, 2, 1)
      break
    }
    case "fossil": {
      px(ctx, STONE.mid, x + 1, y + 5, 14, 8)
      px(ctx, STONE.hi, x + 1, y + 5, 14, 1)
      px(ctx, STONE.deep, x + 1, y + 12, 14, 1)
      px(ctx, STONE.dark, x + 1, y + 13, 14, 1)
      const ring: Array<[number, number]> = [[4, 7], [5, 6], [6, 6], [7, 6], [8, 7], [9, 8], [9, 9], [8, 10], [7, 11], [6, 11], [5, 11], [4, 10], [4, 9]]
      for (const [dx, dy] of ring) px(ctx, STONE.hi, x + dx, y + dy, 1, 1)
      for (const [dx, dy] of [[5, 8], [6, 8], [7, 9], [6, 10], [5, 9]] as const) px(ctx, STONE.deep, x + dx, y + dy, 1, 1)
      px(ctx, STONE.dark, x + 11, y + 8, 3, 3)
      px(ctx, STONE.hi, x + 11, y + 8, 3, 1)
      px(ctx, STONE.deep, x + 12, y + 9, 1, 2)
      break
    }
    case "romanesco": {
      shadow(1, 14)
      for (let r = 0; r < 10; r++) {
        const w = Math.min(12, 2 + Math.floor(r * 1.2))
        for (let i = 0; i < w; i++) px(ctx, (i + r) % 3 === 0 ? "#2f8248" : (i + r) % 2 ? "#8fdc92" : "#4fbf5a", x + 8 - Math.floor(w / 2) + i, y + 1 + r, 1, 1)
      }
      px(ctx, "#2a7a3e", x + 1, y + 11, 14, 3)
      px(ctx, "#4fbf5a", x + 2, y + 11, 12, 1)
      px(ctx, "#2f8248", x + 4, y + 13, 8, 1)
      break
    }
    case "slime": {
      shadow(0, 16)
      px(ctx, WOOD.dark, x + 1, y + 6, 14, 8)
      px(ctx, WOOD.deep, x + 1, y + 6, 14, 2)
      px(ctx, "#c48e74", x + 1, y + 7, 2, 6)
      px(ctx, "#4f9a4e", x + 8, y + 6, 5, 1)
      const path: Array<[number, number]> = [[3, 10], [4, 9], [5, 9], [6, 10], [7, 10], [8, 9], [9, 9], [10, 10], [11, 10], [12, 9], [6, 11], [6, 12], [10, 11], [10, 12], [9, 8], [9, 7]]
      for (const [dx, dy] of path) px(ctx, "#f0ecd8", x + dx, y + dy, 1, 1)
      const [hx, hy] = path[Math.floor(t * 6) % path.length]!
      px(ctx, "#ffffff", x + hx, y + hy, 1, 1)
      px(ctx, "#f6e8b0", x + 6, y + 9, 2, 1)
      break
    }
    case "wasps": {
      px(ctx, "rgba(20,30,20,0.25)", x, y + 14, 4, 2)
      px(ctx, WOOD.deep, x + 1, y + 1, 2, 14)
      px(ctx, WOOD.mid, x + 1, y + 1, 14, 2)
      px(ctx, WOOD.hi, x + 1, y + 1, 14, 1)
      const nest: Array<[number, number, number]> = [[3, 7, 4], [4, 6, 6], [5, 5, 8], [6, 5, 8], [7, 5, 8], [8, 6, 6], [9, 7, 4]]
      nest.forEach(([ny, nx, nw], i) => {
        px(ctx, i % 2 ? "#9a8a74" : "#b8a890", x + nx, y + ny, nw, 1)
        px(ctx, "#d8cbb4", x + nx, y + ny, 1, 1)
      })
      px(ctx, WOOD.dark, x + 8, y + 10, 2, 2)
      for (let i = 0; i < 3; i++) {
        const wx = x + 8 + Math.round(Math.cos(t * 4 + i * 2.1) * 6)
        const wy = y + 8 + Math.round(Math.sin(t * 5 + i * 1.7) * 4)
        px(ctx, "#e8b04a", wx, wy, 2, 1)
        px(ctx, "#2a2a36", wx + 1, wy, 1, 1)
        px(ctx, "#ffffff", wx, wy - 1, 1, 1)
      }
      break
    }
    case "kitten": {
      px(ctx, "rgba(20,30,20,0.25)", x + 2, y + 13, 12, 3)
      const tail = Math.round(Math.sin(t * 3) * 1.5)
      px(ctx, "#8e99a4", x + 2, y + 9 + tail, 2, 4)
      px(ctx, "#6c7782", x + 2, y + 9 + tail, 1, 2)
      px(ctx, "#8e99a4", x + 4, y + 8, 8, 6)
      px(ctx, "#6c7782", x + 5, y + 8, 1, 3)
      px(ctx, "#6c7782", x + 8, y + 8, 1, 3)
      px(ctx, "#f0ecf5", x + 10, y + 12, 3, 2)
      px(ctx, "#8e99a4", x + 9, y + 4, 5, 5)
      px(ctx, "#8e99a4", x + 9, y + 3, 1, 1)
      px(ctx, "#8e99a4", x + 13, y + 3, 1, 1)
      px(ctx, "#ffb3d1", x + 10, y + 3, 1, 1)
      px(ctx, Math.sin(t * 0.8) > 0.93 ? "#6c7782" : "#4fbf5a", x + 10, y + 5, 1, 1)
      px(ctx, Math.sin(t * 0.8) > 0.93 ? "#6c7782" : "#4fbf5a", x + 12, y + 5, 1, 1)
      px(ctx, "#ffb3d1", x + 11, y + 7, 1, 1)
      break
    }
    default:
      return false
  }
  return true
}
