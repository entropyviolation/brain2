import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import * as rules from "./sweep-rules"
import type { SweepCopyRef } from "./sweep-rules"

const require = createRequire(import.meta.url)
const js = require("../electron/sweep.js") as {
  sweepRules: Record<string, (...args: never[]) => unknown>
  SWEEP_CHANNELS: Record<string, string>
}

const home = "/Users/me"

function both(name: string, args: unknown[], expected?: unknown) {
  const tsFn = (rules as unknown as Record<string, (...a: unknown[]) => unknown>)[name]
  const jsFn = js.sweepRules[name]
  const tsValue = tsFn(...args)
  const jsValue = jsFn(...(args as never[]))
  expect(jsValue).toEqual(tsValue)
  if (expected !== undefined) expect(tsValue).toEqual(expected)
}

describe("sweep path rules", () => {
  it("keeps a real path inside its root and rejects a sibling prefix", () => {
    both("pathStaysInside", ["/a/b/c", "/a/b"], true)
    both("pathStaysInside", ["/a/b", "/a/b"], true)
    both("pathStaysInside", ["/a/bc", "/a/b"], false)
    both("pathStaysInside", ["/Users/me/Library", "/Library"], false)
    both("pathStaysInside", ["/Library/Preferences", "/Library"], true)
    both("pathStaysInside", ["", "/a"], false)
  })

  it("builds category roots under home", () => {
    both("underHome", ["/Users/me/", "Library", "Caches"], "/Users/me/Library/Caches")
    both("scanAllowRoot", [home, "caches"], "/Users/me/Library/Caches")
    both("scanAllowRoot", [home, "logs"], "/Users/me/Library/Logs")
    both("scanAllowRoot", [home, "xcode"], "/Users/me/Library/Developer/Xcode")
    both("scanAllowRoot", [home, "trash"], "/Users/me/.Trash")
    both("scanAllowRoot", [home, "preferences"], "/Users/me/Library/Preferences")
    both("defaultDuplicateRoots", [home], [
      "/Users/me/Desktop",
      "/Users/me/Documents",
      "/Users/me/Downloads",
      "/Users/me/Pictures",
      "/Users/me/Movies",
      "/Users/me/Music",
    ])
  })

  it("skips account, CloudKit, and HomeKit caches", () => {
    both("isCacheDenied", ["CloudKit"], true)
    both("isCacheDenied", ["com.apple.HomeKit"], true)
    both("isCacheDenied", ["com.apple.accountsd"], true)
    both("isCacheDenied", ["com.google.Chrome"], false)
  })

  it("checks regenerable groups and leaves crash reports, archives, and trash off", () => {
    both("scanGroupChecked", ["caches", "com.google.Chrome"], true)
    both("scanGroupChecked", ["caches", "CloudKit"], false)
    both("scanGroupChecked", ["logs", "CrashReporter"], true)
    both("scanGroupChecked", ["logs", "DiagnosticReports"], false)
    both("scanGroupChecked", ["xcode", "DerivedData"], true)
    both("scanGroupChecked", ["xcode", "Archives"], false)
    both("scanGroupChecked", ["xcode", "iOS DeviceSupport"], false)
    both("scanGroupChecked", ["trash", "old"], false)
    both("scanGroupChecked", ["preferences", "com.example.app.plist"], false)
  })

  it("treats com.apple and ByHost plists as not orphans", () => {
    const installed = new Set(["com.example.app"])
    both("preferenceSkipped", ["com.apple.finder.plist"], true)
    both("preferenceSkipped", ["ByHost"], true)
    both("preferenceSkipped", ["/Users/me/Library/Preferences/ByHost/com.example.plist"], true)
    both("plistBundleId", ["com.apple.finder.plist"], null)
    both("plistBundleId", ["com.example.app.plist"], "com.example.app")
    both("isOrphanPreference", ["com.example.app.plist", installed], false)
    both("isOrphanPreference", ["com.other.app.plist", installed], true)
    both("isOrphanPreference", ["notes.txt", installed], false)
    both("isOrphanPreference", ["com.apple.finder.plist", installed], false)
  })

  it("refuses system, mail, photos, backups, and the duplicate folders during a scan", () => {
    both("isLanguagePackPath", ["/Applications/Foo.app/Contents/Resources/en.lproj"], true)
    both("isLanguagePackPath", ["/Users/me/Library/Caches/Foo"], false)
    both("isForbiddenScanPath", ["/System/Library", home], true)
    both("isForbiddenScanPath", ["/usr/bin/swift", home], true)
    both("isForbiddenScanPath", ["/Library/Preferences", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/Caches/Foo", home], false)
    both("isForbiddenScanPath", ["/Users/me/Library/Logs/DiagnosticReports", home], false)
    both("isForbiddenScanPath", ["/Users/me/Documents/a", home], true)
    both("isForbiddenScanPath", ["/Users/me/Desktop/a", home], true)
    both("isForbiddenScanPath", ["/Users/me/Downloads/a", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/Mail/box", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/Photos/library", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/Containers/com.apple.mail/Data", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/Application Support/MobileSync/Backup/x", home], true)
    both("isForbiddenScanPath", ["/Users/me/Library/LaunchAgents/x.plist", home], true)
    both("isForbiddenScanPath", ["/Users/me/Pictures/Photos Library.photoslibrary/originals", home], true)
    both("isForbiddenScanPath", ["/Volumes/Data/Docs/a", home, ["/Volumes/Data/Docs"]], true)
  })

  it("allows a cache child and DerivedData, and refuses the category root", () => {
    const caches = "/Users/me/Library/Caches"
    const xcode = "/Users/me/Library/Developer/Xcode"
    both("cleanPathAllowed", ["/Users/me/Library/Caches/Chrome", caches, home, "caches"], true)
    both("cleanPathAllowed", [caches, caches, home, "caches"], false)
    both("cleanPathAllowed", ["/Users/me/Library/Caches/CloudKit", caches, home, "caches"], false)
    both("cleanPathAllowed", ["/Users/me/Documents/a", caches, home, "caches"], false)
    both("cleanPathAllowed", [`${xcode}/DerivedData`, xcode, home, "xcode"], true)
    both("cleanPathAllowed", ["/Users/me/Library/Preferences/com.example.app.plist", "/Users/me/Library/Preferences", home, "preferences"], true)
    both("cleanPathAllowed", ["/Users/me/Library/Preferences/com.apple.finder.plist", "/Users/me/Library/Preferences", home, "preferences"], false)
    both("isDeletableSweepPath", [home, caches, home], false)
    both("isDeletableSweepPath", ["/", caches, home], false)
  })

  it("allows personal folders and skips Library, Trash, git, and node_modules", () => {
    both("duplicateDirSkipped", ["node_modules"], true)
    both("duplicateDirSkipped", ["Library"], true)
    both("duplicateDirSkipped", [".Trash"], true)
    both("duplicateDirSkipped", [".git"], true)
    both("duplicateDirSkipped", ["libraries"], false)
    both("duplicateRootAllowed", ["/Users/me/Desktop", home], true)
    both("duplicateRootAllowed", ["/Users/me/Documents", home], true)
    both("duplicateRootAllowed", ["/Users/me/Library", home], false)
    both("duplicateRootAllowed", ["/Users/me/Library/Caches", home], false)
    both("duplicateRootAllowed", ["/Users/me/.Trash", home], false)
    both("duplicateRootAllowed", ["/System", home], false)
    both("duplicateRootAllowed", ["/Users/me/Documents/node_modules", home], false)
    both("duplicateCleanAllowed", ["/Users/me/Documents/a.txt", "/Users/me/Documents", home], true)
    both("duplicateCleanAllowed", ["/Users/me/Documents", "/Users/me/Documents", home], false)
    both("duplicateCleanAllowed", ["/Users/me/Library/Mail/a", "/Users/me/Documents", home], false)
    both("duplicateCleanAllowed", ["/Users/me/Desktop/a", "/Users/me/Library", home], false)
  })

  it("keeps the oldest copy unless a newer one is the only copy outside Downloads", () => {
    const copies = (rows: [string, number][]): SweepCopyRef[] =>
      rows.map(([path, mtimeMs]) => ({ path, size: 10, mtimeMs }))
    both("chooseKeptPath", [copies([["/Users/me/Documents/old", 1], ["/Users/me/Documents/new", 5]])], "/Users/me/Documents/old")
    both("chooseKeptPath", [copies([["/Users/me/Downloads/old", 1], ["/Users/me/Documents/new", 5]])], "/Users/me/Documents/new")
    both("chooseKeptPath", [copies([["/Users/me/Documents/old", 1], ["/Users/me/Downloads/new", 5]])], "/Users/me/Documents/old")
    both(
      "chooseKeptPath",
      [copies([["/Users/me/Downloads/a", 1], ["/Users/me/Downloads/b", 4], ["/Users/me/Desktop/c", 3]])],
      "/Users/me/Desktop/c",
    )
    both(
      "chooseKeptPath",
      [copies([["/Users/me/Desktop/a", 2], ["/Users/me/Documents/b", 3], ["/Users/me/Downloads/c", 1]])],
      "/Users/me/Downloads/c",
    )
    both("chooseKeptPath", [copies([["/Users/me/Desktop/b", 2], ["/Users/me/Documents/a", 2]])], "/Users/me/Desktop/b")
    both("chooseKeptPath", [[]], "")
  })

  it("never returns every copy of a hash", () => {
    const copies: SweepCopyRef[] = [
      { path: "/Users/me/Downloads/a", size: 4, mtimeMs: 1 },
      { path: "/Users/me/Documents/b", size: 4, mtimeMs: 9 },
      { path: "/Users/me/Desktop/c", size: 4, mtimeMs: 3 },
    ]
    const keep = "/Users/me/Downloads/a"
    both("chooseKeptPath", [copies], keep)
    both("removableDuplicatePaths", [copies, copies.map((c) => c.path)], ["/Users/me/Documents/b", "/Users/me/Desktop/c"])
    both("removableDuplicatePaths", [copies, [keep]], [])
    both("removableDuplicatePaths", [copies, ["/tmp/nope"]], [])
    both("removableDuplicatePaths", [copies.slice(0, 1), [copies[0].path]], [])
  })

  it("hashes only sizes that occur more than once and drops unknown clean paths", () => {
    both("sizesWorthHashing", [[{ size: 0 }, { size: 5 }, { size: 5 }, { size: 9 }]], [{ size: 5 }, { size: 5 }])
    const known = new Set(["/tmp/a", "/tmp/b"])
    both("pathsFromLastResult", [["/tmp/a", "/tmp/missing", "/tmp/a", "relative"], known], ["/tmp/a"])
    both("isSweepPath", ["/tmp/a"], true)
    both("isSweepPath", ["relative"], false)
    both("isSweepPath", ["/tmp/a\0b"], false)
  })

  it("names a preview from the extension and formats sizes", () => {
    both("previewKindForPath", ["/a/b/c.PNG"], "image")
    both("previewKindForPath", ["/a/b/c.mp4"], "video")
    both("previewKindForPath", ["/a/b/c.mp3"], "audio")
    both("previewKindForPath", ["/a/b/c.md"], "text")
    both("previewKindForPath", ["/a/b/c.pdf"], "file")
    both("previewKindForPath", ["/a/b/c"], "file")
    both("formatSweepBytes", [0], "0 B")
    both("formatSweepBytes", [500], "500 B")
    both("formatSweepBytes", [1024], "1 KB")
    both("formatSweepBytes", [1536], "1.5 KB")
    both("formatSweepBytes", [10 * 1024], "10 KB")
    both("formatSweepBytes", [1024 * 1024], "1 MB")
    expect(rules.SWEEP_TEXT_HEAD_CHARS).toBe(js.sweepRules.SWEEP_TEXT_HEAD_CHARS)
  })
})

describe("sweep ipc names", () => {
  it("uses the same channel strings in the main process and the preload", () => {
    const preload = readFileSync(join(process.cwd(), "electron/preload.js"), "utf8")
    const main = readFileSync(join(process.cwd(), "electron/main.js"), "utf8")
    for (const channel of Object.values(js.SWEEP_CHANNELS)) {
      expect(channel.startsWith("cogs:sweep:")).toBe(true)
      expect(preload).toContain(channel)
    }
    expect(main).toContain("registerSweepIpc")
    expect(preload).toContain("sweep:")
  })
})
