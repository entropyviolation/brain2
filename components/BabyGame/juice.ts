/**
 * components/BabyGame/juice.ts — small particles for steps and hands-on moments
 *
 * One `Juice` lives for the whole game (a ref in `BabyGame.tsx`). `render.ts` asks it for step dust as bodies walk,
 * `BabyGame.tsx` asks it for bursts when you gather, till, water, harvest or hand over a gift, and `render.ts` draws it.
 * Everything is time based (seconds), whole pixels, no yellow. Drafts for new effects live in `fx/` and the lab at `/lab/baby-fx`.
 */

import { T } from "@/lib/baby-game/world"

type Kind = "dust" | "blade" | "splash" | "crumb" | "spark" | "heart" | "ring"

interface Part {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  g: number
  born: number
  life: number
  c: string
  c2: string
  size: number
}

const MAX = 320

/** Dust tint by what is underfoot. */
const DUST: Record<number, [string, string]> = {
  [T.GRASS]: ["#d6e0c6", "#a9bd98"],
  [T.FLOWER]: ["#d6e0c6", "#a9bd98"],
  [T.PATH]: ["#e0d2b8", "#bba98a"],
  [T.SAND]: ["#efe6d2", "#cdbf9f"],
  [T.SNOW]: ["#ffffff", "#cfe0ee"],
  [T.DARK]: ["#8f86a8", "#6a6283"],
  [T.STONE]: ["#d8dde3", "#b0b7c0"],
  [T.STAIRS]: ["#d8dde3", "#b0b7c0"],
  [T.BRIDGE]: ["#d3b896", "#a98f72"],
  [T.SOIL]: ["#8a6a52", "#6b4f3b"],
}

const r = (a: number, b: number) => a + Math.random() * (b - a)

export class Juice {
  private parts: Part[] = []
  private steps = new Map<string, number>()

  private add(p: Omit<Part, "g" | "size" | "c2"> & Partial<Pick<Part, "g" | "size" | "c2">>) {
    if (this.parts.length >= MAX) this.parts.shift()
    this.parts.push({ g: 0, size: 1, c2: p.c, ...p })
  }

  /** Call every frame for a body: puffs a bit of ground when its foot comes down. */
  walk(id: string, t: number, x: number, feetY: number, moving: boolean, running: boolean, tile: number, face: 1 | -1) {
    if (!moving) {
      this.steps.delete(id)
      return
    }
    const last = this.steps.get(id)
    const every = running ? 0.11 : 0.2
    if (last !== undefined && t - last < every) return
    this.steps.set(id, t)
    if (last === undefined) return
    if (tile === T.WATER) {
      this.add({ kind: "ring", x, y: feetY, vx: 0, vy: 0, born: t, life: 0.5, c: "#d9ecff" })
      return
    }
    const [c, c2] = DUST[tile] ?? DUST[T.GRASS]!
    const n = running ? 3 : 2
    for (let i = 0; i < n; i++) {
      this.add({ kind: "dust", x: x - face * r(2, 5), y: feetY - 1, vx: -face * r(2, 9), vy: -r(5, 12), g: 14, born: t, life: running ? 0.45 : 0.35, c, c2 })
    }
    if ((tile === T.GRASS || tile === T.FLOWER) && Math.random() < (running ? 0.7 : 0.3)) {
      this.add({ kind: "blade", x, y: feetY - 1, vx: -face * r(6, 14), vy: -r(14, 24), g: 80, born: t, life: 0.45, c: Math.random() < 0.5 ? "#6fb05f" : "#8fcf7a" })
    }
  }

  /** Soil crumbs and a pat of dust: the hoe. */
  till(t: number, x: number, y: number) {
    for (let i = 0; i < 8; i++) this.add({ kind: "crumb", x: x + r(-5, 5), y, vx: r(-16, 16), vy: -r(18, 34), g: 110, born: t, life: 0.5, c: i % 2 ? "#8a6a52" : "#6b4f3b" })
    this.dustPuff(t, x, y)
  }

  /** A can's arc of drops that lands in a ring. */
  water(t: number, x: number, y: number) {
    for (let i = 0; i < 10; i++) this.add({ kind: "splash", x: x + r(-5, 5), y: y - 14 - r(0, 6), vx: r(-6, 6), vy: r(10, 30), g: 90, born: t + i * 0.025, life: 0.45, c: i % 3 ? "#a9cdee" : "#d9ecff" })
    this.add({ kind: "ring", x, y, vx: 0, vy: 0, born: t + 0.3, life: 0.5, c: "#a9cdee" })
  }

  /** A crop lifts, sparks, and falls toward the bag. */
  harvest(t: number, x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      this.add({ kind: "spark", x, y: y - 6, vx: Math.cos(a) * r(14, 26), vy: Math.sin(a) * r(10, 22) - 12, g: 40, born: t, life: 0.6, c: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd6e8" : "#b6f0a4" })
    }
    this.dustPuff(t, x, y)
  }

  /** Picking something up: a small pop of sparks. */
  gather(t: number, x: number, y: number) {
    for (let i = 0; i < 7; i++) this.add({ kind: "spark", x, y: y - 4, vx: r(-18, 18), vy: -r(10, 28), g: 60, born: t, life: 0.5, c: i % 2 ? "#ffffff" : "#d6f6ff" })
    this.dustPuff(t, x, y + 2)
  }

  /** Hearts rise on a sine drift. */
  hearts(t: number, x: number, y: number, n = 5) {
    for (let i = 0; i < n; i++) this.add({ kind: "heart", x: x + (i - (n - 1) / 2) * 5, y: y - 12, vx: r(-4, 4), vy: -r(14, 22), born: t + i * 0.07, life: 1, c: "#f0609a", c2: "#ffb3d1" })
  }

  private dustPuff(t: number, x: number, y: number) {
    for (let i = 0; i < 4; i++) this.add({ kind: "dust", x: x + r(-6, 6), y, vx: r(-10, 10), vy: -r(4, 10), g: 8, born: t, life: 0.4, c: "#d6e0c6", c2: "#a9bd98" })
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    this.parts = this.parts.filter((p) => t - p.born < p.life)
    for (const p of this.parts) {
      const age = t - p.born
      if (age < 0) continue
      const k = age / p.life
      const x = p.x + p.vx * age
      const y = p.y + p.vy * age + 0.5 * p.g * age * age
      ctx.fillStyle = k > 0.55 ? p.c2 : p.c
      switch (p.kind) {
        case "dust": {
          const s = k < 0.5 ? 2 : 1
          ctx.fillRect(Math.round(x), Math.round(y), s, s)
          break
        }
        case "blade":
          ctx.fillRect(Math.round(x), Math.round(y), 1, 2)
          break
        case "ring": {
          const rr = 1 + Math.floor(k * 5)
          ctx.fillRect(Math.round(x) - rr, Math.round(y), rr * 2 + 1, 1)
          if (k < 0.5) ctx.fillRect(Math.round(x) - rr + 1, Math.round(y) - 1, rr * 2 - 1, 1)
          break
        }
        case "spark":
        case "crumb":
        case "splash":
          if (k > 0.8 && Math.floor(age * 30) % 2) break
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
          if (p.kind === "splash") ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 1)
          break
        case "heart": {
          if (k > 0.75 && Math.floor(age * 24) % 2) break
          const hx = Math.round(x + Math.sin(age * 6 + p.x) * 2)
          const hy = Math.round(y)
          ctx.fillRect(hx - 2, hy, 2, 2)
          ctx.fillRect(hx + 1, hy, 2, 2)
          ctx.fillRect(hx - 2, hy + 1, 5, 2)
          ctx.fillRect(hx - 1, hy + 3, 3, 1)
          ctx.fillStyle = p.c2
          ctx.fillRect(hx - 2, hy, 1, 1)
          break
        }
      }
    }
  }
}
