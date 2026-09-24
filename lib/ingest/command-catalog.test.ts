/**
 * lib/ingest/command-catalog.test.ts — Catalog covers the live parser surface
 */
import { describe, expect, it } from "vitest"
import { BIM_COMMAND_CATALOG, formatAllCommandsBody, catalogMarkdown } from "./command-catalog"
import { ALL_COMMANDS, BIM_MAIN_INFO, glossaryCommandsFor } from "./command-glossary"
import { parseMessage } from "./parse-message"

/** Every IngestIntentKind the verb table can emit (plus specials). */
const EXPECTED_KIND_MARKERS: Array<{ kind: string; mustMention: string }> = [
  { kind: "help", mustMention: "help" },
  { kind: "info", mustMention: "info" },
  { kind: "pair", mustMention: "pair" },
  { kind: "bulk", mustMention: "bulk" },
  { kind: "habit", mustMention: "habit:" },
  { kind: "location", mustMention: "at:" },
  { kind: "track", mustMention: "track:" },
  { kind: "iphone-screen", mustMention: "screen:" },
  { kind: "iphone-call", mustMention: "call:" },
  { kind: "iphone-text", mustMention: "text:" },
  { kind: "mood", mustMention: "mood:" },
  { kind: "sleep", mustMention: "sleep:" },
  { kind: "start", mustMention: "start:" },
  { kind: "stop", mustMention: "stop" },
  { kind: "stopped-activity", mustMention: "stopped" },
  { kind: "currently", mustMention: "currently" },
  { kind: "switched-to", mustMention: "switched to" },
  { kind: "read", mustMention: "read:" },
  { kind: "lists", mustMention: "lists" },
  { kind: "folders", mustMention: "folders" },
  { kind: "inbox", mustMention: "read inbox" },
  { kind: "search", mustMention: "search:" },
  { kind: "today", mustMention: "today" },
  { kind: "habits", mustMention: "habits" },
  { kind: "status", mustMention: "where" },
  { kind: "ops", mustMention: "ops" },
  { kind: "count", mustMention: "count" },
  { kind: "tags", mustMention: "tags" },
  { kind: "plan-now", mustMention: "plan for rn" },
  { kind: "read-plan", mustMention: "read plan" },
  { kind: "read-plans", mustMention: "read plans" },
  { kind: "todo-today", mustMention: "to do today" },
  { kind: "do", mustMention: "do:" },
  { kind: "morning", mustMention: "gm" },
  { kind: "reviews", mustMention: "reviews" },
  { kind: "review", mustMention: "review" },
  { kind: "cancel", mustMention: "cancel" },
  { kind: "gps", mustMention: "gps:" },
  { kind: "plan", mustMention: "agenda" },
  { kind: "ping", mustMention: "ping" },
  { kind: "grocery", mustMention: "groc" },
  { kind: "needed", mustMention: "needed" },
  { kind: "bought", mustMention: "got" },
  { kind: "note", mustMention: "memo" },
  { kind: "iphone-notes", mustMention: "iphone-notes" },
  { kind: "pin", mustMention: "pin" },
  { kind: "receipt", mustMention: "receipt" },
  { kind: "journal", mustMention: "journal" },
  { kind: "pdf", mustMention: "pdf" },
  { kind: "inventory", mustMention: "inv" },
  { kind: "capture", mustMention: "add" },
  { kind: "event-log", mustMention: "log:" },
]

describe("BIM_COMMAND_CATALOG", () => {
  it("documents add, bulk add, read, and retired g", () => {
    const body = formatAllCommandsBody().toLowerCase()
    expect(body).toContain("add")
    expect(body).toContain("bulk")
    expect(body).toContain("read:")
    expect(body).toContain("[retired]")
    expect(body).toMatch(/\bg\b/)
  })

  it("all commands reply includes the catalog body", () => {
    expect(ALL_COMMANDS).toContain("groc")
    expect(ALL_COMMANDS).toContain("bulk")
    expect(ALL_COMMANDS).toContain("add")
    expect(ALL_COMMANDS).toContain("[RETIRED]")
    expect(ALL_COMMANDS).toContain("hemisync")
    expect(ALL_COMMANDS).toContain("currently")
    expect(ALL_COMMANDS).toContain("all nighter")
  })

  it("main info explains how to dig into the full catalog", () => {
    expect(BIM_MAIN_INFO).toContain("{prefix} info")
    expect(BIM_MAIN_INFO).toContain("all commands")
    expect(BIM_MAIN_INFO).toContain("add")
    expect(BIM_MAIN_INFO).toContain("bulk")
    expect(BIM_MAIN_INFO).toContain("BIM_COMMANDS.md")
  })

  it("prefix commands for add/bulk/read are detailed", () => {
    const add = glossaryCommandsFor("add")
    expect(add).toMatch(/add/i)
    expect(add).toMatch(/Inbox/i)
    const bulk = glossaryCommandsFor("bulk")
    expect(bulk).toMatch(/bulk/i)
    const read = glossaryCommandsFor("read")
    expect(read).toMatch(/read:/i)
  })

  it("mentions every parser kind marker", () => {
    const body = `${formatAllCommandsBody()}\n${catalogMarkdown()}`.toLowerCase()
    for (const { mustMention } of EXPECTED_KIND_MARKERS) {
      expect(body, `missing ${mustMention}`).toContain(mustMention.toLowerCase())
    }
  })

  it("sample phrases still parse to expected kinds", () => {
    expect(parseMessage("add: milk").kind).toBe("capture")
    expect(parseMessage("bulk:\nmilk").kind).toBe("bulk")
    expect(parseMessage("read: chores").kind).toBe("read")
    expect(parseMessage("groc").kind).toBe("grocery")
    expect(parseMessage("log: water").kind).toBe("event-log")
    expect(parseMessage("all nighter").kind).toBe("capture") // ritual reply, not a verb
  })

  it("has a substantial entry count", () => {
    expect(BIM_COMMAND_CATALOG.length).toBeGreaterThanOrEqual(60)
  })
})
