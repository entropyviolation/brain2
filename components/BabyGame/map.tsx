/**
 * components/BabyGame/map.tsx — The world map, opened with M
 *
 * One small canvas painted from the same tile array the game walks on: five pixels a tile, trees as dark canopy dots, water
 * blue, zones outlined and named, zones behind a closed gate dimmed, friends' homes as small cobalt roofs. Friends who are up and about show as dots, the player
 * as a pulsing pin, stations as small squares. It redraws a few times a second so you can watch people move.
 * In development mode (`onPick`) a click on the map teleports you to that tile.
 */
"use client"

import { useEffect, useRef } from "react"
import { RESIDENTS, inValley } from "@/lib/baby-game/cast"
import type { Sim } from "@/lib/baby-game/sim"
import { HOMES } from "@/lib/baby-game/homes"
import { MAP_H, MAP_W, STATIONS, T, TILE, tileIndex, ZONE_ACT, ZONES, type World, type ZoneId } from "@/lib/baby-game/world"
import { Plate } from "./panels"

const PX = 6

const COLOR: Record<number, string> = {
  [T.GRASS]: "#7cc46e", [T.FLOWER]: "#8ed17a", [T.DARK]: "#356b48", [T.PATH]: "#d9c19a", [T.SAND]: "#ecdcb8", [T.SNOW]: "#eef4fa",
  [T.HILL]: "#9c8a76", [T.HAY]: "#dcc3ae", [T.WATER]: "#3f86c8", [T.BRIDGE]: "#a67c5e", [T.WALL]: "#efe8dc", [T.ROOF]: "#b9764a",
  [T.DOOR]: "#6b4630", [T.TREE]: "#2a6a40", [T.ROCK]: "#8e99a4", [T.GATE]: "#6b4630", [T.SOIL]: "#8a6048", [T.STONE]: "#d8cdb8",
  [T.ARCH]: "#cdbfa6", [T.STAIRS]: "#efe6d4", [T.FENCE]: "#a67c5e",
}

export function MapPanel({ world, act, getSim, onClose, onPick }: { world: World; act: number; getSim: () => Sim | null; onClose: () => void; onPick?: (tile: [number, number]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const base = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    if (!base.current) {
      const b = document.createElement("canvas")
      b.width = MAP_W * PX
      b.height = MAP_H * PX
      const bc = b.getContext("2d")!
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const tile = world.tiles[tileIndex(x, y)]!
          bc.fillStyle = COLOR[tile] ?? "#7cc46e"
          bc.fillRect(x * PX, y * PX, PX, PX)
          if (tile === T.TREE) {
            bc.fillStyle = "#3f8a57"
            bc.fillRect(x * PX + 1, y * PX + 1, 2, 2)
          }
        }
      }
      // locked regions go dim, and every region is named
      for (const id of Object.keys(ZONES) as ZoneId[]) {
        const z = ZONES[id]
        if (ZONE_ACT[id] > act) {
          bc.fillStyle = "rgba(30,20,50,0.55)"
          bc.fillRect(z.x0 * PX, z.y0 * PX, (z.x1 - z.x0 + 1) * PX, (z.y1 - z.y0 + 1) * PX)
        }
        bc.strokeStyle = "rgba(43,29,46,0.7)"
        bc.lineWidth = 1
        bc.strokeRect(z.x0 * PX + 0.5, z.y0 * PX + 0.5, (z.x1 - z.x0 + 1) * PX - 1, (z.y1 - z.y0 + 1) * PX - 1)
        bc.font = "bold 9px monospace"
        const label = ZONE_ACT[id] > act ? `${z.name} ✕` : z.name
        const w = bc.measureText(label).width
        bc.fillStyle = "rgba(251,241,230,0.85)"
        bc.fillRect(z.x0 * PX + 3, z.y0 * PX + 3, w + 6, 13)
        bc.fillStyle = "#2b1d2e"
        bc.fillText(label, z.x0 * PX + 6, z.y0 * PX + 13)
      }
      // homes: small cobalt roofs
      for (const h of Object.values(HOMES)) {
        bc.fillStyle = "#2f5fe0"
        bc.fillRect(h.x * PX, h.y * PX + 1, PX, PX - 1)
        bc.fillStyle = "#6a8ff0"
        bc.fillRect(h.x * PX + 1, h.y * PX, PX - 2, 1)
      }
      for (const st of Object.values(STATIONS)) {
        bc.fillStyle = "#f0609a"
        bc.fillRect(st.x * PX - 1, st.y * PX - 1, PX + 2, PX + 2)
        bc.strokeStyle = "#2b1d2e"
        bc.strokeRect(st.x * PX - 0.5, st.y * PX - 0.5, PX + 1, PX + 1)
      }
      base.current = b
    }
    const draw = () => {
      ctx.drawImage(base.current!, 0, 0)
      const sim = getSim()
      if (!sim) return
      for (const r of RESIDENTS) {
        const npc = sim.npcs[r.id]
        if (!npc || npc.asleep || !inValley(r, act)) continue
        ctx.fillStyle = "#ffffff"
        ctx.fillRect((npc.x / TILE) * PX - 2, (npc.y / TILE) * PX - 2, 4, 4)
        ctx.fillStyle = "#4e9ce8"
        ctx.fillRect((npc.x / TILE) * PX - 1, (npc.y / TILE) * PX - 1, 2, 2)
      }
      const pulse = 2 + Math.round(Math.abs(Math.sin(performance.now() / 300)) * 2)
      const px = (sim.px / TILE) * PX
      const py = (sim.py / TILE) * PX
      ctx.fillStyle = "#2b1d2e"
      ctx.fillRect(px - pulse - 1, py - pulse - 1, pulse * 2 + 2, pulse * 2 + 2)
      ctx.fillStyle = "#e8506a"
      ctx.fillRect(px - pulse, py - pulse, pulse * 2, pulse * 2)
    }
    draw()
    const timer = window.setInterval(draw, 250)
    return () => window.clearInterval(timer)
  }, [act, getSim, world])

  return (
    <Plate title="Map of Valdivia" onClose={onClose} wide>
      <canvas
        ref={ref}
        width={MAP_W * PX}
        height={MAP_H * PX}
        className={`bg-map${onPick ? " is-pick" : ""}`}
        aria-label="World map"
        onClick={
          onPick
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const tx = Math.floor(((e.clientX - r.left) / r.width) * MAP_W)
                const ty = Math.floor(((e.clientY - r.top) / r.height) * MAP_H)
                onPick([Math.max(0, Math.min(MAP_W - 1, tx)), Math.max(0, Math.min(MAP_H - 1, ty))])
              }
            : undefined
        }
      />
      {onPick ? <p className="bg-dev-note">Development mode: click the map to teleport there.</p> : null}
      <p className="bg-faint">Red pin: you. Blue dots: friends who are up. Pink squares: places to visit. Cobalt roofs: friends' homes. Dimmed regions (✕) are behind a gate. Press M to close.</p>
    </Plate>
  )
}
