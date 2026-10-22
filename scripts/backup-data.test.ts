import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { encryptFile, decryptFile } from "./backup-crypt.mjs"
import { backupName, pruneList, readBackupPublicKey, runBackup } from "./backup-data.mjs"
import { generateKeyPair } from "./sealed-box.mjs"

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

describe("encrypted backups", () => {
  const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "b2-backup-enc-"))
  const quiet = () => {}

  it("writes only an encrypted file that opens back to the same tar", () => {
    const root = mk()
    const src = path.join(root, "data")
    fs.mkdirSync(src)
    fs.writeFileSync(path.join(src, "shared-persist.json"), '{"messages":"secret body"}')
    fs.writeFileSync(path.join(src, "backup-private.key"), "SECRET")
    const destDir = path.join(root, "out")
    const { publicKey, privateKey } = generateKeyPair()

    const res = runBackup({ src, destDir, publicKey, log: quiet })
    expect(res.encrypted).toBe(true)
    expect(fs.readdirSync(destDir)).toEqual([path.basename(res.path)])
    expect(res.path.endsWith(".tar.gz.b2enc")).toBe(true)
    expect(fs.readFileSync(res.path).includes("secret body")).toBe(false)

    const tar = res.path.slice(0, -".b2enc".length)
    decryptFile(privateKey, res.path, tar)
    const listing = spawnSync("tar", ["-tzf", tar], { encoding: "utf8" }).stdout
    expect(listing).toContain("data/shared-persist.json")
    expect(listing).not.toContain("backup-private.key")
  })

  it("refuses the wrong key and leaves no output", () => {
    const root = mk()
    const plain = path.join(root, "a.bin")
    fs.writeFileSync(plain, Buffer.alloc(3 * 1024 * 1024, 7))
    const enc = `${plain}.b2enc`
    encryptFile(generateKeyPair().publicKey, plain, enc)
    const out = path.join(root, "b.bin")
    expect(() => decryptFile(generateKeyPair().privateKey, enc, out)).toThrow()
    expect(fs.existsSync(out)).toBe(false)
    expect(fs.existsSync(`${out}.partial`)).toBe(false)
  })

  it("round-trips a file larger than one chunk and rejects tampering", () => {
    const root = mk()
    const plain = path.join(root, "a.bin")
    fs.writeFileSync(plain, crypto.randomBytes(2.5 * 1024 * 1024))
    const { publicKey, privateKey } = generateKeyPair()
    const enc = `${plain}.b2enc`
    encryptFile(publicKey, plain, enc)
    const out = path.join(root, "b.bin")
    decryptFile(privateKey, enc, out)
    expect(fs.readFileSync(out).equals(fs.readFileSync(plain))).toBe(true)

    const bytes = fs.readFileSync(enc)
    bytes[bytes.length - 100] ^= 1
    fs.writeFileSync(enc, bytes)
    expect(() => decryptFile(privateKey, enc, path.join(root, "c.bin"))).toThrow()
  })

  it("prunes plain and encrypted backups by date together", () => {
    const names = ["brain2-data-20261001-030000.tar.gz", "brain2-data-20261002-030000.tar.gz.b2enc", "brain2-data-20261003-030000.tar.gz.b2enc"]
    expect(pruneList(names, 2)).toEqual(["brain2-data-20261001-030000.tar.gz"])
  })

  it("reads the public key from the env first, then the file", () => {
    const root = mk()
    const file = path.join(root, "backup-public.key")
    expect(readBackupPublicKey({}, file)).toBeNull()
    fs.writeFileSync(file, "FROMFILE\n")
    expect(readBackupPublicKey({}, file)).toBe("FROMFILE")
    expect(readBackupPublicKey({ COGS_BACKUP_PUBLIC_KEY: "FROMENV" }, file)).toBe("FROMENV")
  })
})
