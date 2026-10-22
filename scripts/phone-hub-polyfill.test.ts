import { describe, expect, it, vi } from "vitest"
import { dumpLocalStorage, fillLocalStorage, installPhoneHubGlobals } from "./phone-hub-polyfill.mjs"

// jsdom already has a localStorage; mark the globals installed (before the import
// runs) so the polyfill uses that one instead of replacing it.
vi.hoisted(() => {
  ;(globalThis as { __cogsPhoneHubGlobals?: boolean }).__cogsPhoneHubGlobals = true
})

const dump = () => dumpLocalStorage() as Record<string, string>

describe("phone hub localStorage snapshots", () => {
  it("drops a key the next snapshot left out, keeps the hub's own keys", () => {
    const ls = installPhoneHubGlobals()
    fillLocalStorage({ "brain2-a": "1", "brain2-b": "2" })
    ls.setItem("hub-own", "x")
    fillLocalStorage({ "brain2-a": "1" })
    expect(dump()["brain2-a"]).toBe("1")
    expect(dump()["brain2-b"]).toBeUndefined()
    expect(dump()["hub-own"]).toBe("x")
  })

  it("treats an empty snapshot as a failed read", () => {
    fillLocalStorage({ "brain2-c": "3" })
    fillLocalStorage({})
    expect(dump()["brain2-c"]).toBe("3")
  })
})
