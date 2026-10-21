import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { backupName, pruneList, runBackup } from "./backup-data.mjs"

describe("backup helpers", () => {
  it("names backups by local time so they sort", () => {
    const a = backupName(new Date(2026, 9, 20, 3, 0, 0))
    expect(a).toBe("brain2-data-20261020-030000.tar.gz")
    expect(backupName(new Date(2026, 9, 21, 3, 0, 0)) > a).toBe(true)
  })

  it("prunes all but the newest N and ignores other files", () => {
    const names = [1, 2, 3, 4, 5].map((d) => `brain2-data-2026102${d}-030000.tar.gz`)
    names.push("notes.txt", "brain2-data-20261026-030000.tar.gz.partial")
    expect(pruneList(names, 2).sort()).toEqual(names.slice(0, 3))
    expect(pruneList(names, 10)).toEqual([])
  })
})

describe("runBackup", () => {
  const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "b2-backup-"))
  const quiet = () => {}

  it("refuses an empty or missing vault", () => {
    const src = mk()
    expect(() => runBackup({ src, destDir: mk(), log: quiet })).toThrow(/Refusing/)
    fs.writeFileSync(path.join(src, "shared-persist.json"), "")
    expect(() => runBackup({ src, destDir: mk(), log: quiet })).toThrow(/Refusing/)
  })

  it("archives data, leaves out keys and junk, and prunes", () => {
    const root = mk()
    const src = path.join(root, "data")
    fs.mkdirSync(path.join(src, "node_modules"), { recursive: true })
    fs.mkdirSync(path.join(src, "chrome-idb-snapshot"))
    fs.writeFileSync(path.join(src, "shared-persist.json"), '{"a":1}')
    fs.writeFileSync(path.join(src, "capture-private.key"), "SECRET")
    fs.writeFileSync(path.join(src, "node_modules", "x.js"), "x")
    fs.writeFileSync(path.join(src, "chrome-idb-snapshot", "big.bin"), Buffer.alloc(2048))
    const destDir = path.join(root, "out")

    const times = [1, 2, 3].map((d) => new Date(2026, 9, d, 3, 0, 0))
    let last!: ReturnType<typeof runBackup>
    for (const now of times) last = runBackup({ src, destDir, keep: 2, now, idbMax: 1024, log: quiet })

    const files = fs.readdirSync(destDir)
    expect(files).toHaveLength(2)
    expect(files.some((f) => f.endsWith(".partial"))).toBe(false)
    expect(last.pruned).toHaveLength(1)

    const listing = spawnSync("tar", ["-tzf", last.path], { encoding: "utf8" }).stdout
    expect(listing).toContain("data/shared-persist.json")
    expect(listing).not.toContain("capture-private.key")
    expect(listing).not.toContain("node_modules")
    expect(listing).not.toContain("chrome-idb-snapshot/big.bin")
  })
})
