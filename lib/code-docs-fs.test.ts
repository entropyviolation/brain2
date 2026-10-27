import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { listDocs, readDocFile, safeDocPath } from "./code-docs-fs.mjs"

describe("code-docs-fs", () => {
  it("refuses a path that leaves docs", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "b2-docs-"))
    fs.writeFileSync(path.join(root, "README.md"), "# Hi\n")
    expect(safeDocPath(root, "../package.json")).toBeNull()
    expect(safeDocPath(root, "README.md/%2e%2e/secret")).toBeNull()
    expect(safeDocPath(root, "")).toBeNull()
    expect(safeDocPath(root, "README.md")).toMatch(/README\.md$/)
  })

  it("lists files and reads markdown", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "b2-docs-"))
    fs.mkdirSync(path.join(root, "screenshots"))
    fs.writeFileSync(path.join(root, "README.md"), "# Index\n")
    fs.writeFileSync(path.join(root, "screenshots", "a.png"), Buffer.from([1, 2, 3]))
    const listed = listDocs(root)
    expect(listed.missing).toBe(false)
    expect(listed.files.map((file) => file.path)).toEqual(["README.md", "screenshots/a.png"])
    expect(listed.files[0].kind).toBe("markdown")
    expect(listed.files[1].kind).toBe("image")
    const text = readDocFile(root, "README.md")
    expect(text.ok && text.encoding === "utf8" && text.text.startsWith("# Index")).toBe(true)
    const image = readDocFile(root, "screenshots/a.png")
    expect(image.ok && image.encoding === "base64").toBe(true)
  })

  it("sees the real docs index", () => {
    const listed = listDocs(path.join(process.cwd(), "docs"))
    expect(listed.missing).toBe(false)
    expect(listed.files.some((file) => file.path === "README.md" && file.kind === "markdown")).toBe(true)
    expect(listed.files.some((file) => file.kind === "image" && file.path.startsWith("screenshots/"))).toBe(true)
    expect(listed.files.every((file) => !file.path.split("/").includes(".."))).toBe(true)
  })
})
