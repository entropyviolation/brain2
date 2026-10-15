import { describe, expect, it } from "vitest"
import {
  easePileCamera,
  pileCameraCss,
  pileCameraTarget,
  pileFitScale,
  pileFloorPinPanY,
  pilePointerToWorld,
  pileScaleJump,
  pileSettleScrollTop,
  PILE_CAMERA_IDENTITY,
} from "@/components/Lists/lib/list-icon-pile-camera"

describe("pile camera fit", () => {
  it("never upscales past native icon size", () => {
    expect(pileFitScale(900, 400)).toBe(1)
    expect(pileFitScale(400, 800)).toBe(0.5)
  })
})

describe("pile floor pin", () => {
  it("places playfield bottom on the velvet viewport bottom", () => {
    expect(pileFloorPinPanY(1, 400, 400)).toBe(0)
    expect(pileFloorPinPanY(0.5, 400, 800)).toBe(0)
    expect(pileFloorPinPanY(1, 400, 800)).toBe(-400)
  })

  it("overview keeps the floor on the velvet bottom (no mid-canvas shelf)", () => {
    const viewportHeight = 400
    const playfieldHeight = 800
    const target = pileCameraTarget({
      phase: "overview",
      viewportHeight,
      playfieldHeight,
      focusY: 100,
    })
    expect(target.scale).toBe(0.5)
    const floorScreen = playfieldHeight * target.scale + target.panY
    expect(floorScreen).toBeCloseTo(viewportHeight, 5)
  })
})

describe("pile camera easing", () => {
  it("moves continuously toward the target without a discontinuous scale step", () => {
    const start = pileCameraTarget({
      phase: "overview",
      viewportHeight: 400,
      playfieldHeight: 800,
      focusY: 100,
    })
    const target = pileCameraTarget({
      phase: "follow",
      viewportHeight: 400,
      playfieldHeight: 800,
      focusY: 200,
    })
    expect(start.scale).toBe(0.5)

    let cam = start
    let prev = cam.scale
    for (let i = 0; i < 24; i++) {
      cam = easePileCamera(cam, target, 1 / 30, 5.5)
      expect(pileScaleJump(prev, cam.scale)).toBe(false)
      prev = cam.scale
      // Floor must not rise above the velvet bottom while easing.
      const floorScreen = 800 * cam.scale + cam.panY
      expect(floorScreen).toBeGreaterThanOrEqual(400 - 0.5)
    }
  })

  it("follow pan keeps focus near the upper-middle when that does not lift the floor", () => {
    const focusY = 200
    const viewportHeight = 400
    const playfieldHeight = 900
    const target = pileCameraTarget({
      phase: "follow",
      viewportHeight,
      playfieldHeight,
      focusY,
    })
    const screenY = focusY * target.scale + target.panY
    const floorScreen = playfieldHeight * target.scale + target.panY
    expect(floorScreen).toBeGreaterThanOrEqual(viewportHeight - 0.5)
    // With floor clamp, focus may sit lower than 0.4vh when near the heap.
    expect(screenY).toBeLessThanOrEqual(viewportHeight * 0.4 + 1)
  })

  it("follow never lifts the floor above the velvet bottom", () => {
    const viewportHeight = 400
    const playfieldHeight = 900
    const target = pileCameraTarget({
      phase: "follow",
      viewportHeight,
      playfieldHeight,
      focusY: 850,
    })
    const floorScreen = playfieldHeight * target.scale + target.panY
    expect(floorScreen).toBeGreaterThanOrEqual(viewportHeight - 0.5)
  })

  it("settle target is identity so desktop icons return to native size", () => {
    expect(
      pileCameraTarget({
        phase: "settle",
        viewportHeight: 400,
        playfieldHeight: 800,
        focusY: 700,
      }),
    ).toEqual(PILE_CAMERA_IDENTITY)
  })

  it("emits a single translate+scale transform string", () => {
    expect(pileCameraCss({ scale: 0.5, panY: -120 })).toBe("translate3d(0, -120.00px, 0) scale(0.5000)")
    expect(pileCameraCss(PILE_CAMERA_IDENTITY)).toBe("none")
  })
})

describe("pile settle scroll", () => {
  it("pins the playfield bottom to the velvet viewport after camera identity", () => {
    // Tall content → max scroll (floor at velvet bottom), not mid-heap centering.
    expect(pileSettleScrollTop(700, 400, 900)).toBe(500)
    expect(pileSettleScrollTop(50, 400, 900)).toBe(500)
    expect(pileSettleScrollTop(2000, 400, 500)).toBe(100)
    // Viewport taller than playfield → no scroll; floor already at canvas bottom.
    expect(pileSettleScrollTop(300, 640, 400)).toBe(0)
  })
})

describe("pile pointer → world", () => {
  it("inverts identity camera to canvas pixels", () => {
    const pt = pilePointerToWorld({
      clientX: 150,
      clientY: 80,
      canvasLeft: 50,
      canvasTop: 20,
      scrollTop: 10,
      canvasWidth: 400,
      cam: PILE_CAMERA_IDENTITY,
    })
    expect(pt.x).toBeCloseTo(100, 5)
    expect(pt.y).toBeCloseTo(70, 5)
  })

  it("inverts scale+pan so grab targets match the flight layer", () => {
    const cam = { scale: 0.5, panY: -40 }
    const world = { x: 200, y: 400 }
    // Forward: origin top-center of width 400 → originX=200
    // screenX = 200 + (200-200)*0.5 = 200; screenY = -40 + 400*0.5 = 160
    const pt = pilePointerToWorld({
      clientX: 200,
      clientY: 160,
      canvasLeft: 0,
      canvasTop: 0,
      scrollTop: 0,
      canvasWidth: 400,
      cam,
    })
    expect(pt.x).toBeCloseTo(world.x, 5)
    expect(pt.y).toBeCloseTo(world.y, 5)
  })
})
