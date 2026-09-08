/**
 * lib/doc-persist.test.ts — IndexedDB / memory document store
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  clearAllPersistedDocs,
  getPersistedDoc,
  listPersistedDocs,
  previewDocBody,
  putPersistedDoc,
  replaceAllPersistedDocs,
} from "@/lib/doc-persist"

describe("doc-persist", () => {
  beforeEach(async () => {
    await clearAllPersistedDocs()
  })

  it("round-trips a document through the store", async () => {
    await putPersistedDoc({
      id: "doc_1",
      title: "Plan",
      folder: "Work",
      fontFamily: "Merriweather",
      status: "draft",
      body: "<h1>Hello</h1><p>World</p>",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
    const rec = await getPersistedDoc("doc_1")
    expect(rec?.title).toBe("Plan")
    expect(rec?.body).toContain("Hello")
    const listed = await listPersistedDocs()
    expect(listed.map((d) => d.id)).toContain("doc_1")
  })

  it("strips data-URL images from the task-store preview", () => {
    const html = '<p>Hi</p><img src="data:image/png;base64,abcabcabc" alt="x" />'
    const preview = previewDocBody(html)
    expect(preview).not.toContain("data:image")
    expect(preview).toContain("data-doc-img")
  })

  it("replaceAll swaps the full set", async () => {
    await putPersistedDoc({
      id: "old",
      title: "Old",
      folder: "",
      fontFamily: "Arial",
      status: "draft",
      body: "<p>old</p>",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    await replaceAllPersistedDocs([
      {
        id: "new",
        title: "New",
        folder: "",
        fontFamily: "Arial",
        status: "draft",
        body: "<p>new</p>",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ])
    expect(await getPersistedDoc("old")).toBeNull()
    expect((await getPersistedDoc("new"))?.body).toContain("new")
  })
})
