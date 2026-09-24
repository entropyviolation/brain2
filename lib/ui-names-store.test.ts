import { beforeEach, describe, expect, it } from "vitest"
import { writeAliasedLocal } from "./storage-keys"
import { parseUiMode, useUiNamesStore } from "./ui-names-store"

describe("parseUiMode", () => {
  it("keeps known modes and falls unknown values to off", () => {
    expect(parseUiMode("off")).toBe("off")
    expect(parseUiMode("names")).toBe("names")
    expect(parseUiMode("help")).toBe("off")
    expect(parseUiMode(true)).toBe("off")
    expect(parseUiMode(undefined)).toBe("off")
  })
})

describe("ui-names-store", () => {
  beforeEach(() => {
    localStorage.clear()
    useUiNamesStore.setState({ mode: "off" })
  })

  it("defaults off and toggles Names as a mutually exclusive mode", () => {
    expect(useUiNamesStore.getState().mode).toBe("off")
    useUiNamesStore.getState().toggle("names")
    expect(useUiNamesStore.getState().mode).toBe("names")
    useUiNamesStore.getState().toggle("names")
    expect(useUiNamesStore.getState().mode).toBe("off")
  })

  it("setMode writes the union and persists it", async () => {
    useUiNamesStore.getState().setMode("names")
    expect(useUiNamesStore.getState().mode).toBe("names")

    await Promise.resolve()
    const raw = localStorage.getItem("brain2-ui-names") ?? localStorage.getItem("cogs-ui-names")
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? "{}") as { state?: { mode?: string }; version?: number }
    expect(parsed.state?.mode).toBe("names")
    expect(parsed.version).toBe(1)
  })

  it("rehydrates a saved names mode", async () => {
    writeAliasedLocal(
      "cogs-ui-names",
      JSON.stringify({
        state: { mode: "names" },
        version: 1,
      }),
    )
    await useUiNamesStore.persist.rehydrate()
    expect(useUiNamesStore.getState().mode).toBe("names")
  })

  it("drops an unknown persisted mode to off", async () => {
    writeAliasedLocal(
      "cogs-ui-names",
      JSON.stringify({
        state: { mode: "inspect" },
        version: 1,
      }),
    )
    await useUiNamesStore.persist.rehydrate()
    expect(useUiNamesStore.getState().mode).toBe("off")
  })
})
