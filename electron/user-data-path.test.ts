import path from "node:path"
import { describe, expect, it } from "vitest"
import { ELECTRON_VAULT_DIR_NAME, resolveElectronUserData } from "./user-data-path.js"

describe("resolveElectronUserData", () => {
  it("always uses the historical cogs folder, not the package name", () => {
    expect(ELECTRON_VAULT_DIR_NAME).toBe("cogs")
    expect(resolveElectronUserData("/tmp/Application Support")).toBe(
      path.join("/tmp/Application Support", "cogs"),
    )
  })

  it("does not follow a brain2 or BRAIN2 product rename or a git folder rename", () => {
    const vault = resolveElectronUserData("/Users/me/Library/Application Support")
    expect(vault.endsWith(`${path.sep}cogs`)).toBe(true)
    expect(vault.includes("brain2")).toBe(false)
    expect(vault.includes("BRAIN2")).toBe(false)
    expect(vault.includes("cogs copy")).toBe(false)
  })
})
