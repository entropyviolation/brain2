import { describe, expect, it } from "vitest"
import {
  displayPath,
  isLinkedResource,
  LINK_SUGGEST_BYTES,
  linkedResource,
  mimeForPath,
  relinkResource,
  resolutionMoved,
  resourceBytesSplit,
  shouldLink,
  type LinkStat,
} from "@/lib/resource-links"
import { resourceKind, resourcesText, webLinkResource } from "@/lib/item-resources"
import type { ItemResource } from "@/lib/types"

const psd: LinkStat = {
  path: "/Users/me/Design/Big.psd",
  name: "Big.psd",
  isDir: false,
  size: 2_000_000_000,
  fileId: "16777220:123",
  bookmark: "Ym9vaw==",
}

describe("shouldLink", () => {
  it("links folders in every mode", () => {
    expect(shouldLink("copy", { isDir: true, size: 0 })).toBe(true)
  })
  it("auto links big files and copies small ones", () => {
    expect(shouldLink("auto", { isDir: false, size: LINK_SUGGEST_BYTES })).toBe(true)
    expect(shouldLink("auto", { isDir: false, size: LINK_SUGGEST_BYTES - 1 })).toBe(false)
    expect(shouldLink("link", { isDir: false, size: 1 })).toBe(true)
    expect(shouldLink("copy", { isDir: false, size: 1e10 })).toBe(false)
  })
})

describe("linkedResource", () => {
  it("keeps the path, not bytes", () => {
    const r = linkedResource(psd, new Date("2026-10-16T12:00:00Z"))
    expect(r.uri).toMatch(/^link:link_/)
    expect(r.link).toEqual({ path: psd.path, isDir: false, fileId: psd.fileId, bookmark: psd.bookmark })
    expect(r.size).toBe(psd.size)
    expect(r.addedAt).toBe("2026-10-16T12:00:00.000Z")
    expect(isLinkedResource(r)).toBe(true)
  })

  it("marks a folder as a folder", () => {
    const r = linkedResource({ path: "/Users/me/code/app", name: "app", isDir: true, size: 900, fileCount: 12, truncated: true })
    expect(r.mime).toBe("inode/directory")
    expect(resourceKind(r)).toBe("folder")
    expect(r.link).toMatchObject({ isDir: true, fileCount: 12, truncated: true })
  })
})

describe("relinkResource", () => {
  it("follows a rename and keeps caption, id, and text", () => {
    const r: ItemResource = { ...linkedResource(psd), caption: "Hero art", useNote: "print this", extractedText: "layers" }
    const moved = relinkResource(r, { ...psd, path: "/Users/me/Archive/Hero.psd", name: "Hero.psd", bookmark: undefined })
    expect(moved).toMatchObject({ id: r.id, caption: "Hero art", useNote: "print this", extractedText: "layers", name: "Hero.psd" })
    expect(moved.link?.path).toBe("/Users/me/Archive/Hero.psd")
    expect(moved.link?.bookmark).toBe(psd.bookmark)
    expect(resolutionMoved(r, { status: "moved", link: { ...psd, path: "/x/Hero.psd" } })).toBe(true)
    expect(resolutionMoved(r, { status: "ok", link: psd })).toBe(false)
  })
})

describe("helpers", () => {
  it("splits stored and linked bytes", () => {
    const stored: ItemResource = { id: "a", name: "a.txt", mime: "text/plain", uri: "idb:a", size: 10, addedAt: "" }
    expect(resourceBytesSplit([stored, linkedResource(psd)])).toEqual({ stored: 10, linked: psd.size })
    expect(isLinkedResource(stored)).toBe(false)
  })

  it("guesses mime from the extension", () => {
    expect(mimeForPath("Manual.PDF")).toBe("application/pdf")
    expect(mimeForPath("clip.mov")).toBe("video/quicktime")
    expect(mimeForPath("art.psd")).toBe("application/octet-stream")
  })

  it("shortens home paths", () => {
    expect(displayPath("/Users/me/Design/Big.psd")).toBe("~/Design/Big.psd")
    expect(displayPath("/Volumes/Work/x")).toBe("/Volumes/Work/x")
  })

  it("is searchable by name, caption, and extracted text", () => {
    const r = { ...linkedResource(psd), caption: "hero", extractedText: "src/index.ts" }
    expect(resourcesText([r])).toBe("Big.psd hero src/index.ts")
  })

  it("keeps a web link and its use note searchable", () => {
    const link = webLinkResource("https://example.com/spec", new Date("2026-10-27T00:00:00Z"))
    expect(link).toMatchObject({ name: "example.com/spec", url: "https://example.com/spec" })
    expect(link?.uri).toMatch(/^url:/)
    expect(resourceKind(link!)).toBe("link")
    expect(webLinkResource("not a link")).toBeNull()
    expect(resourcesText([{ ...link!, useNote: "the spec" }])).toBe("example.com/spec the spec https://example.com/spec")
  })
})
