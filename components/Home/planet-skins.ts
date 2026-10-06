/**
 * components/Home/planet-skins.ts — Photographic globes for the solar chart
 *
 * Cylindrical maps in `public/planets/` are projected onto disks. Lighting
 * faces the Sun, so a globe keeps a day side and a night side.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { SATURN_RING } from "@/lib/solar-system"

export type GlobeLight = { x: number; y: number; z: number; emissive?: boolean }

const MAPS: Record<string, string> = {
  sun: "/planets/sun.jpg",
  mercury: "/planets/mercury.jpg",
  venus: "/planets/venus.jpg",
  earth: "/planets/earth.jpg",
  moon: "/planets/moon.jpg",
  mars: "/planets/mars.jpg",
  jupiter: "/planets/jupiter.jpg",
  saturn: "/planets/saturn.jpg",
  uranus: "/planets/uranus.jpg",
  neptune: "/planets/neptune.jpg",
}

const GLOBE = 96
const images = new Map<string, Promise<ImageData>>()
const painted = new Map<string, string>()

function loadImageData(src: string): Promise<ImageData> {
  const cached = images.get(src)
  if (cached) return cached
  const pending = new Promise<ImageData>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("no canvas"))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }
    img.onerror = () => reject(new Error(src))
    img.src = src
  })
  images.set(src, pending)
  return pending
}

function sample(data: ImageData, u: number, v: number): [number, number, number, number] {
  const { width, height, data: px } = data
  const uu = ((u % 1) + 1) % 1
  const vv = Math.max(0, Math.min(0.9999, v))
  const x = uu * (width - 1)
  const y = vv * (height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const at = (xx: number, yy: number) => {
    const i = (yy * width + xx) * 4
    return [px[i], px[i + 1], px[i + 2], px[i + 3]] as [number, number, number, number]
  }
  const a = at(x0, y0)
  const b = at(x1, y0)
  const c = at(x0, y1)
  const d = at(x1, y1)
  const mix = (i: number) =>
    (a[i] * (1 - tx) + b[i] * tx) * (1 - ty) + (c[i] * (1 - tx) + d[i] * tx) * ty
  return [mix(0), mix(1), mix(2), mix(3)]
}

/** Screen vector toward the Sun (y down) → globe light (y up). */
export function sunLight(screenX: number, screenY: number): GlobeLight {
  const len = Math.hypot(screenX, screenY) || 1
  const x = screenX / len
  const y = -screenY / len
  const z = 0.62
  const n = Math.hypot(x, y, z)
  return { x: x / n, y: y / n, z: z / n }
}

function paintGlobe(map: ImageData, light: GlobeLight): string {
  const canvas = document.createElement("canvas")
  canvas.width = GLOBE
  canvas.height = GLOBE
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const out = ctx.createImageData(GLOBE, GLOBE)
  for (let y = 0; y < GLOBE; y++) {
    for (let x = 0; x < GLOBE; x++) {
      const nx = ((x + 0.5) / GLOBE) * 2 - 1
      const ny = 1 - ((y + 0.5) / GLOBE) * 2
      const r2 = nx * nx + ny * ny
      const i = (y * GLOBE + x) * 4
      if (r2 > 1) continue
      const nz = Math.sqrt(1 - r2)
      const lon = Math.atan2(nx, nz)
      const lat = Math.asin(ny)
      const u = lon / (Math.PI * 2) + 0.5
      const v = 0.5 - lat / Math.PI
      const rgb = sample(map, u, v)
      const lambert = light.emissive ? 1 : Math.max(0, nx * light.x + ny * light.y + nz * light.z)
      const lit = light.emissive ? 1 : 0.08 + 0.92 * lambert
      const limb = 0.62 + 0.38 * nz
      const gain = lit * limb
      out.data[i] = Math.min(255, rgb[0] * gain)
      out.data[i + 1] = Math.min(255, rgb[1] * gain)
      out.data[i + 2] = Math.min(255, rgb[2] * gain)
      out.data[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

/** Saturn's rings as a tilted annulus. `inner` and `outer` are fractions of the sprite width. */
function paintRing(color: ImageData, alpha: ImageData): string {
  const w = 360
  const h = 128
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const out = ctx.createImageData(w, h)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const rx = w / 2 - 1
  const ry = h / 2 - 1
  const inner = SATURN_RING.inner / SATURN_RING.outer
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rad = Math.hypot((x - cx) / rx, (y - cy) / ry)
      if (rad > 1 || rad < inner) continue
      const u = (rad - inner) / (1 - inner)
      const rgb = sample(color, u, 0.5)
      const mask = sample(alpha, u, 0.5)
      const a = (mask[0] + mask[1] + mask[2]) / (255 * 3)
      const i = (y * w + x) * 4
      out.data[i] = rgb[0]
      out.data[i + 1] = rgb[1]
      out.data[i + 2] = rgb[2]
      out.data[i + 3] = Math.round(255 * Math.min(1, a * 1.15))
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

function cacheKey(id: string, light: GlobeLight): string {
  if (light.emissive) return `${id}:emit`
  return `${id}:${light.x.toFixed(2)}:${light.y.toFixed(2)}:${light.z.toFixed(2)}`
}

/** Data-URL globes keyed by body id, plus `saturn-ring`. Missing until the maps load. */
export function usePlanetSkins(lights: Record<string, GlobeLight>): Record<string, string> {
  const [skins, setSkins] = useState<Record<string, string>>({})
  const lightsRef = useRef(lights)
  lightsRef.current = lights
  const signature = Object.entries(lights)
    .map(([id, light]) => cacheKey(id, light))
    .sort()
    .join("|")

  useEffect(() => {
    let cancel = false
    const next: Record<string, string> = {}
    const jobs = Object.entries(lightsRef.current).map(async ([id, light]) => {
      const src = MAPS[id]
      if (!src) return
      const key = cacheKey(id, light)
      const hit = painted.get(key)
      if (hit) {
        next[id] = hit
        return
      }
      const map = await loadImageData(src)
      const url = paintGlobe(map, light)
      painted.set(key, url)
      next[id] = url
    })
    jobs.push(
      (async () => {
        const hit = painted.get("saturn-ring")
        if (hit) {
          next["saturn-ring"] = hit
          return
        }
        const [color, alpha] = await Promise.all([
          loadImageData("/planets/saturn-ring.jpg"),
          loadImageData("/planets/saturn-ring-alpha.gif"),
        ])
        const url = paintRing(color, alpha)
        painted.set("saturn-ring", url)
        next["saturn-ring"] = url
      })(),
    )
    void Promise.all(jobs)
      .then(() => {
        if (!cancel) setSkins({ ...next })
      })
      .catch(() => {
        if (!cancel) setSkins({ ...next })
      })
    return () => {
      cancel = true
    }
  }, [signature])

  return skins
}
