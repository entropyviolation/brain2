import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addPdf, cleanPdfName, handleSpeedReadApi, loadLibrary, setPdfPage } from "@/scripts/speed-read-api.mjs"

const PDF = Buffer.from("%PDF-1.4\n%fake\n")

function mockRes() {
  const chunks: Buffer[] = []
  let status = 0
  let headers: Record<string, unknown> = {}
  return {
    get status() {
      return status
    },
    get headers() {
      return headers
    },
    raw: () => Buffer.concat(chunks),
    body: () => JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"),
    writeHead(code: number, h?: Record<string, unknown>) {
      status = code
      headers = h || {}
    },
    end(data?: string | Buffer) {
      if (data) chunks.push(Buffer.from(data))
    },
  }
}

function mockReq(method: string, opts: { remote?: string; body?: Buffer; headers?: Record<string, string> } = {}) {
  return {
    method,
    headers: opts.headers || {},
    socket: { remoteAddress: opts.remote || "127.0.0.1" },
    destroy() {},
    on(event: string, cb: (arg?: Buffer) => void) {
      if (event === "data" && opts.body) cb(opts.body)
      if (event === "end") cb()
    },
  }
}

let dir = ""
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "speed-read-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  delete process.env.BRAIN2_PHONE_HUB_TOKEN
})

describe("speed-read library", () => {
  it("cleans names", () => {
    expect(cleanPdfName("a%2Fb%2FMy%20Book.pdf")).toBe("My Book")
    expect(cleanPdfName("")).toBe("Untitled")
  })

  it("stores a PDF once and bumps it on re-upload", () => {
    const a = addPdf(dir, PDF, "One.pdf", 1)
    const b = addPdf(dir, PDF, "Other name.pdf", 2)
    expect(b.id).toBe(a.id)
    expect(loadLibrary(dir)).toEqual([{ id: a.id, name: "One", bytes: PDF.length, addedAt: 1, openedAt: 2 }])
    expect(fs.readFileSync(path.join(dir, `${a.id}.pdf`))).toEqual(PDF)
  })

  it("remembers the page a book was left on", async () => {
    const a = addPdf(dir, PDF, "One.pdf", 1)
    const res = mockRes()
    await handleSpeedReadApi(mockReq("PATCH", { body: Buffer.from(JSON.stringify({ page: 11 })) }), res, `/api/speed-read/${a.id}`, { dir })
    expect(res.status).toBe(200)
    expect(loadLibrary(dir)[0].page).toBe(11)
    expect(setPdfPage(dir, "0000000000000000", 3)).toBeNull()
  })

  it("remembers the word on that page and when it was saved", async () => {
    const a = addPdf(dir, PDF, "One.pdf", 1)
    const res = mockRes()
    await handleSpeedReadApi(mockReq("PATCH", { body: Buffer.from(JSON.stringify({ page: 4, word: 37 })) }), res, `/api/speed-read/${a.id}`, { dir })
    const [entry] = loadLibrary(dir)
    expect(entry.page).toBe(4)
    expect(entry.word).toBe(37)
    expect(entry.savedAt).toBeGreaterThan(0)
    expect(setPdfPage(dir, a.id, 5, -3, 9)).toMatchObject({ page: 5, word: 0, savedAt: 9 })
  })

  it("refuses a file that is not a PDF", () => {
    expect(() => addPdf(dir, Buffer.from("hello"), "x.pdf")).toThrow("That is not a PDF.")
  })

  it("uploads, lists, serves and removes over HTTP", async () => {
    const up = mockRes()
    await handleSpeedReadApi(mockReq("POST", { body: PDF, headers: { "x-file-name": "Book.pdf" } }), up, "/api/speed-read", { dir })
    const id = up.body().item.id
    const list = mockRes()
    await handleSpeedReadApi(mockReq("GET"), list, "/api/speed-read", { dir })
    expect(list.body().items.map((x: { name: string }) => x.name)).toEqual(["Book"])
    const file = mockRes()
    await handleSpeedReadApi(mockReq("GET"), file, `/api/speed-read/file/${id}`, { dir })
    expect(file.headers["Content-Type"]).toBe("application/pdf")
    expect(file.raw()).toEqual(PDF)
    const del = mockRes()
    await handleSpeedReadApi(mockReq("DELETE"), del, `/api/speed-read/${id}`, { dir })
    expect(del.status).toBe(200)
    expect(loadLibrary(dir)).toEqual([])
  })

  it("needs the hub token from off this Mac when one is set", async () => {
    process.env.BRAIN2_PHONE_HUB_TOKEN = "secret"
    const lan = mockRes()
    await handleSpeedReadApi(mockReq("GET", { remote: "192.168.1.9" }), lan, "/api/speed-read", { dir })
    expect(lan.status).toBe(401)
    const ok = mockRes()
    await handleSpeedReadApi(mockReq("GET", { remote: "192.168.1.9", headers: { authorization: "Bearer secret" } }), ok, "/api/speed-read", { dir })
    expect(ok.status).toBe(200)
    const local = mockRes()
    await handleSpeedReadApi(mockReq("GET"), local, "/api/speed-read", { dir })
    expect(local.status).toBe(200)
  })

  it("ignores other routes", async () => {
    expect(await handleSpeedReadApi(mockReq("GET"), mockRes(), "/api/persist", { dir })).toBe(false)
  })
})
