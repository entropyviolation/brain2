import { describe, expect, it } from "vitest"
import { linkKind, linkKindLabel, looksLikeLink, parseLinkMessage } from "./saved-links"

describe("parseLinkMessage", () => {
  it("splits a bare domain from its note", () => {
    expect(parseLinkMessage("wikipedia.com good for research")).toEqual({
      link: { url: "https://wikipedia.com", kind: "wikipedia" },
      note: "good for research",
    })
  })

  it("keeps a full URL and has no note when the link is alone", () => {
    const parsed = parseLinkMessage("https://www.instagram.com/reel/C1abc/?igsh=xyz")
    expect(parsed?.link.url).toBe("https://www.instagram.com/reel/C1abc/?igsh=xyz")
    expect(parsed?.note).toBe("")
    expect(linkKindLabel(parsed!.link)).toBe("Instagram reel")
  })

  it("drops a trailing comma off the link and keeps the note lines", () => {
    const parsed = parseLinkMessage("www.nytimes.com/article, read later\nfor the essay")
    expect(parsed?.link.url).toBe("https://www.nytimes.com/article")
    expect(parsed?.link.kind).toBe("article")
    expect(parsed?.note).toBe("read later\nfor the essay")
  })

  it("is null when the link is not the first word", () => {
    expect(parseLinkMessage("look at https://tiktok.com/@a/video/1")).toBeNull()
    expect(parseLinkMessage("log: left room")).toBeNull()
    expect(parseLinkMessage("st.louis trip")).toBeNull()
    expect(parseLinkMessage("e.g. this")).toBeNull()
    expect(parseLinkMessage("1.5 hours reading")).toBeNull()
  })
})

describe("linkKind", () => {
  it("names the common sources", () => {
    expect(linkKind("https://vm.tiktok.com/ZM123/")).toBe("tiktok")
    expect(linkKind("https://youtu.be/abc")).toBe("youtube")
    expect(linkKind("https://x.com/a/status/1")).toBe("x")
    expect(linkKind("https://old.reddit.com/r/a")).toBe("reddit")
    expect(linkKind("https://example.org/post")).toBe("article")
  })

  it("reads http, www, and known bare endings as links", () => {
    expect(looksLikeLink("http://localhost:3000")).toBe(true)
    expect(looksLikeLink("www.example.com")).toBe(true)
    expect(looksLikeLink("brain2.app/notes")).toBe(true)
    expect(looksLikeLink("notes.txt")).toBe(false)
  })
})
