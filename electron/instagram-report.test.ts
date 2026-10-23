import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type RunResult = { code: number; stdout: string; stderr: string }
type Run = (cmd: string, args: string[], opts?: { cwd?: string; env?: Record<string, string> }) => Promise<RunResult>
type Candidate = { key: string; account: string; date: string; id: string; kind: string; paths: string[]; size: number; mtimeMs: number }
type Ig = {
  parseExportName: (n: string) => { key: string; account: string; date: string; id: string; zip: boolean } | null
  scanForExports: (dirs: string[]) => Candidate[]
  pickExportToImport: (c: Candidate[], state: Record<string, unknown>, config: Record<string, unknown>) => Candidate | null
  createStabilityTracker: (now: () => number) => { isStable: (c: Candidate) => boolean }
  ingestExport: (c: Candidate, o: { root: string; config: Record<string, unknown>; run: Run; now?: () => number; env?: Record<string, string> }) => Promise<{ ok: boolean; step?: string; buildId?: string }>
  loadConfig: (root: string, o?: { home?: string }) => Record<string, string>
  loadState: (root: string) => {
    current: { buildId: string; exportDate: string; exportDir: string } | null
    previous: { buildId: string } | null
    lastError: { step: string; message: string } | null
    imported: Record<string, { ok: boolean }>
  }
  loadUiState: (root: string, config: Record<string, string>) => Record<string, string>
  saveUiState: (root: string, config: Record<string, string>, patch: Record<string, string | null>) => Record<string, string>
  resolveReportPath: (root: string, state: unknown, url: string) => string | null
  injectBridge: (html: string, ui: Record<string, string>) => string
  publicStatus: (root: string) => { hasReport: boolean; current: { exportDate: string } | null }
  STABLE_MS: number
}
const ig = nodeRequire("./instagram-report.js") as Ig

let tmp: string
let home: string
let root: string
let downloads: string
let config: Record<string, string>

function hasPython(): boolean {
  try {
    execFileSync("python3", ["-c", "1"])
    return true
  } catch {
    return false
  }
}

/** Fake analyze.py / build_report.py: write what the real ones write, into IG_OUT. */
function fakeRun(log: string[][], fail?: "analyze" | "build"): Run {
  return async (cmd, args, opts) => {
    log.push([cmd, ...args])
    if (args[1] === "-c") return { code: 0, stdout: "[]\n", stderr: "" }
    if (args[1] === "-m" && args[2] === "zipfile") {
      execFileSync("python3", ["-I", "-m", "zipfile", "-e", args[4], args[5]])
      return { code: 0, stdout: "", stderr: "" }
    }
    const out = opts?.env?.IG_OUT as string
    if (args[1].endsWith("analyze.py")) {
      if (fail === "analyze") return { code: 1, stdout: "", stderr: "Traceback: boom" }
      fs.mkdirSync(path.join(out, "thumbs"), { recursive: true })
      fs.writeFileSync(path.join(out, "thumbs", "1.jpg"), "jpg")
      fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ me: opts?.env?.IG_ME }))
      fs.symlinkSync(path.join(args[2], "media"), path.join(out, "media"))
      return { code: 0, stdout: "", stderr: "" }
    }
    if (args[1].endsWith("build_report.py")) {
      if (fail === "build") return { code: 1, stdout: "", stderr: "bad" }
      fs.writeFileSync(path.join(out, "report.html"), `<!doctype html><html><head><title>r</title></head><body>@${opts?.env?.IG_HANDLE}</body></html>`)
      return { code: 0, stdout: "", stderr: "" }
    }
    return { code: 1, stdout: "", stderr: "unknown" }
  }
}

function makeExportFolder(dir: string, name: string) {
  const d = path.join(dir, name)
  fs.mkdirSync(path.join(d, "your_instagram_activity"), { recursive: true })
  fs.mkdirSync(path.join(d, "media", "posts"), { recursive: true })
  fs.writeFileSync(path.join(d, "media", "posts", "a.jpg"), "photo")
  return d
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-ig-"))
  home = path.join(tmp, "home")
  downloads = path.join(home, "Downloads")
  root = path.join(tmp, "userData", "instagram")
  fs.mkdirSync(downloads, { recursive: true })
  fs.mkdirSync(path.join(home, "instagram-analysis"), { recursive: true })
  fs.writeFileSync(path.join(home, "instagram-analysis", "analyze.py"), "")
  fs.writeFileSync(path.join(home, "instagram-analysis", "build_report.py"), "")
  fs.mkdirSync(path.join(home, "texts-analysis", ".venv", "bin"), { recursive: true })
  fs.writeFileSync(path.join(home, "texts-analysis", ".venv", "bin", "python"), "")
  config = ig.loadConfig(root, { home })
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe("instagram export names", () => {
  it("reads account, date and id", () => {
    expect(ig.parseExportName("instagram-_entropyviolation_-2026-10-22-vn7ORB66")).toMatchObject({
      key: "instagram-_entropyviolation_-2026-10-22-vn7ORB66",
      account: "entropyviolation",
      date: "2026-10-22",
      id: "vn7ORB66",
      zip: false,
    })
    expect(ig.parseExportName("instagram-_entropyviolation_-2026-10-22-vn7ORB66.zip")?.zip).toBe(true)
    expect(ig.parseExportName("instagram-_entropyviolation_-2026-10-22-vn7ORB66-2.zip")?.key).toBe(
      "instagram-_entropyviolation_-2026-10-22-vn7ORB66",
    )
    expect(ig.parseExportName("matches.json")).toBeNull()
  })
})

describe("scan and pick", () => {
  it("skips partial downloads, other accounts and folders without data", () => {
    makeExportFolder(downloads, "instagram-_entropyviolation_-2026-10-22-vn7ORB66")
    makeExportFolder(downloads, "instagram-_someoneelse_-2026-10-23-abc")
    fs.mkdirSync(path.join(downloads, "instagram-_entropyviolation_-2026-10-24-empty"))
    fs.writeFileSync(path.join(downloads, "instagram-_entropyviolation_-2026-10-25-x.zip.crdownload"), "x")
    const c = ig.scanForExports([downloads])
    expect(c.map((x) => x.key)).toEqual([
      "instagram-_entropyviolation_-2026-10-22-vn7ORB66",
      "instagram-_someoneelse_-2026-10-23-abc",
    ])
    const pick = ig.pickExportToImport(c, ig.loadState(root), config)
    expect(pick?.key).toBe("instagram-_entropyviolation_-2026-10-22-vn7ORB66")
  })

  it("waits until a zip holds still", () => {
    let t = 0
    const tracker = ig.createStabilityTracker(() => t)
    const c = { key: "k", account: "a", date: "2026-01-01", id: "i", kind: "zip", paths: ["z"], size: 10, mtimeMs: 1 }
    expect(tracker.isStable(c)).toBe(false)
    t = ig.STABLE_MS - 1
    expect(tracker.isStable(c)).toBe(false)
    t = ig.STABLE_MS
    expect(tracker.isStable(c)).toBe(true)
    expect(tracker.isStable({ ...c, size: 11 })).toBe(false)
  })
})

describe("ingest", () => {
  it.skipIf(!hasPython())("unzips into Brain2's folder, builds, and swaps the report", async () => {
    const src = makeExportFolder(tmp, "instagram-_entropyviolation_-2026-10-22-vn7ORB66")
    const zip = path.join(downloads, "instagram-_entropyviolation_-2026-10-22-vn7ORB66.zip")
    execFileSync("python3", ["-I", "-m", "zipfile", "-c", zip, path.join(src, "your_instagram_activity"), path.join(src, "media")])
    const log: string[][] = []
    const [c] = ig.scanForExports([downloads])
    const r = await ig.ingestExport(c, { root, config, run: fakeRun(log), env: { PATH: "/usr/bin" } })
    expect(r.ok).toBe(true)
    const state = ig.loadState(root)
    expect(state.current?.exportDate).toBe("2026-10-22")
    expect(state.current?.exportDir).toBe("2026-10-22-vn7ORB66")
    // The copy lives under Brain2's folder, not Downloads.
    const media = ig.resolveReportPath(root, state, "media/posts/a.jpg")
    expect(media && media.startsWith(fs.realpathSync(root))).toBe(true)
    expect(ig.resolveReportPath(root, state, "../state.json")).toBeNull()
    expect(ig.resolveReportPath(root, state, "thumbs/1.jpg")).toBeTruthy()
    expect(fs.readFileSync(ig.resolveReportPath(root, state, "report.html")!, "utf8")).toMatch("@entropyviolation")
    const analyze = log.find((l) => l[2]?.endsWith("analyze.py"))
    expect(analyze?.[1]).toBe("-I")
    expect(ig.publicStatus(root).hasReport).toBe(true)
    // Same file again: nothing to do.
    expect(ig.pickExportToImport(ig.scanForExports([downloads]), ig.loadState(root), config)).toBeNull()
  })

  it("keeps the previous report when a run fails", async () => {
    makeExportFolder(downloads, "instagram-_entropyviolation_-2026-10-22-vn7ORB66")
    const first = ig.scanForExports([downloads])[0]
    expect((await ig.ingestExport(first, { root, config, run: fakeRun([]) })).ok).toBe(true)
    const good = ig.loadState(root).current

    makeExportFolder(downloads, "instagram-_entropyviolation_-2026-11-30-newer")
    const next = ig.pickExportToImport(ig.scanForExports([downloads]), ig.loadState(root), config)!
    expect(next.date).toBe("2026-11-30")
    const r = await ig.ingestExport(next, { root, config, run: fakeRun([], "analyze"), now: () => Date.now() + 1000 })
    expect(r).toMatchObject({ ok: false, step: "analyze" })
    const after = ig.loadState(root)
    expect(after.current).toEqual(good)
    expect(after.lastError?.step).toBe("analyze")
    expect(ig.resolveReportPath(root, after, "report.html")).toBeTruthy()
    expect(ig.resolveReportPath(root, after, "media/posts/a.jpg")).toBeTruthy()
    // A failed export is not retried until it changes.
    expect(ig.pickExportToImport(ig.scanForExports([downloads]), after, config)).toBeNull()
  })

  it("reports missing Python packages without touching the report", async () => {
    makeExportFolder(downloads, "instagram-_entropyviolation_-2026-10-22-vn7ORB66")
    const c = ig.scanForExports([downloads])[0]
    const run: Run = async (_cmd, args) =>
      args[1] === "-c" ? { code: 0, stdout: '["sklearn"]\n', stderr: "" } : { code: 1, stdout: "", stderr: "" }
    const r = await ig.ingestExport(c, { root, config, run })
    expect(r.ok).toBe(false)
    expect(ig.loadState(root).lastError?.message).toMatch(/scikit-learn/)
    expect(ig.loadState(root).current).toBeNull()
  })
})

describe("report state across origins", () => {
  it("writes manual matches to matches.json and seeds them back", () => {
    fs.writeFileSync(config.matchesPath, JSON.stringify({ "inbox/a_1": "alice" }))
    expect(JSON.parse(ig.loadUiState(root, config)["ig-matches"])).toEqual({ "inbox/a_1": "alice" })
    ig.saveUiState(root, config, { "ig-matches": JSON.stringify({ "inbox/a_1": "alice", "inbox/b_2": "bob", "inbox/c": "" }) })
    expect(JSON.parse(fs.readFileSync(config.matchesPath, "utf8"))).toEqual({ "inbox/a_1": "alice", "inbox/b_2": "bob" })
    ig.saveUiState(root, config, { "ig-hide-cols": '["dm"]', "not-ours": "x" } as Record<string, string>)
    expect(ig.loadUiState(root, config)).toEqual({
      "ig-matches": JSON.stringify({ "inbox/a_1": "alice", "inbox/b_2": "bob", "inbox/c": "" }),
      "ig-hide-cols": '["dm"]',
    })
  })

  it("injects the seed script before the report's own script", () => {
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><script>REPORT</script></head></html>'
    const out = ig.injectBridge(html, { "ig-photos": "true", "ig-matches": '{"x":"</script>"}' })
    expect(out.indexOf("brain2")).toBeLessThan(out.indexOf("REPORT"))
    expect(out.startsWith('<!doctype html><html lang="en"><head><script>')).toBe(true)
    expect(out).not.toMatch(/"<\/script>"/)
    expect(out).toContain("open-account")
    expect(out.replace(/<script>\/\* brain2 \*\/.*?<\/script>/, "")).toBe(html)
  })
})

type IgDrive = {
  parseMetaFolderName: (n: string) => { key: string; date: string; id: string } | null
  googleDriveDirs: (home: string) => string[]
  watchedDirs: (config: Record<string, unknown>, o?: { home?: string }) => string[]
  scanForExports: (dirs: string[]) => Array<{ key: string; date: string; kind: string; accountUnknown?: boolean; paths: string[] }>
  pickExportToImport: (c: unknown[], state: Record<string, unknown>, config: Record<string, unknown>) => { key: string } | null
  createInstagramWatcher: (o: { root: string; run: Run; now?: () => number; intervalMs?: number; home?: string }) => {
    scan: () => Promise<{ ok: boolean; imported?: boolean }>
    stop: () => void
  }
  saveConfigPatch: (root: string, patch: Record<string, unknown>) => unknown
  exportAccount: (exportRoot: string) => string
}
const igd = nodeRequire("./instagram-report.js") as IgDrive
const archive = nodeRequire("./instagram-archive.js") as { isArchived: (root: string, dir: string) => boolean }

describe("Google Drive scheduled export", () => {
  function myDrive() {
    const d = path.join(home, "Library", "CloudStorage", "GoogleDrive-me@example.com", "My Drive")
    fs.mkdirSync(d, { recursive: true })
    return d
  }

  it("reads Meta's folder name as the export date", () => {
    expect(igd.parseMetaFolderName("meta-2026-Oct-22-20-23-37")).toEqual({ key: "meta-2026-Oct-22-20-23-37", date: "2026-10-22", id: "202337" })
    expect(igd.parseMetaFolderName("meta-2026-Foo-22-20-23-37")).toBeNull()
    expect(igd.parseMetaFolderName("instagram-x-2026-10-22-a")).toBeNull()
  })

  it("finds My Drive for each signed-in account and watches it by default", () => {
    const drive = myDrive()
    expect(igd.googleDriveDirs(home)).toEqual([drive])
    expect(igd.watchedDirs({ ...config, watchGoogleDrive: true }, { home })).toEqual([downloads, drive])
    expect(igd.watchedDirs({ ...config, watchGoogleDrive: false }, { home })).toEqual([downloads])
  })

  it("takes an unzipped export, an instagram-* zip, or plain zips inside a meta folder", () => {
    const drive = myDrive()
    makeExportFolder(path.join(drive, "meta-2026-Oct-22-20-23-37"), "export")
    const inner = path.join(drive, "meta-2026-Oct-23-20-00-00")
    fs.mkdirSync(inner)
    fs.writeFileSync(path.join(inner, "instagram-_entropyviolation_-2026-10-23-abc.zip"), "zip")
    const plain = path.join(drive, "meta-2026-Oct-24-20-00-00")
    fs.mkdirSync(plain)
    fs.writeFileSync(path.join(plain, "part-2.zip"), "b")
    fs.writeFileSync(path.join(plain, "part-1.zip"), "a")
    const partial = path.join(drive, "meta-2026-Oct-25-20-00-00")
    fs.mkdirSync(partial)
    fs.writeFileSync(path.join(partial, "x.zip.part"), "a")

    const c = igd.scanForExports([drive])
    expect(c.map((x) => [x.key, x.date, x.kind])).toEqual([
      ["meta-2026-Oct-22-20-23-37", "2026-10-22", "dir"],
      ["meta-2026-Oct-23-20-00-00", "2026-10-23", "zip"],
      ["meta-2026-Oct-24-20-00-00", "2026-10-24", "zip"],
    ])
    expect(c[2].paths.map((p) => path.basename(p))).toEqual(["part-1.zip", "part-2.zip"])
    // No account in Meta's folder name: it is not filtered out by the handle.
    expect(igd.pickExportToImport(c, { imported: {} }, config)?.key).toBe("meta-2026-Oct-24-20-00-00")
  })

  it("builds the newest export and still archives the ones it skipped", async () => {
    const drive = myDrive()
    makeExportFolder(path.join(drive, "meta-2026-Oct-22-20-23-37"), "export")
    makeExportFolder(path.join(drive, "meta-2026-Oct-23-20-23-37"), "export")
    makeExportFolder(path.join(drive, "meta-2026-Oct-24-20-23-37"), "export")
    igd.saveConfigPatch(root, { ...config, downloadsDir: downloads })
    let t = 1_000_000
    const w = igd.createInstagramWatcher({ root, run: fakeRun([]), intervalMs: 1e9, home, now: () => t })
    // Drive may still be syncing a meta folder, so it waits for the tree to hold still.
    expect((await w.scan()).imported).toBe(false)
    t += ig.STABLE_MS
    const r = await w.scan()
    w.stop()
    expect(r.imported).toBe(true)
    expect(ig.loadState(root).current?.exportDate).toBe("2026-10-24")
    for (const d of ["2026-10-22-202337", "2026-10-23-202337", "2026-10-24-202337"]) expect(archive.isArchived(root, d)).toBe(true)
    // Skipped exports are archived, not kept as copies.
    expect(fs.existsSync(path.join(root, "exports", "2026-10-22-202337"))).toBe(false)
  })

  it("reads the username in an export, and skips a meta folder for another account", async () => {
    const drive = myDrive()
    const other = makeExportFolder(path.join(drive, "meta-2026-Oct-22-20-23-37"), "export")
    const info = path.join(other, "personal_information", "personal_information")
    fs.mkdirSync(info, { recursive: true })
    fs.writeFileSync(
      path.join(info, "personal_information.json"),
      JSON.stringify({ profile_user: [{ string_map_data: { Username: { value: "someone_else" } } }] }),
    )
    expect(igd.exportAccount(other)).toBe("someone_else")
    igd.saveConfigPatch(root, { ...config, downloadsDir: downloads, handle: "_entropyviolation_" })
    let t = 1_000_000
    const w = igd.createInstagramWatcher({ root, run: fakeRun([]), intervalMs: 1e9, home, now: () => t })
    await w.scan()
    t += ig.STABLE_MS
    const r = await w.scan()
    w.stop()
    expect(r.imported).toBe(false)
    expect(ig.loadState(root).current).toBeNull()
    expect(archive.isArchived(root, "2026-10-22-202337")).toBe(false)
  })
})
