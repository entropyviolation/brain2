import { describe, expect, it } from "vitest"
import {
  DEFAULT_PCB_MODE,
  PCB_BACKDROP_BOOT_SCRIPT,
  PCB_MODE_STORAGE_KEY,
  PCB_MODES,
  PCB_MODE_META,
  applyPcbBackdrop,
  isPcbMode,
  parsePcbMode,
  pcbInkFor,
  readStoredPcbMode,
  writeStoredPcbMode,
} from "./pcb-backdrop"

describe("pcb-backdrop modes", () => {
  it("defaults to teal and rejects unknown ids", () => {
    expect(DEFAULT_PCB_MODE).toBe("teal")
    expect(parsePcbMode("mint")).toBe("mint")
    expect(parsePcbMode("nope")).toBe(DEFAULT_PCB_MODE)
    expect(parsePcbMode(null)).toBe(DEFAULT_PCB_MODE)
    expect(isPcbMode("fr4")).toBe(true)
    expect(isPcbMode("teal")).toBe(true)
    expect(isPcbMode("linen")).toBe(false)
  })

  it("maps light plates to dark ink and dark plates to light ink", () => {
    expect(pcbInkFor("teal")).toBe("dark")
    expect(pcbInkFor("ceramic")).toBe("dark")
    expect(pcbInkFor("mint")).toBe("dark")
    expect(pcbInkFor("ice")).toBe("dark")
    expect(pcbInkFor("xray")).toBe("light")
    expect(pcbInkFor("fr4")).toBe("light")
  })

  it("points photographed modes at a public /pcb/ plate", () => {
    expect(PCB_MODES).toHaveLength(6)
    expect(PCB_MODE_META.teal.plate).toBe("")
    for (const id of PCB_MODES) {
      if (id === "teal") continue
      expect(PCB_MODE_META[id].plate).toBe(`/pcb/${id}.jpg`)
    }
  })

  it("stamps data-pcb-mode and data-pcb-ink on the root", () => {
    const root = document.createElement("html")
    expect(applyPcbBackdrop(root, "xray")).toBe("xray")
    expect(root.getAttribute("data-pcb-mode")).toBe("xray")
    expect(root.getAttribute("data-pcb-ink")).toBe("light")
    expect(root.style.getPropertyValue("--pcb-desk")).toBe(PCB_MODE_META.xray.desk)

    applyPcbBackdrop(root, "garbage")
    expect(root.getAttribute("data-pcb-mode")).toBe(DEFAULT_PCB_MODE)
    expect(root.getAttribute("data-pcb-ink")).toBe("dark")
  })

  it("ships a boot script that knows every mode", () => {
    for (const id of PCB_MODES) {
      expect(PCB_BACKDROP_BOOT_SCRIPT).toContain(`"${id}"`)
      expect(PCB_BACKDROP_BOOT_SCRIPT).toContain(PCB_MODE_META[id].desk)
    }
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("cogs-theme-store")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("cogs-pcb-mode")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("brain2-demo-pcb-mode")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("brain2-data-profile")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("data-pcb-mode")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("brain2-pcb-pick")
    expect(PCB_BACKDROP_BOOT_SCRIPT).toContain("brain2-led-pick")
  })

  it("pins the plate on its own key so a refresh can read it before the theme blob", () => {
    localStorage.clear()
    expect(readStoredPcbMode()).toBeNull()
    expect(writeStoredPcbMode("ice")).toBe("ice")
    expect(localStorage.getItem(PCB_MODE_STORAGE_KEY)).toBe("ice")
    expect(readStoredPcbMode()).toBe("ice")
    expect(writeStoredPcbMode("nope")).toBe(DEFAULT_PCB_MODE)
  })
})
