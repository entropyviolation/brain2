/**
 * app/lab/baby-world/page.tsx — Whole-world overview of the Baby animal game
 *
 * A review aid: the cached terrain at 1:1 with every station, prop, node, friend spot and home as a labelled dot.
 */
"use client"

import { useEffect, useRef } from "react"
import { HI, HiRes } from "@/components/BabyGame/hires"
import { buildMapCanvas } from "@/components/BabyGame/render"
import { RESIDENTS } from "@/lib/baby-game/cast"
import { HOMES } from "@/lib/baby-game/homes"
import { buildWorld, EXTENT_H, EXTENT_W, FIRE_SLOTS, NODES, PROPS, STATIONS, TILE, ZONES } from "@/lib/baby-game/world"

export default function BabyWorldPage() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const world = buildWorld([...RESIDENTS.map((r) => r.day), ...FIRE_SLOTS])
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(buildMapCanvas(world), 0, 0)
    // a meadow crop: plain pixels (left) beside the Scale2x frame (right), both at 3 screen pixels per game pixel
    const hi = new HiRes(304, 192)
    hi.lowCtx.drawImage(c, 240, 200, 304, 192, 0, 0, 304, 192)
    const cmp = document.getElementById("cmp") as HTMLCanvasElement | null
    if (cmp) {
      const g = cmp.getContext("2d")!
      g.imageSmoothingEnabled = false
      g.drawImage(hi.low, 0, 0, 304 * 3, 192 * 3)
      const tmp = document.createElement("canvas")
      tmp.width = 304 * HI
      tmp.height = 192 * HI
      hi.present(tmp.getContext("2d")!)
      g.drawImage(tmp, 304 * 3 + 10, 0, 304 * 3, 192 * 3)
    }
    ctx.font = "9px monospace"
    const dot = (x: number, y: number, color: string, label?: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x * TILE + 4, y * TILE + 4, 8, 8)
      if (label) {
        ctx.fillStyle = "#000"
        ctx.fillText(label, x * TILE + 1, y * TILE + 2)
        ctx.fillStyle = "#fff"
        ctx.fillText(label, x * TILE, y * TILE + 1)
      }
    }
    for (const n of NODES) dot(n.x, n.y, "#ffa500")
    for (const p of PROPS) dot(p.x, p.y, "#e0287a", p.kind)
    for (const [k, s] of Object.entries(STATIONS)) dot(s.x, s.y, "#2060ff", k)
    for (const r of RESIDENTS) dot(r.day[0], r.day[1], "#ffff00", r.id)
    for (const [id, h] of Object.entries(HOMES)) dot(h.x, h.y, "#2f5fe0", `${id} ${h.kind}`)
    ctx.strokeStyle = "#fff"
    for (const z of Object.values(ZONES)) {
      ctx.strokeRect(z.x0 * TILE, z.y0 * TILE, (z.x1 - z.x0 + 1) * TILE, (z.y1 - z.y0 + 1) * TILE)
      ctx.fillStyle = "#fff"
      ctx.fillText(z.name, z.x0 * TILE + 3, z.y0 * TILE + 10)
    }
  }, [])
  return (
    <>
      <canvas id="cmp" width={304 * 6 + 10} height={192 * 3} className="relative z-50 block bg-black" />
      <canvas ref={ref} width={EXTENT_W * TILE} height={EXTENT_H * TILE} className="relative z-50 block bg-black" />
    </>
  )
}
