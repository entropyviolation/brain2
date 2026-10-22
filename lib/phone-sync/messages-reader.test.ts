import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { APPLE_EPOCH_MS } from "./messages"
import { messagesReader, readMessagesBatch } from "./messages-reader"
import type { MessageRecord } from "./types"

// getBuiltinModule, not import: the jsdom test env makes vite try to bundle node:sqlite.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite")

/** A made-up chat.db with only the tables and columns the reader queries. */
function fakeChatDb(): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "b2-msgs-")), "chat.db")
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT);
    CREATE TABLE chat (ROWID INTEGER PRIMARY KEY, guid TEXT, chat_identifier TEXT, display_name TEXT);
    CREATE TABLE message (ROWID INTEGER PRIMARY KEY, guid TEXT, text TEXT, attributedBody BLOB, date INTEGER,
      is_from_me INTEGER, service TEXT, handle_id INTEGER, associated_message_type INTEGER, item_type INTEGER);
    CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
    CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
    CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, filename TEXT);
    CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
    INSERT INTO handle VALUES (1, '+15550000001'), (2, '+15550000002');
    INSERT INTO chat VALUES (1, 'iMessage;-;+15550000001', '+15550000001', ''),
                            (2, 'iMessage;+;chat9', 'chat9', 'Climbing');
    INSERT INTO chat_handle_join VALUES (1, 1), (2, 1), (2, 2);
  `)
  const enc = new TextEncoder()
  const blob = new Uint8Array([...enc.encode("NSString"), 0x01, 0x94, 0x84, 0x01, 0x2b, 0x05, ...enc.encode("blobs"), 0x86])
  const insert = db.prepare("INSERT INTO message VALUES (?, ?, ?, ?, ?, ?, 'iMessage', ?, ?, 0)")
  const join = db.prepare("INSERT INTO chat_message_join VALUES (?, ?)")
  const ns = (sec: number) => BigInt(700_000_000 + sec) * BigInt(1e9)
  insert.run(1, "G1", "hi", null, ns(100), 0, 1, 0)
  insert.run(2, "G2", null, blob, ns(200), 1, 1, 0)
  insert.run(3, "G3", "Loved “hi”", null, ns(300), 1, 1, 2000)
  insert.run(4, "G4", "￼", null, ns(400), 0, 2, 0)
  insert.run(5, "G5", "group out", null, ns(500), 1, 0, 0)
  for (const [chat, msg] of [[1, 1], [1, 2], [1, 3], [2, 4], [2, 5]]) join.run(chat, msg)
  db.exec(`INSERT INTO attachment VALUES (1, '~/Library/Messages/Attachments/aa/00/IMG_1.heic');
           INSERT INTO message_attachment_join VALUES (4, 1);`)
  db.close()
  return file
}

describe("readMessagesBatch", () => {
  let file: string
  const prev = process.env.COGS_MESSAGES_DB
  beforeEach(() => {
    file = fakeChatDb()
    process.env.COGS_MESSAGES_DB = file
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.COGS_MESSAGES_DB
    else process.env.COGS_MESSAGES_DB = prev
  })

  it("maps rows, skips tapbacks, and returns the last ROWID", async () => {
    const { records: raw, cursor } = await messagesReader.read(undefined)
    const records = raw as MessageRecord[]
    expect(cursor).toBe("5")
    expect(records.map((r) => r.sourceId)).toEqual(["G1", "G2", "G4", "G5"])
    expect(records[0]).toMatchObject({ direction: "in", party: { handle: "+15550000001" }, body: "hi", at: APPLE_EPOCH_MS + 700_000_100_000 })
    expect(records[1]).toMatchObject({ direction: "out", body: "blobs", threadId: "+15550000001" })
    expect(records[1].threadName).toBeUndefined()
    expect(records[2]).toMatchObject({
      party: { handle: "+15550000002" },
      members: [{ handle: "+15550000001" }],
      threadId: "chat9",
      threadName: "Climbing",
      body: "",
      attachments: ["~/Library/Messages/Attachments/aa/00/IMG_1.heic"],
    })
    expect(records[3]).toMatchObject({ direction: "out", party: { handle: "+15550000001" }, members: [{ handle: "+15550000002" }] })
  })

  it("pages by ROWID and never reads a row twice", async () => {
    const a = await readMessagesBatch(undefined, file, 2)
    expect([a.records.map((r) => r.sourceId), a.cursor]).toEqual([["G1", "G2"], "2"])
    const b = await readMessagesBatch(a.cursor, file, 2)
    expect([b.records.map((r) => r.sourceId), b.cursor]).toEqual([["G4"], "4"])
    const c = await readMessagesBatch(b.cursor, file, 2)
    expect([c.records.map((r) => r.sourceId), c.cursor]).toEqual([["G5"], "5"])
    const d = await readMessagesBatch(c.cursor, file, 2)
    expect(d).toEqual({ records: [], cursor: "5" })
  })

  it("says what to do when the file cannot be opened", async () => {
    await expect(readMessagesBatch(undefined, path.join(os.tmpdir(), "no-such-dir-b2", "chat.db"))).rejects.toThrow(/Full Disk Access/)
  })
})
