/**
 * app/lab/baby-casa/page.tsx — The six rooms of the cottage, whole, furnished
 *
 * A review aid: each room painted once at 1:1 with its furniture and no walkers, then doubled, so the plaster, glass, wood and the sprites can be judged without walking. Ticking "solids" shades the tiles you cannot walk on.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { roomWhole } from "@/components/BabyGame/casa-paint"
import { CT, FLOORS } from "@/lib/baby-game/casa"

export default function BabyCasaPage() {
  const refs = useRef<Array<HTMLCanvasElement | null>>([])
  const [solids, setSolids] = useState(false)
  useEffect(() => {
    FLOORS.forEach((f, i) => {
      const c = refs.current[i]
      if (!c) return
      c.width = f.w * CT
      c.height = f.h * CT
      const ctx = c.getContext("2d")!
      ctx.imageSmoothingEnabled = false
      roomWhole(ctx, f.id)
      if (solids) {
        ctx.fillStyle = "rgba(220,40,60,0.38)"
        for (const [x0, y0, x1, y1] of f.solid) if (y0 >= 11) ctx.fillRect(x0 * CT, y0 * CT, (x1 - x0 + 1) * CT, (y1 - y0 + 1) * CT)
        ctx.fillStyle = "rgba(255,255,255,0.9)"
        for (const s of f.spots) ctx.fillRect(s.x * CT + 6, s.y * CT + 6, 4, 4)
      }
    })
  }, [solids])
  return (
    <main style={{ padding: 16, background: "#0b1016", color: "#cfe0e4", minHeight: "100vh" }}>
      <label style={{ font: "12px system-ui", display: "block", marginBottom: 12 }}>
        <input type="checkbox" checked={solids} onChange={(e) => setSolids(e.target.checked)} /> solids (red) and spots (white dots)
      </label>
      {FLOORS.map((f, i) => (
        <section key={f.id} style={{ marginBottom: 24 }}>
          <h2 style={{ font: "600 14px system-ui", margin: "0 0 6px" }}>{f.id}: {f.name}</h2>
          <canvas ref={(el) => { refs.current[i] = el }} style={{ width: f.w * 32, imageRendering: "pixelated", maxWidth: "100%" }} />
        </section>
      ))}
    </main>
  )
}
