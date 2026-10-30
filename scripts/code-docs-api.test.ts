import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { handleCodeDocsApi } from "./code-docs-api.mjs"

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
    body() {
      return Buffer.concat(chunks)
    },
    json() {
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")
    },
    writeHead(code: number, next?: Record<string, unknown>) {
      status = code
      headers = next ?? {}
    },
    end(data?: string | Buffer) {
      if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data))
    },
  }
}

function mockReq(method: string) {
  return { method, headers: {}, socket: { remoteAddress: "127.0.0.1" } }
}

describe("code-docs api", () => {
  it("ignores other paths", async () => {
    const res = mockRes()
    const handled = await handleCodeDocsApi(mockReq("GET") as never, res as never, "/api/sync")
    expect(handled).toBe(false)
  })

  it("lists and serves a file, and refuses a path that leaves the folder", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "b2-docs-api-"))
    fs.writeFileSync(path.join(root, "README.md"), "# Hello\n")
    const list = mockRes()
    await handleCodeDocsApi(mockReq("GET") as never, list as never, "/api/code-docs", { docsRoot: root })
    expect(list.status).toBe(200)
    expect(list.json().files.map((file: { path: string }) => file.path)).toEqual(["README.md"])

    const file = mockRes()
    await handleCodeDocsApi(mockReq("GET") as never, file as never, "/api/code-docs/raw/README.md", { docsRoot: root })
    expect(file.status).toBe(200)
    expect(file.body().toString("utf8")).toBe("# Hello\n")
    expect(String(file.headers["Content-Type"])).toMatch(/markdown/)

    const escaped = mockRes()
    await handleCodeDocsApi(mockReq("GET") as never, escaped as never, "/api/code-docs/raw/../package.json", { docsRoot: root })
    expect(escaped.status).toBe(400)
  })
})
