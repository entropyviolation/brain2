import { describe, expect, it } from "vitest"
import { generateKeyPair, open, seal } from "./sealed-box.mjs"

describe("sealed box", () => {
  it("round-trips and hides the plaintext", () => {
    const { publicKey, privateKey } = generateKeyPair()
    const sealed = seal(publicKey, JSON.stringify({ text: "groc milk" }))
    expect(sealed).not.toContain("milk")
    expect(JSON.parse(open(privateKey, sealed).toString())).toEqual({ text: "groc milk" })
  })

  it("refuses another key and tampered data", () => {
    const a = generateKeyPair()
    const b = generateKeyPair()
    const sealed = seal(a.publicKey, "hello")
    expect(() => open(b.privateKey, sealed)).toThrow()
    const parts = sealed.split(".")
    parts[4] = Buffer.from("tampered").toString("base64url")
    expect(() => open(a.privateKey, parts.join("."))).toThrow()
  })

  it("seals the same text differently each time", () => {
    const { publicKey } = generateKeyPair()
    expect(seal(publicKey, "x")).not.toBe(seal(publicKey, "x"))
  })
})
