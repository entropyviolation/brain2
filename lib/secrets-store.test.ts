import { beforeEach, describe, expect, it } from "vitest"
import { secretsShown, useSecretsStore } from "@/lib/secrets-store"

describe("secrets store", () => {
  beforeEach(async () => {
    const s = useSecretsStore.getState()
    s.lock()
    useSecretsStore.setState({ record: null })
    localStorage.clear()
  })

  it("shows nothing until a passphrase is set, unlocked, and switched on", async () => {
    const s = useSecretsStore.getState
    expect(secretsShown("search")).toBe(false)
    expect(await s().setPassphrase("abc")).toBe(false) // too short
    expect(await s().setPassphrase("open-sesame")).toBe(true)
    expect(secretsShown("search")).toBe(false) // unlocked but not switched on
    expect(s().setInclude("search", true)).toBe(true)
    expect(secretsShown("search")).toBe(true)
    expect(secretsShown("chat")).toBe(false) // per surface
  })

  it("locking turns every surface off, and a wrong passphrase stays locked", async () => {
    const s = useSecretsStore.getState
    await s().setPassphrase("open-sesame")
    s().setInclude("chat", true)
    s().lock()
    expect(secretsShown("chat")).toBe(false)
    expect(s().setInclude("chat", true)).toBe(false)
    expect(await s().unlock("nope")).toBe(false)
    expect(await s().unlock("open-sesame")).toBe(true)
  })

  it("removing the passphrase needs the current one", async () => {
    const s = useSecretsStore.getState
    await s().setPassphrase("open-sesame")
    expect(await s().clearPassphrase("wrong")).toBe(false)
    expect(await s().clearPassphrase("open-sesame")).toBe(true)
    expect(s().record).toBeNull()
  })
})
