/**
 * components/Home/home-moon-phase.tsx — Photographic moon for the detail header
 *
 * The Home tile keeps the 8-bit sprite. This disk is the detail only.
 * `public/planets/moon.jpg` is the cylindrical map the chart already uses,
 * projected the same way: near side facing us, north up, east to the right.
 * Waxing lights the right, and the lit fraction follows `cycle` the way
 * `moonGlance` does. The terminator is a soft twilight band. A label hides
 * when its point leaves the disk.
 */
"use client"

import { useEffect, useState } from "react"

/** CSS pixels. Markers are percentages of this square, so the paint can be sharper. */
export const MOON_PHASE_DISK = 252

const PAINT = 504
const MAP = "/planets/moon.jpg"

/**
 * Near side, IAU east-positive degrees (west is negative).
 * Aristarchus Plateau and Kepler use the given places.
 * Copernicus and Tycho are Gazetteer of Planetary Nomenclature centers.
 */
export const MOON_PHASE_MARKS = [
  { name: "Aristarchus Plateau", lat: 23.7, lon: -47.4 },
  { name: "Kepler Crater", lat: 8.1, lon: -38.0 },
  { name: "Copernicus Crater", lat: 9.62, lon: -20.08 },
  { name: "Tycho Crater", lat: -43.31, lon: -11.36 },
] as const

export type DiskPoint = { x: number; y: number; z: number; onDisk: boolean }

/** Orthographic near side. +x is east (right), +y is north (up), +z faces the viewer. */
export function selenographicPoint(latDeg: number, lonEastDeg: number): DiskPoint {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonEastDeg * Math.PI) / 180
  const x = Math.cos(lat) * Math.sin(lon)
  const y = Math.sin(lat)
  const z = Math.cos(lat) * Math.cos(lon)
  return { x, y, z, onDisk: z > 0.02 && x * x + y * y < 1 }
}

/** Same cycle as the pixel sprite: 0 new, 0.25 waxing (light from the right), 0.5 full. */
export function moonPhaseLight(cycle: number): { x: number; y: number; z: number } {
  const turns = ((cycle % 1) + 1) % 1
  const ang = turns * Math.PI * 2
  return { x: Math.sin(ang), y: 0, z: -Math.cos(ang) }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** 0 night, 1 day. The midpoint sits on the geometric terminator. */
export function moonPointDay(cycle: number, x: number, z: number): number {
  const light = moonPhaseLight(cycle)
  return smoothstep(-0.1, 0.14, x * light.x + z * light.z)
}

type Rect = { x: number; y: number; w: number; h: number }
type Side = "right" | "left"

const MARK_R = 6
const LABEL_H = 14
const CHAR_W = 6.35
const LABEL_GAP = 8
const DYS = [0, -15, 15, -30, 30, -44, 44]

export type PlacedMoonMark = {
  name: string
  onDisk: boolean
  /** Percent across the disk. */
  left: number
  top: number
  dy: number
  side: Side
  box: Rect
}

function markerBox(mx: number, my: number): Rect {
  return { x: mx - MARK_R, y: my - MARK_R, w: MARK_R * 2, h: MARK_R * 2 }
}

function labelBox(mx: number, my: number, textW: number, dy: number, side: Side): Rect {
  const y = my + dy - LABEL_H / 2
  if (side === "left") return { x: mx - MARK_R - LABEL_GAP - textW, y, w: textW, h: LABEL_H }
  return { x: mx + MARK_R + LABEL_GAP, y, w: textW, h: LABEL_H }
}

function overlaps(a: Rect, b: Rect): boolean {
  const pad = 3
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y
}

/** Marker stays on the coordinates. The name steps aside when two labels would meet. */
export function placeMoonMarks(disk = MOON_PHASE_DISK): PlacedMoonMark[] {
  const rows = MOON_PHASE_MARKS.map((feature) => {
    const point = selenographicPoint(feature.lat, feature.lon)
    return {
      feature,
      point,
      mx: (0.5 + point.x * 0.5) * disk,
      my: (0.5 - point.y * 0.5) * disk,
    }
  })
  const placed: Rect[] = []
  return rows.map((row) => {
    const hidden: PlacedMoonMark = {
      name: row.feature.name,
      onDisk: false,
      left: 0,
      top: 0,
      dy: 0,
      side: "right",
      box: { x: 0, y: 0, w: 0, h: 0 },
    }
    if (!row.point.onDisk) return hidden
    const textW = row.feature.name.length * CHAR_W
    let chosen: { side: Side; dy: number; box: Rect } | null = null
    for (const dy of DYS) {
      for (const side of ["right", "left"] as const) {
        const box = labelBox(row.mx, row.my, textW, dy, side)
        const hitsLabel = placed.some((other) => overlaps(box, other))
        const hitsMarker = rows.some(
          (other) =>
            other.feature.name !== row.feature.name &&
            other.point.onDisk &&
            overlaps(box, markerBox(other.mx, other.my)),
        )
        if (!hitsLabel && !hitsMarker && !overlaps(box, markerBox(row.mx, row.my))) {
          chosen = { side, dy, box }
          break
        }
      }
      if (chosen) break
    }
    const side = chosen?.side ?? "right"
    const dy = chosen?.dy ?? 0
    const box = chosen?.box ?? labelBox(row.mx, row.my, textW, dy, side)
    placed.push(box)
    return {
      name: row.feature.name,
      onDisk: true,
      left: (row.mx / disk) * 100,
      top: (row.my / disk) * 100,
      dy,
      side,
      box,
    }
  })
}

function toLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function toSrgb(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear))
  const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(s * 255)))
}

function sample(data: ImageData, u: number, v: number): [number, number, number] {
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
    return [px[i]!, px[i + 1]!, px[i + 2]!] as [number, number, number]
  }
  const a = at(x0, y0)
  const b = at(x1, y0)
  const c = at(x0, y1)
  const d = at(x1, y1)
  const mix = (i: number) => (a[i] * (1 - tx) + b[i] * tx) * (1 - ty) + (c[i] * (1 - tx) + d[i] * tx) * ty
  return [mix(0), mix(1), mix(2)]
}

let mapPromise: Promise<ImageData> | null = null
const painted = new Map<string, Promise<string>>()

function loadMap(): Promise<ImageData> {
  if (mapPromise) return mapPromise
  mapPromise = new Promise((resolve, reject) => {
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
    img.onerror = () => reject(new Error(MAP))
    img.src = MAP
  })
  return mapPromise
}

function paintMoonPhase(map: ImageData, cycle: number): string {
  const canvas = document.createElement("canvas")
  canvas.width = PAINT
  canvas.height = PAINT
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const out = ctx.createImageData(PAINT, PAINT)
  for (let y = 0; y < PAINT; y++) {
    for (let x = 0; x < PAINT; x++) {
      const nx = ((x + 0.5) / PAINT) * 2 - 1
      const ny = 1 - ((y + 0.5) / PAINT) * 2
      const r2 = nx * nx + ny * ny
      if (r2 >= 1) continue
      const nz = Math.sqrt(1 - r2)
      const lon = Math.atan2(nx, nz)
      const lat = Math.asin(ny)
      const rgb = sample(map, lon / (Math.PI * 2) + 0.5, 0.5 - lat / Math.PI)
      const day = moonPointDay(cycle, nx, nz)
      const limb = 0.9 + 0.1 * nz
      const gain = (0.01 + 0.99 * day) * limb
      const i = (y * PAINT + x) * 4
      out.data[i] = toSrgb(toLinear(rgb[0]) * gain)
      out.data[i + 1] = toSrgb(toLinear(rgb[1]) * gain)
      out.data[i + 2] = toSrgb(toLinear(rgb[2]) * gain)
      const rim = (1 - Math.sqrt(r2)) * (PAINT * 0.5)
      out.data[i + 3] = Math.max(0, Math.min(255, Math.round(rim * 255)))
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

function phaseUrl(cycle: number): Promise<string> {
  const key = ((cycle % 1) + 1) % 1
  const bucket = key.toFixed(5)
  const hit = painted.get(bucket)
  if (hit) return hit
  const job = loadMap().then((map) => paintMoonPhase(map, key))
  painted.set(bucket, job)
  return job
}

const MARKS = placeMoonMarks(MOON_PHASE_DISK)
const MARK_MIN_X = Math.min(0, ...MARKS.filter((mark) => mark.onDisk).map((mark) => mark.box.x))
const MARK_MAX_X = Math.max(MOON_PHASE_DISK, ...MARKS.filter((mark) => mark.onDisk).map((mark) => mark.box.x + mark.box.w))
const PHASE_GUTTER = Math.ceil(-MARK_MIN_X + 4)
const PHASE_WIDTH = PHASE_GUTTER + MOON_PHASE_DISK + Math.ceil(Math.max(0, MARK_MAX_X - MOON_PHASE_DISK) + 4)

export function MoonPhaseDisk({ cycle }: { cycle: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void phaseUrl(cycle).then((url) => {
      if (!cancel && url) setSrc(url)
    })
    return () => {
      cancel = true
    }
  }, [cycle])

  return (
    <div className="home-moon-phase" data-testid="home-moon-phase" style={{ width: PHASE_WIDTH, height: MOON_PHASE_DISK }}>
      <div className="home-moon-phase-disk-wrap" style={{ width: MOON_PHASE_DISK, marginLeft: PHASE_GUTTER }}>
        <div className="home-moon-phase-sky" aria-hidden="true" />
        {src ? <img className="home-moon-phase-disk" alt="Moon" src={src} /> : null}
        {MARKS.map((mark) =>
          mark.onDisk ? (
            <span key={mark.name} className="home-moon-phase-tag" style={{ left: `${mark.left}%`, top: `${mark.top}%` }}>
              <span className="home-moon-phase-mark" aria-hidden="true" />
              <span
                className={mark.side === "left" ? "home-moon-phase-name is-left" : "home-moon-phase-name"}
                style={{ transform: `translateY(calc(-50% + ${mark.dy}px))` }}
              >
                {mark.name}
              </span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}
