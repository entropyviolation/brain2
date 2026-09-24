import { describe, expect, it } from "vitest"
import {
  SCREENTIME_CATEGORY_IDS,
  appPenId,
  categoryForApp,
  domainFromUrl,
  domainPenId,
  isBrowserApp,
  slugApp,
} from "./app-categories"

describe("app slugs and pen ids", () => {
  it("slugs to lowercase hyphenated tokens and falls back to app", () => {
    expect(slugApp("Google Chrome")).toBe("google-chrome")
    expect(slugApp("github.com")).toBe("github-com")
    expect(slugApp("!!!")).toBe("app")
    expect(slugApp("")).toBe("app")
  })

  it("builds stable app and domain pen ids", () => {
    expect(appPenId("chrome")).toBe("st-app-chrome")
    expect(domainPenId("chrome", "github-com")).toBe("st-app-chrome-github-com")
  })
})

describe("categoryForApp", () => {
  it("matches the seeded category ids", () => {
    expect(SCREENTIME_CATEGORY_IDS.work).toBe("st-cat-work")
    expect(SCREENTIME_CATEGORY_IDS.browsing).toBe("st-cat-browsing")
    expect(categoryForApp("Cursor")).toEqual({ id: "st-cat-work", name: "Work" })
    expect(categoryForApp("Slack")).toEqual({ id: "st-cat-communication", name: "Communication" })
    expect(categoryForApp("Google Chrome")).toEqual({ id: "st-cat-browsing", name: "Browsing" })
    expect(categoryForApp("Spotify")).toEqual({ id: "st-cat-media", name: "Media" })
    expect(categoryForApp("Finder")).toEqual({ id: "st-cat-system", name: "System" })
    expect(categoryForApp("TextEdit")).toEqual({ id: "st-cat-other", name: "Other" })
    expect(categoryForApp("Preview")).toEqual({ id: "st-cat-other", name: "Other" })
    expect(categoryForApp("Mystery.app")).toEqual({ id: "st-cat-other", name: "Other" })
  })

  it("does not treat Archive Utility as Arc or Barcode as Code", () => {
    expect(isBrowserApp("Archive Utility")).toBe(false)
    expect(categoryForApp("Barcode Scanner").id).toBe("st-cat-other")
    expect(isBrowserApp("Chrome")).toBe(true)
    expect(isBrowserApp("Safari")).toBe(true)
  })
})

describe("domainFromUrl", () => {
  it("returns the hostname without www", () => {
    expect(domainFromUrl("https://www.github.com/foo")).toBe("github.com")
    expect(domainFromUrl("github.com/foo")).toBe("github.com")
    expect(domainFromUrl("not a url")).toBe(null)
    expect(domainFromUrl("")).toBe(null)
  })
})
