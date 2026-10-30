import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  bookLookupBusy,
  bookLookupKey,
  bookLookupMissed,
  clearBookLookupSession,
  fetchShelfBookCovers,
  lookupBook,
  parsePhysicalDimensions,
} from "@/lib/book-lookup"
import type { Task } from "@/lib/types"

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 404, json: async () => body, blob: async () => new Blob() }
}

describe("book lookup", () => {
  beforeEach(() => {
    clearBookLookupSession()
    vi.unstubAllGlobals()
  })

  it("parses centimeters and inches", () => {
    expect(parsePhysicalDimensions("23 cm")).toEqual({ heightCm: 23, widthCm: null, thicknessCm: null })
    expect(parsePhysicalDimensions("8.5 inches").heightCm).toBe(21.59)
    expect(parsePhysicalDimensions("8.5 x 5.5 x 1 inches")).toEqual({
      heightCm: 21.59,
      widthCm: 13.97,
      thicknessCm: 2.54,
    })
  })

  it("returns a cover url and dimensions for an ISBN", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/isbn/9780156027601")
      return json({
        physical_dimensions: "8.5 x 5.5 x 1 inches",
        covers: [8260624],
        number_of_pages: 204,
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await lookupBook({ isbn: "978-0-15-602760-1", title: "Solaris" })
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.coverUrl).toBe("https://covers.openlibrary.org/b/id/8260624-L.jpg")
    expect(result.heightCm).toBe(21.59)
    expect(result.widthCm).toBe(13.97)
    expect(result.thicknessCm).toBe(2.54)
    expect(result.pageCount).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to title and author when there is no ISBN", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes("search.json")) {
        return json({
          docs: [
            {
              title: "Solaris",
              author_name: ["Stanisław Lem"],
              isbn: ["9780156027601"],
              cover_i: 12313764,
              number_of_pages_median: 229,
            },
          ],
        })
      }
      if (href.includes("/isbn/")) return json({ physical_dimensions: "23 cm", number_of_pages: 204 })
      throw new Error(href)
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await lookupBook({ title: "Solaris", author: "Stanisław Lem" })
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.coverUrl).toBe("https://covers.openlibrary.org/b/id/12313764-L.jpg")
    expect(result.isbn).toBe("9780156027601")
    expect(result.author).toBe("Stanisław Lem")
    expect(result.heightCm).toBe(23)
    expect(String(fetchMock.mock.calls[0][0])).toContain("title=Solaris")
    expect(String(fetchMock.mock.calls[0][0])).toContain("author=")
  })

  it("remembers a miss for the session", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes("search.json")) return json({ docs: [] })
      if (href.includes("googleapis.com")) return json({ items: [] })
      return json({}, false)
    })
    vi.stubGlobal("fetch", fetchMock)
    const query = { title: "Not A Real Book Zzz", author: "Nobody" }
    const first = await lookupBook(query)
    expect(first.found).toBe(false)
    expect(bookLookupMissed(bookLookupKey(query))).toBe(true)
    const calls = fetchMock.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    const second = await lookupBook(query)
    expect(second.found).toBe(false)
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it("skips a missing cover id and keeps the next one", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        covers: [-1, 8260624],
        number_of_pages: 204,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const result = await lookupBook({ isbn: "9780156027601", title: "Solaris" })
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.coverUrl).toBe("https://covers.openlibrary.org/b/id/8260624-L.jpg")
  })

  it("saves an Open Library cover when the Google image cannot be read", async () => {
    const jpeg = new Uint8Array(420)
    jpeg[0] = 0xff
    jpeg[1] = 0xd8
    jpeg[2] = 0xff
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes("search.json")) {
        return json({
          docs: [{ title: "Curious", isbn: ["9780465079964"], cover_i: -1 }],
        })
      }
      if (href.includes("googleapis.com")) {
        return json({
          items: [{ volumeInfo: { imageLinks: { thumbnail: "https://books.google.com/books/content?id=abc&printsec=frontcover" } } }],
        })
      }
      if (href.includes("covers.openlibrary.org")) {
        const blob = new Blob([jpeg], { type: "image/jpeg" })
        return { ok: true, status: 200, blob: async () => blob }
      }
      if (href.includes("/isbn/")) return json({ number_of_pages: 216 })
      if (href.includes("books.google.com")) return new Response("no", { status: 403, headers: { "content-type": "text/html" } })
      return json({}, false)
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("indexedDB", undefined)
    const task = { id: "curious", title: "Curious", description: "Curious", type: "task", attributes: {} } as Task
    let saved: Task | null = null
    const report = await fetchShelfBookCovers([task], (next) => {
      saved = next
    })
    expect(report.covers).toBe(1)
    expect(report.found).toBe(1)
    expect(saved?.attributes?.cover).toEqual(expect.stringMatching(/^idb:/))
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((href) => href.includes("covers.openlibrary.org/b/isbn/9780465079964"))).toBe(true)
  })

  it("matches a volume title by the author's last name", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes("search.json")) {
        if (href.includes("title=Cosmic+Trigger&") || href.includes("title=Cosmic+Trigger&author")) {
          return json({
            docs: [{ title: "Cosmic Trigger", author_name: ["Robert Anton Wilson"], cover_i: 9248658, isbn: ["0941404463"] }],
          })
        }
        return json({ docs: [] })
      }
      if (href.includes("googleapis.com")) return json({ items: [] })
      if (href.includes("/isbn/")) return json({})
      return json({}, false)
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await lookupBook({ title: "Cosmic Trigger I", author: "Robert Anton Wilson" })
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.coverUrl).toBe("https://covers.openlibrary.org/b/id/9248658-L.jpg")
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.some((href) => href.includes("title=Cosmic+Trigger&") && href.includes("author=Wilson"))).toBe(true)
    expect(urls.some((href) => href.includes("Trigger+I"))).toBe(false)
  })

  it("does not start a second fetch while one is running", async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate
        return json({ docs: [] })
      }),
    )
    const task = { id: "sol", title: "Solaris", description: "Solaris" } as Task
    const first = fetchShelfBookCovers([task], () => {})
    expect(bookLookupBusy()).toBe(true)
    const second = await fetchShelfBookCovers([task], () => {})
    expect(second.busy).toBe(true)
    expect(second.covers).toBe(0)
    expect(second.skipped).toBe(1)
    release()
    await first
    expect(bookLookupBusy()).toBe(false)
  })

})
