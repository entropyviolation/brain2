/**
 * app/lab/baby-casa/page.tsx — The three floors of the cottage, whole
 *
 * A review aid: each room painted once at 1:1, then doubled, so the plaster, glass and wood can be judged without walking.
 */
"use client"

import { useEffect, useRef } from "react"
import { floorCanvas } from "@/components/BabyGame/casa-paint"
import { FLOORS } from "@/lib/baby-game/casa"

export default function BabyCasaPage() {
  const refs = useRef<Array<HTMLCanvasElement | null>>([])
  useEffect(() => {
    FLOORS.forEach((f, i) => {
      const c = refs.current[i]
      if (!c) return
      const src = floorCanvas(f.id)
      c.width = src.width
      c.height = src.height
      const ctx = c.getContext("2d")!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(src, 0, 0)
    })
  }, [])
  return (
    <main style={{ padding: 16, background: "#0b1016", color: "#cfe0e4", minHeight: "100vh" }}>
      {FLOORS.map((f, i) => (
        <section key={f.id} style={{ marginBottom: 24 }}>
          <h2 style={{ font: "600 14px system-ui", margin: "0 0 6px" }}>{f.id}: {f.name}</h2>
          <canvas ref={(el) => { refs.current[i] = el }} style={{ width: f.w * 32, imageRendering: "pixelated", maxWidth: "100%" }} />
        </section>
      ))}
    </main>
  )
}
