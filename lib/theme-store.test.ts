import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PCB_MODE, LEGACY_DEFAULT_PCB_MODE, PCB_MODE_SESSION_KEY } from "./pcb-backdrop"
import { removeAliasedLocal, writeAliasedLocal } from "./storage-keys"
import { DEFAULT_CHROME_FACE, DEFAULT_THEME, useThemeStore } from "./theme-store"

describe("theme-store chromeFace", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useThemeStore.setState({
      colors: DEFAULT_THEME,
      chromeFace: DEFAULT_CHROME_FACE,
      pcbMode: DEFAULT_PCB_MODE,
      appearanceRev: 0,
    })
  })

  afterEach(() => {
    useThemeStore.setState({
      chromeFace: DEFAULT_CHROME_FACE,
      pcbMode: DEFAULT_PCB_MODE,
      appearanceRev: 0,
    })
  })

  it("defaults to classic Win95 (50)", () => {
    expect(useThemeStore.getState().chromeFace).toBe(DEFAULT_CHROME_FACE)
    expect(DEFAULT_CHROME_FACE).toBe(50)
  })

  it("clamps the set-point and persists it", async () => {
    useThemeStore.getState().setChromeFace(72)
    expect(useThemeStore.getState().chromeFace).toBe(72)
    useThemeStore.getState().setChromeFace(400)
    expect(useThemeStore.getState().chromeFace).toBe(100)

    await Promise.resolve()
    const raw = localStorage.getItem("cogs-theme-store")
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? "{}") as { state?: { chromeFace?: number }; version?: number }
    expect(parsed.state?.chromeFace).toBe(100)
    expect(parsed.version).toBe(4)
  })

  it("rehydrates a saved set-point", async () => {
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 18 },
        version: 2,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().chromeFace).toBe(18)
  })

  it("migrates v1 snapshots to classic gray without dropping colors", async () => {
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: { ...DEFAULT_THEME, pointsToday: "#111111" } },
        version: 1,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe(LEGACY_DEFAULT_PCB_MODE)
    expect(useThemeStore.getState().chromeFace).toBe(DEFAULT_CHROME_FACE)
    expect(useThemeStore.getState().colors.pointsToday).toBe("#111111")
  })
})

describe("theme-store pcbMode", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useThemeStore.setState({ pcbMode: DEFAULT_PCB_MODE, appearanceRev: 0 })
  })

  it("defaults to teal and persists a selected plate", async () => {
    expect(useThemeStore.getState().pcbMode).toBe(DEFAULT_PCB_MODE)
    useThemeStore.getState().setPcbMode("xray")
    expect(useThemeStore.getState().pcbMode).toBe("xray")

    await Promise.resolve()
    const raw = localStorage.getItem("cogs-theme-store")
    const parsed = JSON.parse(raw ?? "{}") as { state?: { pcbMode?: string }; version?: number }
    expect(parsed.state?.pcbMode).toBe("xray")
    expect(parsed.version).toBe(4)
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("xray")
  })

  it("rehydrates a saved plate and keeps missing pcbMode on the old ceramic default", async () => {
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 40, pcbMode: "ice" },
        version: 3,
      }),
    )
    removeAliasedLocal("cogs-pcb-mode")
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("ice")
    expect(useThemeStore.getState().chromeFace).toBe(40)

    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 22, pcbMode: "fr4" },
        version: 2,
      }),
    )
    removeAliasedLocal("cogs-pcb-mode")
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("fr4")
    expect(useThemeStore.getState().chromeFace).toBe(22)

    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 22 },
        version: 2,
      }),
    )
    removeAliasedLocal("cogs-pcb-mode")
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe(LEGACY_DEFAULT_PCB_MODE)
    expect(useThemeStore.getState().chromeFace).toBe(22)
  })

  it("does not roll a live plate back when a staler snapshot rehydrates", async () => {
    useThemeStore.getState().setPcbMode("ice")
    expect(useThemeStore.getState().appearanceRev).toBeGreaterThan(0)
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 40, pcbMode: "xray", appearanceRev: 0 },
        version: 3,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("ice")
  })

  it("keeps a pinned plate when the theme blob is overwritten with ceramic", async () => {
    useThemeStore.getState().setPcbMode("fr4")
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("fr4")
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 50, pcbMode: "ceramic", appearanceRev: 0 },
        version: 3,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("fr4")
  })

  it("keeps a saved plate over a stale PCB pin on rehydrate", async () => {
    writeAliasedLocal("cogs-pcb-mode", "xray")
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 40, pcbMode: "mint", appearanceRev: 5 },
        version: 4,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("mint")
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("mint")
  })

  it("keeps a plate picked before hydration finished", async () => {
    // Electron's getItem waits on the persist hub, so a pick can land while the
    // store is still on seed defaults. The old counter stamped it rev 1, the
    // stored rev 6 won the merge, and the pin was rewritten to xray.
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 50, pcbMode: "xray", appearanceRev: 6 },
        version: 4,
      }),
    )
    writeAliasedLocal("cogs-pcb-mode", "xray")
    useThemeStore.setState({ pcbMode: DEFAULT_PCB_MODE, appearanceRev: 0 })

    useThemeStore.getState().setPcbMode("ceramic")
    sessionStorage.clear()
    await useThemeStore.persist.rehydrate()

    expect(useThemeStore.getState().pcbMode).toBe("ceramic")
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("ceramic")
  })

  it("does not roll a live plate back when a later snapshot rehydrates", async () => {
    useThemeStore.getState().setPcbMode("mint")
    expect(sessionStorage.getItem(PCB_MODE_SESSION_KEY)).toBe("mint")
    writeAliasedLocal(
      "cogs-theme-store",
      JSON.stringify({
        state: { colors: DEFAULT_THEME, chromeFace: 40, pcbMode: "xray", appearanceRev: 9 },
        version: 4,
      }),
    )
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().pcbMode).toBe("mint")
    expect(localStorage.getItem("cogs-pcb-mode")).toBe("mint")
  })
})
