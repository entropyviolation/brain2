import { describe, expect, it } from "vitest"
import { decideBrowserOrigin } from "./request-origin.mjs"

describe("browser origin gate", () => {
  it("allows a missing origin for non-browser clients", () => {
    expect(decideBrowserOrigin(undefined, "127.0.0.1:8787")).toEqual({ ok: true, reflect: null })
    expect(decideBrowserOrigin("", "localhost:3000")).toEqual({ ok: true, reflect: null })
  })

  it("allows the app on loopback, a LAN address, and Capacitor", () => {
    expect(decideBrowserOrigin("http://localhost:3000", "127.0.0.1:8787").ok).toBe(true)
    expect(decideBrowserOrigin("http://192.168.1.20:3000", "192.168.1.20:3000")).toEqual({
      ok: true,
      reflect: "http://192.168.1.20:3000",
    })
    expect(decideBrowserOrigin("http://mac.local:3000", "127.0.0.1:8787").ok).toBe(true)
    expect(decideBrowserOrigin("capacitor://localhost", "127.0.0.1:3000").ok).toBe(true)
    expect(decideBrowserOrigin("https://notes.example", "notes.example").ok).toBe(true)
  })

  it("refuses a public website, a null origin, and a lookalike host", () => {
    expect(decideBrowserOrigin("https://evil.example", "127.0.0.1:3000").ok).toBe(false)
    expect(decideBrowserOrigin("null", "localhost:3000").ok).toBe(false)
    expect(decideBrowserOrigin("http://localhost.evil.example", "localhost:3000").ok).toBe(false)
    expect(decideBrowserOrigin("http://127.0.0.1.evil.example", "127.0.0.1:8787").ok).toBe(false)
  })
})
