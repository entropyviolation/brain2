"use client"
import { useEffect, useRef } from "react"
import { drawCropHi, drawNodeHi } from "@/components/BabyGame/nodeart-hi"

const NODES = ["berry", "acorn", "reed", "clover", "pebble", "feather", "mushroom", "shell", "dig", "fish"]
const CROPS = ["glowbean", "puffroot", "twinklegourd", "spiralkale", "shadowradish", "mandalichoke", "schrodinberry", "fadeleek", "quincidence", "snowpearl"]
export default function Page() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!.getContext("2d")!
    c.fillStyle = "#8fc77e"
    c.fillRect(0, 0, 1800, 1100)
    c.imageSmoothingEnabled = false
    NODES.forEach((k, i) => {
      c.save()
      c.translate((i % 10) * 180 + 10, 60)
      c.scale(4, 4)
      drawNodeHi(c, k, 0, 0, i !== 8, 1.3)
      c.restore()
    })
    CROPS.forEach((k, i) => {
      for (const [j, f] of [0.1, 0.4, 0.8, 1].entries()) {
        c.save()
        c.translate(i * 180 + 10, 260 + j * 190)
        c.scale(4, 4)
        drawCropHi(c, k, 0, 0, f, 1.3)
        c.restore()
      }
    })
  }, [])
  return <canvas ref={ref} width={1800} height={1100} style={{ width: "100%" }} />
}
