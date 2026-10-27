import { describe, expect, it } from "vitest"
import {
  DEFAULT_PEN_TRAY,
  PEN_TRAY_IDS,
  PEN_TRAY_META,
  isPenTrayId,
  parsePenTray,
  penTrayInkFor,
  penTrayStyle,
} from "./pen-tray-bg"

describe("pen tray catalog", () => {
  it("defaults to a photographed plate, not velvet", () => {
    expect(DEFAULT_PEN_TRAY).toBe("cat")
    expect(DEFAULT_PEN_TRAY).not.toBe("velvet")
    expect(PEN_TRAY_IDS).not.toContain("velvet")
    expect(PEN_TRAY_META[DEFAULT_PEN_TRAY].plate).toBe("/pen-tray/cat.jpg")
  })

  it("curates six instrument-tray stills with public URLs", () => {
    expect(PEN_TRAY_IDS).toEqual(["cat", "pewter", "jewel", "bloom", "fr4", "xray"])
    for (const id of PEN_TRAY_IDS) {
      const meta = PEN_TRAY_META[id]
      expect(meta.id).toBe(id)
      expect(meta.label.length).toBeGreaterThan(1)
      expect(meta.plate).toBe(`/pen-tray/${id}.jpg`)
      expect(meta.ink === "light" || meta.ink === "dark").toBe(true)
      expect(meta.fallback).toMatch(/^#/)
    }
  })

  it("rejects unknown ids and keeps jewel on dark ink", () => {
    expect(isPenTrayId("cat")).toBe(true)
    expect(isPenTrayId("velvet")).toBe(false)
    expect(parsePenTray("bloom")).toBe("bloom")
    expect(parsePenTray("velvet")).toBe(DEFAULT_PEN_TRAY)
    expect(parsePenTray(null)).toBe(DEFAULT_PEN_TRAY)
    expect(penTrayInkFor("jewel")).toBe("dark")
    expect(penTrayInkFor("cat")).toBe("light")
    expect(penTrayStyle("xray")["--pen-tray-photo"]).toBe('url("/pen-tray/xray.jpg")')
  })
})
