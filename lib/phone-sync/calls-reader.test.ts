import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { coreDataToMs } from "./calls"
import { callHistoryPath, callsReader, readCallPage } from "./calls-reader"

// Not a static import: vite would try to bundle "node:sqlite" for the jsdom run.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite")

/** A made-up CallHistory with only the columns the reader asks for. */
function fakeCallHistory(rows: [id: string, date: number, duration: number, originated: number, answered: number, address: string][]) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "b2-calls-")), "CallHistory.storedata")
  const db = new DatabaseSync(file)
  db.exec(
    "CREATE TABLE ZCALLRECORD (Z_PK INTEGER PRIMARY KEY, ZUNIQUE_ID VARCHAR, ZDATE TIMESTAMP, ZDURATION FLOAT, ZORIGINATED INTEGER, ZANSWERED INTEGER, ZADDRESS VARCHAR, ZNAME VARCHAR, ZCALLTYPE INTEGER)",
  )
  const insert = db.prepare(
    "INSERT INTO ZCALLRECORD (ZUNIQUE_ID, ZDATE, ZDURATION, ZORIGINATED, ZANSWERED, ZADDRESS, ZNAME, ZCALLTYPE) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
  )
  for (const [id, date, duration, originated, answered, address] of rows) {
    insert.run(id, date, duration, originated, answered, address, address === "+15550000001" ? "Jane" : null)
  }
  db.close()
  return file
}

const T = 783_000_000.5

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("callsReader", () => {
  it("reads every call on the first run, oldest first", async () => {
    vi.stubEnv("COGS_CALLS_DB", fakeCallHistory([
      ["C", T + 60, 0, 0, 0, "+15550000002"],
      ["A", T, 300.7, 1, 0, "+15550000001"],
    ]))
    expect(callsReader.source).toBe("calls")
    const { records, cursor } = await callsReader.read(undefined)
    expect(records.map((r) => r.sourceId)).toEqual(["A", "C"])
    expect(records[0]).toMatchObject({ at: coreDataToMs(T), direction: "out", answered: true, durationSec: 301, service: "phone", party: { handle: "+15550000001", displayName: "Jane" } })
    expect(records[1]).toMatchObject({ direction: "in", answered: false, durationSec: 0 })
    expect(cursor).toBe(`${T + 60}|C`)
  })

  it("pages through ties on ZDATE without skipping or repeating", () => {
    const file = fakeCallHistory([
      ["A", T, 10, 0, 1, "1"],
      ["B", T, 10, 0, 1, "2"],
      ["C", T, 10, 0, 1, "3"],
      ["D", T + 1, 10, 0, 1, "4"],
      ["E", T + 1, 10, 0, 1, "5"],
    ])
    const db = new DatabaseSync(file, { readOnly: true })
    const seen: string[] = []
    let cursor: string | undefined
    for (let i = 0; i < 5; i++) {
      const page = readCallPage(db, cursor, 2)
      seen.push(...page.records.map((r) => r.sourceId))
      cursor = page.cursor
    }
    db.close()
    expect(seen).toEqual(["A", "B", "C", "D", "E"])
    expect(cursor).toBe(`${T + 1}|E`)
  })

  it("never lets a row with no id become the cursor", () => {
    const file = fakeCallHistory([
      ["A", T, 10, 0, 1, "1"],
      ["", T + 1, 10, 0, 1, "2"],
      ["B", T + 2, 10, 0, 1, "3"],
    ])
    const db = new DatabaseSync(file, { readOnly: true })
    const first = readCallPage(db, undefined, 1)
    const second = readCallPage(db, first.cursor, 1)
    db.close()
    expect([...first.records, ...second.records].map((r) => r.sourceId)).toEqual(["A", "B"])
  })

  it("keeps the cursor when nothing is new", async () => {
    vi.stubEnv("COGS_CALLS_DB", fakeCallHistory([["A", T, 10, 0, 1, "1"]]))
    expect(await callsReader.read(`${T}|A`)).toEqual({ records: [], cursor: `${T}|A` })
  })

  it("says what to fix when the file cannot be opened", async () => {
    vi.stubEnv("COGS_CALLS_DB", path.join(os.tmpdir(), "b2-no-such-dir", "CallHistory.storedata"))
    await expect(callsReader.read(undefined)).rejects.toThrow(/Full Disk Access/)
  })

  it("defaults to the Mac's CallHistoryDB", () => {
    expect(callHistoryPath({})).toMatch(/Library\/Application Support\/CallHistoryDB\/CallHistory\.storedata$/)
  })
})
