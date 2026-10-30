import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type LinkStat = {
  path: string
  name: string
  isDir: boolean
  size: number
  fileId?: string
  fileCount?: number
  truncated?: boolean
  bookmark?: string
}
type FileLinks = {
  statLink: (p: string, opts?: { platform?: string; bookmark?: boolean }) => Promise<LinkStat | null>
  resolveLink: (
    link: Partial<LinkStat> & { path: string },
    opts?: { platform?: string; spotlight?: (name: string) => Promise<string[]> },
  ) => Promise<{ status: string; how?: string; link?: LinkStat }>
  extractLinkText: (p: string, opts?: { pdfParse?: (b: Buffer) => Promise<{ text: string }> }) => Promise<string>
  walkDir: (root: string, opts?: { maxEntries?: number }) => Promise<{ fileCount: number; bytes: number; names: string[]; truncated: boolean }>
  isExecutablePath: (p: string) => boolean
  pathForOpen: (p: string) => Promise<{ path?: string; error?: string }>
  createPreviewRegistry: () => { urlFor: (p: string) => string; pathFor: (url: string) => string }
}
const links = nodeRequire("./file-links.js") as FileLinks
const LINUX = { platform: "linux" }

let root: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-links-"))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function write(rel: string, text: string): string {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
  return p
}

describe("statLink", () => {
  it("describes a file with its id and size", async () => {
    const p = write("a/Big.psd", "x".repeat(42))
    const s = await links.statLink(p, LINUX)
    expect(s).toMatchObject({ path: p, name: "Big.psd", isDir: false, size: 42 })
    expect(s?.fileId).toMatch(/^\d+:\d+$/)
    expect(s?.bookmark).toBeUndefined()
  })

  it("counts a folder and skips node_modules and .git", async () => {
    write("code/src/a.ts", "aaa")
    write("code/README.md", "bb")
    write("code/node_modules/dep/index.js", "x".repeat(1000))
    write("code/.git/HEAD", "ref")
    const s = await links.statLink(path.join(root, "code"), LINUX)
    expect(s).toMatchObject({ isDir: true, fileCount: 2, size: 5 })
    expect(s?.truncated).toBeUndefined()
  })

  it("refuses relative and missing paths", async () => {
    expect(await links.statLink("a/b.txt", LINUX)).toBeNull()
    expect(await links.statLink(path.join(root, "nope"), LINUX)).toBeNull()
  })
})

describe("walkDir", () => {
  it("stops at the cap and says so", async () => {
    for (let i = 0; i < 10; i++) write(`many/f${i}.txt`, "x")
    const w = await links.walkDir(path.join(root, "many"), { maxEntries: 4 })
    expect(w.truncated).toBe(true)
    expect(w.fileCount).toBe(4)
  })
})

describe("resolveLink", () => {
  it("keeps a path that still exists", async () => {
    const p = write("Report.pdf", "pdf")
    const s = (await links.statLink(p, LINUX))!
    const res = await links.resolveLink(s, LINUX)
    expect(res).toMatchObject({ status: "ok", how: "path" })
  })

  it("follows a file moved into a sibling folder by its file id", async () => {
    const p = write("projects/old/Report.pdf", "pdf bytes")
    const s = (await links.statLink(p, LINUX))!
    fs.mkdirSync(path.join(root, "projects/archive/2026"), { recursive: true })
    const moved = path.join(root, "projects/archive/2026/Report.pdf")
    fs.renameSync(p, moved)
    // A decoy with the same name and size but a different file.
    write("projects/decoy/Report.pdf", "pdf bytes")
    const res = await links.resolveLink(s, LINUX)
    expect(res.status).toBe("moved")
    expect(res.how).toBe("fileId")
    expect(res.link?.path).toBe(moved)
  })

  it("uses Spotlight candidates on macOS", async () => {
    const p = write("deep/a/b/c/Plan.key", "keynote")
    const s = (await links.statLink(p, LINUX))!
    const far = path.join(root, "elsewhere/Plan.key")
    fs.mkdirSync(path.dirname(far), { recursive: true })
    fs.renameSync(p, far)
    // The bookmark JXA would run osascript on darwin; leave it out.
    const res = await links.resolveLink({ ...s, bookmark: undefined }, { platform: "darwin", spotlight: async () => [far] })
    expect(res).toMatchObject({ status: "moved", how: "fileId" })
    expect(res.link?.path).toBe(far)
  })

  it("falls back to one same-name, same-size file when the id changed", async () => {
    const p = write("docs/Notes.txt", "hello")
    const s = (await links.statLink(p, LINUX))!
    fs.rmSync(p)
    write("docs/sub/Notes.txt", "hello")
    const res = await links.resolveLink({ ...s, fileId: "0:0" }, LINUX)
    expect(res).toMatchObject({ status: "moved", how: "name-size" })
  })

  it("reports missing when the file is gone", async () => {
    const p = write("gone.txt", "bye")
    const s = (await links.statLink(p, LINUX))!
    fs.rmSync(p)
    expect((await links.resolveLink(s, LINUX)).status).toBe("missing")
  })

  it("does not swap a folder for a file of the same name", async () => {
    const dir = path.join(root, "proj/Thing")
    fs.mkdirSync(dir, { recursive: true })
    const s = (await links.statLink(dir, LINUX))!
    fs.rmSync(dir, { recursive: true })
    write("proj/Thing", "")
    expect((await links.resolveLink(s, LINUX)).status).toBe("missing")
  })
})

describe("extractLinkText", () => {
  it("reads the head of a text file", async () => {
    const p = write("a.md", "# Title\nbody")
    expect(await links.extractLinkText(p)).toBe("# Title\nbody")
  })

  it("lists a folder's files", async () => {
    write("repo/src/index.ts", "")
    write("repo/package.json", "{}")
    const text = await links.extractLinkText(path.join(root, "repo"))
    expect(text.split("\n")).toEqual(["package.json", "src/", "src/index.ts"])
  })

  it("parses a PDF from disk", async () => {
    const p = write("Manual.pdf", "%PDF-fake")
    const text = await links.extractLinkText(p, { pdfParse: async (b) => ({ text: `  ${b.length} bytes  ` }) })
    expect(text).toBe("9 bytes")
  })

  it("returns nothing for binaries", async () => {
    expect(await links.extractLinkText(write("art.psd", "8BPS"))).toBe("")
  })
})

describe("guards", () => {
  it("follows a symlink and refuses one whose target is a program", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-open-"))
    const doc = path.join(dir, "note.txt")
    const program = path.join(dir, "run.command")
    const link = path.join(dir, "alias.txt")
    fs.writeFileSync(doc, "hello")
    fs.writeFileSync(program, "#!/bin/sh\n")
    fs.symlinkSync(doc, link)
    expect((await links.pathForOpen(link)).path).toBe(fs.realpathSync(doc))
    fs.unlinkSync(link)
    fs.symlinkSync(program, link)
    expect((await links.pathForOpen(link)).error).toMatch(/does not open programs/)
    expect((await links.pathForOpen(path.join(dir, "missing.txt"))).error).toMatch(/not at that path/)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("treats programs as not openable", () => {
    expect(links.isExecutablePath("/Applications/Calculator.app")).toBe(true)
    expect(links.isExecutablePath("/Applications/Calculator.app/")).toBe(true)
    expect(links.isExecutablePath("/Users/me/run.command")).toBe(true)
    expect(links.isExecutablePath("/Users/me/Big.psd")).toBe(false)
    expect(links.isExecutablePath("/Users/me/code")).toBe(false)
  })

  it("serves only preview tokens it issued", () => {
    const reg = links.createPreviewRegistry()
    const url = reg.urlFor("/Users/me/Big File.pdf")
    expect(url).toMatch(/^brain2-link:\/\/f\/[a-z0-9]+\/Big%20File\.pdf$/)
    expect(reg.urlFor("/Users/me/Big File.pdf")).toBe(url)
    expect(reg.pathFor(url)).toBe("/Users/me/Big File.pdf")
    expect(reg.pathFor("brain2-link://f/forged/etc-passwd")).toBe("")
    expect(reg.urlFor("relative.pdf")).toBe("")
  })
})
