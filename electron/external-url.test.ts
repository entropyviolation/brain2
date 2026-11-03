import { describe, expect, it } from "vitest"
import { isAppNavigationUrl, isBlankPopup, isHttpUrl, openExternalWeb } from "./external-url.js"

describe("desktop navigation urls", () => {
  it("keeps dev on port 3000 and packaged builds on app://local", () => {
    expect(isAppNavigationUrl("http://localhost:3000/lists", { isDev: true })).toBe(true)
    expect(isAppNavigationUrl("http://127.0.0.1:3000/popout/?view=texts", { isDev: true })).toBe(true)
    expect(isAppNavigationUrl("https://example.com", { isDev: true })).toBe(false)
    expect(isAppNavigationUrl("file:///etc/passwd", { isDev: true })).toBe(false)
    expect(isAppNavigationUrl("app://local/popout/", { isDev: false })).toBe(true)
    expect(isAppNavigationUrl("http://localhost:3000/", { isDev: false })).toBe(false)
    expect(isAppNavigationUrl("app://other/", { isDev: false })).toBe(false)
  })

  it("opens only http(s) externally", () => {
    const opened: string[] = []
    const shell = { openExternal: (url: string) => opened.push(url) }
    expect(openExternalWeb(shell, "https://example.com/a")).toBe(true)
    expect(openExternalWeb(shell, "file:///etc/passwd")).toBe(false)
    expect(openExternalWeb(shell, "javascript:alert(1)")).toBe(false)
    expect(opened).toEqual(["https://example.com/a"])
    expect(isHttpUrl("HTTP://example.com")).toBe(true)
    expect(isBlankPopup("")).toBe(true)
    expect(isBlankPopup("about:blank")).toBe(true)
    expect(isBlankPopup("https://example.com")).toBe(false)
  })
})
