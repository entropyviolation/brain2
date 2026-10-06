import { describe, expect, it } from "vitest"
import { NAV_BOOT_SCRIPT } from "@/lib/nav-boot"

describe("nav boot script", () => {
  it("stamps the saved app tab before paint", () => {
    expect(NAV_BOOT_SCRIPT).toContain("brain2-app-tab")
    expect(NAV_BOOT_SCRIPT).toContain("cogs-app-tab")
    expect(NAV_BOOT_SCRIPT).toContain("brain2-demo-app-tab")
    expect(NAV_BOOT_SCRIPT).toContain("data-boot-tab")
  })
})
