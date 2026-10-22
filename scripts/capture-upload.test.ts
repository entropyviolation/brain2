import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createUploadRoutes } from "./capture-upload.mjs"
import { generateKeyPair, open, seal } from "./sealed-box.mjs"

let dir = ""
let server: http.Server
let base = ""

async function start(maxBytes?: number) {
  const uploads = createUploadRoutes({ dir, uploadToken: "up-token", pullToken: "pull-token", maxBytes })
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://x")
    if (await uploads.handle(req, res, url)) return
    res.writeHead(404).end()
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
}

const post = (p: string, token: string, body: unknown) =>
  fetch(base + p, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
const get = (p: string, token: string) => fetch(base + p, { headers: { Authorization: `Bearer ${token}` } })

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "capture-upload-"))
})
afterEach(async () => {
  await new Promise((r) => server?.close(r))
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("capture upload routes", () => {
  it("takes a sealed batch from the phone and hands it to the hub", async () => {
    await start()
    const { publicKey, privateKey } = generateKeyPair()
    const sealed = seal(publicKey, JSON.stringify({ kind: "location", events: [] }))
    const res = await post("/upload", "up-token", { kind: "location", sealed })
    expect(await res.json()).toEqual({ ok: true, seq: 1 })

    const pulled = await (await get("/uploads?after=0&kind=location", "pull-token")).json()
    expect(pulled.items).toHaveLength(1)
    expect(pulled.items[0]).toMatchObject({ seq: 1, kind: "location" })
    expect(JSON.parse(open(privateKey, pulled.items[0].sealed).toString()).kind).toBe("location")
    expect(fs.readFileSync(path.join(dir, "uploads.jsonl"), "utf8")).not.toContain("events")

    expect(await (await post("/uploads/ack", "pull-token", { upto: 1 })).json()).toEqual({ ok: true, remaining: 0 })
    expect((await (await get("/uploads?after=0", "pull-token")).json()).items).toEqual([])
  })

  it("acks only the kind it names", async () => {
    await start()
    const sealed = seal(generateKeyPair().publicKey, "x")
    await post("/upload", "up-token", { kind: "health", sealed })
    await post("/upload", "up-token", { kind: "location", sealed })
    expect(await (await post("/uploads/ack", "pull-token", { upto: 2, kind: "location" })).json()).toEqual({ ok: true, remaining: 1 })
    const left = (await (await get("/uploads?after=0", "pull-token")).json()).items
    expect(left.map((r: { kind: string }) => r.kind)).toEqual(["health"])
  })

  it("keeps the two tokens apart", async () => {
    await start()
    const sealed = seal(generateKeyPair().publicKey, "x")
    expect((await post("/upload", "pull-token", { kind: "location", sealed })).status).toBe(401)
    expect((await get("/uploads", "up-token")).status).toBe(401)
    expect((await post("/uploads/ack", "up-token", { upto: 99 })).status).toBe(401)
  })

  it("refuses clear text, unknown kinds, and a full queue", async () => {
    await start(10)
    expect((await post("/upload", "up-token", { kind: "location", sealed: '{"lat":45}' })).status).toBe(400)
    const sealed = seal(generateKeyPair().publicKey, "x")
    expect((await post("/upload", "up-token", { kind: "texts", sealed })).status).toBe(400)
    expect((await post("/upload", "up-token", { kind: "location", sealed })).status).toBe(200)
    expect((await post("/upload", "up-token", { kind: "location", sealed })).status).toBe(507)
  })

  it("keeps counting after a restart", async () => {
    await start()
    const sealed = seal(generateKeyPair().publicKey, "x")
    await post("/upload", "up-token", { kind: "location", sealed })
    await new Promise((r) => server.close(r))
    await start()
    expect(await (await post("/upload", "up-token", { kind: "location", sealed })).json()).toEqual({ ok: true, seq: 2 })
  })
})

/**
 * LocationPlugin.swift seals with CryptoKit from raw 32-byte keys: SPKI prefix
 * + raw key as the DER, HKDF-SHA256 salt = epk DER ‖ recipient DER, info and
 * AAD "brain2-capture-v1", 12-byte nonce, base64url without padding. This
 * builds the same thing by hand and checks sealed-box.mjs opens it.
 */
describe("the phone's seal", () => {
  it("opens with sealed-box.mjs", () => {
    const SPKI_X25519 = Buffer.from("302a300506032b656e032100", "hex")
    const INFO = Buffer.from("brain2-capture-v1")
    const { publicKey, privateKey } = generateKeyPair()
    const recipientDer = Buffer.from(publicKey, "base64")
    expect(recipientDer.subarray(0, 12).equals(SPKI_X25519)).toBe(true)
    expect(recipientDer.length).toBe(44)

    const eph = crypto.generateKeyPairSync("x25519")
    const ephRaw = eph.publicKey.export({ format: "jwk" }).x!
    const epkDer = Buffer.concat([SPKI_X25519, Buffer.from(ephRaw, "base64url")])
    const recipientRaw = recipientDer.subarray(12)
    const recipient = crypto.createPublicKey({ key: { kty: "OKP", crv: "X25519", x: recipientRaw.toString("base64url") }, format: "jwk" })
    const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipient })
    const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.concat([epkDer, recipientDer]), INFO, 32))
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    cipher.setAAD(INFO)
    const ct = Buffer.concat([cipher.update('{"kind":"location"}'), cipher.final()])
    const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const sealed = ["v1", b64u(epkDer), b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join(".")

    expect(open(privateKey, sealed).toString()).toBe('{"kind":"location"}')
  })
})
