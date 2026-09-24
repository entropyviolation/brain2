import { describe, expect, it } from "vitest"
import { extractConnectedComponents, knockOutPhotoBackground, knockOutUniformBackground } from "@/lib/remove-background"

function buffer(w: number, h: number, fill: [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = fill[3]
  }
  return { width: w, height: h, data }
}

function paint(buf: { width: number; data: Uint8ClampedArray }, x: number, y: number, rgb: [number, number, number]) {
  const i = (y * buf.width + x) * 4
  buf.data[i] = rgb[0]
  buf.data[i + 1] = rgb[1]
  buf.data[i + 2] = rgb[2]
  buf.data[i + 3] = 255
}

describe("remove-background helpers", () => {
  it("floods white from corners and keeps an interior gem", () => {
    const buf = buffer(12, 12, [255, 255, 255, 255])
    for (let y = 4; y <= 7; y++) {
      for (let x = 4; x <= 7; x++) paint(buf, x, y, [30, 180, 90])
    }
    const bounds = knockOutUniformBackground(buf, 40)
    expect(buf.data[0 + 3]).toBe(0)
    expect(buf.data[(4 * 12 + 4) * 4 + 3]).toBe(255)
    expect(bounds.kept).toBeGreaterThan(0)
  })

  it("splits two compact stones", () => {
    const buf = buffer(20, 10, [0, 0, 0, 0])
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) paint(buf, x, y, [200, 40, 40])
      for (let x = 12; x <= 15; x++) paint(buf, x, y, [40, 40, 200])
    }
    const blobs = extractConnectedComponents(buf, { minArea: 4, minAreaFraction: 0, minFill: 0.3, maxAspect: 3 })
    expect(blobs).toHaveLength(2)
  })

  it("keeps a brown animal on a green field and clears the grass", () => {
    const buf = buffer(24, 24, [50, 150, 70, 255])
    for (let y = 8; y <= 16; y++) {
      for (let x = 8; x <= 16; x++) paint(buf, x, y, [120, 70, 35])
    }
    const bounds = knockOutPhotoBackground(buf, 40)
    expect(buf.data[3]).toBe(0)
    expect(buf.data[(12 * 24 + 12) * 4 + 3]).toBe(255)
    expect(bounds.kept).toBeGreaterThan(20)
    expect(bounds.kept).toBeLessThan(24 * 24 * 0.7)
  })

  it("does not eat an animal that touches the bottom edge", () => {
    const buf = buffer(24, 24, [40, 140, 60, 255])
    for (let y = 10; y <= 23; y++) {
      for (let x = 8; x <= 15; x++) paint(buf, x, y, [95, 55, 28])
    }
    knockOutPhotoBackground(buf, 40)
    expect(buf.data[(16 * 24 + 12) * 4 + 3]).toBe(255)
    expect(buf.data[3]).toBe(0)
  })

  it("leaves a tight dark crop alone instead of punching it out", () => {
    const buf = buffer(16, 16, [28, 24, 22, 255])
    const bounds = knockOutPhotoBackground(buf, 40)
    expect(buf.data[3]).toBe(255)
    expect(buf.data[(8 * 16 + 8) * 4 + 3]).toBe(255)
    expect(bounds.kept).toBe(16 * 16)
  })

  it("clears a black studio ground around a white lamb", () => {
    const buf = buffer(24, 24, [8, 8, 8, 255])
    for (let y = 7; y <= 16; y++) {
      for (let x = 8; x <= 15; x++) paint(buf, x, y, [240, 236, 228])
    }
    knockOutPhotoBackground(buf, 40)
    expect(buf.data[3]).toBe(0)
    expect(buf.data[(12 * 24 + 12) * 4 + 3]).toBe(255)
  })
})
