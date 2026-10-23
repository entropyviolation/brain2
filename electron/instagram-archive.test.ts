import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type Row = { thread: string; sender: string; content?: string; kind: string; lastSeen: string; removedSince: string; editedTo?: string; media?: string[] }
type Archive = {
  archiveExport: (root: string, e: { exportDir: string; exportRoot: string; date: string }) => Promise<{ ok: boolean; skipped: boolean; files?: number }>
  archiveAll: (root: string) => Promise<{ name: string }[]>
  removedMessages: (root: string) => { exports: number; rows: Row[] }
  archiveStatus: (root: string) => { count: number }
  loadIndex: (root: string) => { exports: Record<string, { date: string }> }
  blobPath: (root: string, sha: string) => string
  fixText: (s: string) => string
}
const ar = nodeRequire("./instagram-archive.js") as Archive

let tmp: string
let root: string

type Msg = { sender_name: string; timestamp_ms: number; content?: string; photos?: { uri: string }[] }

/** Write an unzipped export under root/exports/<dir> with the given DM threads. */
function makeExport(dir: string, threads: Record<string, Msg[]>, extra: Record<string, string> = {}) {
  const exportRoot = path.join(root, "exports", dir)
  for (const [folder, messages] of Object.entries(threads)) {
    const t = path.join(exportRoot, "your_instagram_activity", "messages", "inbox", folder)
    fs.mkdirSync(t, { recursive: true })
    fs.writeFileSync(
      path.join(t, "message_1.json"),
      JSON.stringify({ title: folder.split("_")[0], participants: [{ name: "alitza" }, { name: folder.split("_")[0] }], messages }),
    )
  }
  for (const [rel, body] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(exportRoot, rel)), { recursive: true })
    fs.writeFileSync(path.join(exportRoot, rel), body)
  }
  return exportRoot
}

const hi: Msg = { sender_name: "sam", timestamp_ms: 1000, content: "hi" }
const secret: Msg = { sender_name: "sam", timestamp_ms: 2000, content: "something I will unsend" }
const reply: Msg = { sender_name: "alitza", timestamp_ms: 3000, content: "ok" }

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ig-archive-"))
  root = path.join(tmp, "instagram")
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe("instagram archive", () => {
  it("keeps a message that a later export no longer has, with its text", async () => {
    const a = makeExport("2026-10-22-aaa", { sam_1: [hi, secret, reply] })
    const b = makeExport("2026-10-29-bbb", { sam_1: [hi, reply] })
    await ar.archiveExport(root, { exportDir: "2026-10-22-aaa", exportRoot: a, date: "2026-10-22" })
    await ar.archiveExport(root, { exportDir: "2026-10-29-bbb", exportRoot: b, date: "2026-10-29" })
    const { exports, rows } = ar.removedMessages(root)
    expect(exports).toBe(2)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ sender: "sam", content: "something I will unsend", kind: "removed", lastSeen: "2026-10-22", removedSince: "2026-10-29" })
  })

  it("is the same when the older export is archived second", async () => {
    const a = makeExport("2026-10-22-aaa", { sam_1: [hi, secret] })
    const b = makeExport("2026-10-29-bbb", { sam_1: [hi] })
    await ar.archiveExport(root, { exportDir: "2026-10-29-bbb", exportRoot: b, date: "2026-10-29" })
    await ar.archiveExport(root, { exportDir: "2026-10-22-aaa", exportRoot: a, date: "2026-10-22" })
    expect(ar.removedMessages(root).rows.map((r) => r.content)).toEqual(["something I will unsend"])
  })

  it("marks a changed message as edited, and a vanished chat as gone", async () => {
    const a = makeExport("2026-10-22-aaa", { sam_1: [hi, secret], kim_2: [{ sender_name: "kim", timestamp_ms: 500, content: "yo" }] })
    const b = makeExport("2026-10-29-bbb", { sam_1: [{ ...hi, content: "hi!!" }, secret] })
    await ar.archiveExport(root, { exportDir: "2026-10-22-aaa", exportRoot: a, date: "2026-10-22" })
    await ar.archiveExport(root, { exportDir: "2026-10-29-bbb", exportRoot: b, date: "2026-10-29" })
    const rows = ar.removedMessages(root).rows
    expect(rows.find((r) => r.thread === "sam_1")).toMatchObject({ kind: "edited", content: "hi", editedTo: "hi!!" })
    expect(rows.find((r) => r.thread === "kim_2")).toMatchObject({ kind: "thread-gone", content: "yo" })
  })

  it("stores every file once by content and survives the export folder being pruned", async () => {
    const photo = "your_instagram_activity/messages/inbox/sam_1/photos/p.jpg"
    const a = makeExport("2026-10-22-aaa", { sam_1: [{ ...secret, photos: [{ uri: photo }] }] }, { [photo]: "JPEGDATA" })
    const b = makeExport("2026-10-29-bbb", { sam_1: [] }, { [photo]: "JPEGDATA" })
    await ar.archiveExport(root, { exportDir: "2026-10-22-aaa", exportRoot: a, date: "2026-10-22" })
    await ar.archiveExport(root, { exportDir: "2026-10-29-bbb", exportRoot: b, date: "2026-10-29" })
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "archive", "manifests", "2026-10-22-aaa.json"), "utf8"))
    const sha = manifest[photo].sha as string
    const blobs = fs.readdirSync(path.join(root, "archive", "blobs"), { recursive: true }).filter((f) => String(f).length > 10)
    expect(blobs.filter((f) => String(f).endsWith(sha))).toHaveLength(1)
    fs.rmSync(path.join(root, "exports"), { recursive: true, force: true })
    expect(fs.readFileSync(ar.blobPath(root, sha), "utf8")).toBe("JPEGDATA")
    expect(ar.removedMessages(root).rows[0]?.media).toEqual([photo])
  })

  it("archives each export once, and archiveAll picks up folders not yet archived", async () => {
    makeExport("2026-10-22-aaa", { sam_1: [hi] })
    makeExport("2026-10-29-bbb", { sam_1: [hi] })
    expect((await ar.archiveAll(root)).map((r) => r.name)).toEqual(["2026-10-22-aaa", "2026-10-29-bbb"])
    expect(await ar.archiveAll(root)).toEqual([])
    expect(ar.archiveStatus(root).count).toBe(2)
  })

  it("skips a half-copied .partial folder", async () => {
    makeExport("2026-10-22-aaa.partial", { sam_1: [hi] })
    expect(await ar.archiveAll(root)).toEqual([])
  })

  it("fixes Meta's Latin-1 text and leaves real text alone", async () => {
    expect(ar.fixText("cafÃ©")).toBe("café")
    expect(ar.fixText("café ☕")).toBe("café ☕")
    expect(ar.fixText("plain")).toBe("plain")
  })
})
