import { describe, expect, it } from "vitest"
import { hubRequestAuthorized, isGatedHubPath, scanDoorAuthorized, tokensEqual } from "./hub-auth"

describe("hub auth", () => {
  it("gates the vault routes only", () => {
    expect(isGatedHubPath("/api/persist")).toBe(true)
    expect(isGatedHubPath("/api/persist/health")).toBe(true)
    expect(isGatedHubPath("/api/recovery-backups/a.json")).toBe(true)
    expect(isGatedHubPath("/health")).toBe(false)
    expect(isGatedHubPath("/api/ingest/status")).toBe(false)
    expect(isGatedHubPath("/telegram/webhook")).toBe(false)
  })

  it("is open when no token is set", () => {
    expect(hubRequestAuthorized("", undefined)).toBe(true)
  })

  it("shuts the scan door when no token is set", () => {
    expect(scanDoorAuthorized("", "Bearer anything")).toBe(false)
    expect(scanDoorAuthorized("", undefined)).toBe(false)
    expect(scanDoorAuthorized("s3cret", undefined)).toBe(false)
    expect(scanDoorAuthorized("s3cret", "Bearer s3cret")).toBe(true)
    expect(isGatedHubPath("/api/scan")).toBe(false)
    expect(isGatedHubPath("/api/nfc/tags")).toBe(false)
  })

  it("needs the exact bearer token when set", () => {
    expect(hubRequestAuthorized("s3cret", undefined)).toBe(false)
    expect(hubRequestAuthorized("s3cret", "Bearer nope")).toBe(false)
    expect(hubRequestAuthorized("s3cret", "s3cret")).toBe(false)
    expect(hubRequestAuthorized("s3cret", "Bearer s3cret")).toBe(true)
  })

  it("compares webhook secrets without throwing on a different length", () => {
    expect(tokensEqual("abcd", "abcd")).toBe(true)
    expect(tokensEqual("abcd", "abc")).toBe(false)
    expect(tokensEqual("abcd", undefined)).toBe(false)
  })
})
