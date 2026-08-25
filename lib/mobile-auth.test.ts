import { afterEach, describe, expect, it } from "vitest"
import {
  clearMobileSession,
  readMobileSession,
  validateMobileCredentials,
  writeMobileSession,
} from "@/lib/mobile-auth"

describe("mobile-auth", () => {
  afterEach(() => {
    clearMobileSession()
  })

  it("accepts admin/admin only", () => {
    expect(validateMobileCredentials("admin", "admin")).toBe(true)
    expect(validateMobileCredentials("admin", "wrong")).toBe(false)
    expect(validateMobileCredentials("other", "admin")).toBe(false)
  })

  it("round-trips session in sessionStorage", () => {
    expect(readMobileSession()).toBeNull()
    const session = writeMobileSession("admin")
    expect(session.username).toBe("admin")
    expect(readMobileSession()?.username).toBe("admin")
    clearMobileSession()
    expect(readMobileSession()).toBeNull()
  })
})
