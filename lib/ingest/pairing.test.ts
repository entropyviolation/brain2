/**
 * lib/ingest/pairing.test.ts — pairing codes + pair-by-sight from refusals
 */
import { describe, expect, it } from "vitest"
import {
  PAIRING_TTL_MS,
  UNPAIRED_SUMMARY,
  generatePairingCode,
  pairingCodeValid,
  unpairedSenders,
} from "./pairing"
import type { IngestEvent } from "./types"

const NOW = Date.UTC(2026, 8, 21, 18, 0, 0)

function refusal(over: Partial<IngestEvent> = {}): IngestEvent {
  return {
    id: `ing-${Math.random()}`,
    at: "2026-09-21T18:00:00.000Z",
    channel: "telegram",
    chatId: "555",
    username: "otherworld",
    raw: "info",
    kind: "info",
    status: "ignored",
    summary: UNPAIRED_SUMMARY,
    ...over,
  }
}

describe("pairingCodeValid", () => {
  it("accepts the live code and rejects it after the TTL", () => {
    const { code, expiresAt } = generatePairingCode(NOW)
    expect(pairingCodeValid({ code, expiresAt }, code, NOW)).toBe(true)
    expect(pairingCodeValid({ code, expiresAt }, code, NOW + PAIRING_TTL_MS + 1)).toBe(false)
  })
})

describe("unpairedSenders", () => {
  it("collapses repeat refusals from one chat and keeps the newest first", () => {
    const senders = unpairedSenders(
      [
        refusal({ chatId: "555", at: "2026-09-21T18:00:56.000Z", raw: "read: grocery list" }),
        refusal({ chatId: "555", at: "2026-09-21T18:00:42.000Z", raw: "grocery list" }),
        refusal({ chatId: "777", at: "2026-09-21T17:52:30.000Z", username: "someone" }),
      ],
      [],
    )

    expect(senders.map((s) => s.chatId)).toEqual(["555", "777"])
    expect(senders[0]).toMatchObject({ attempts: 2, username: "otherworld", lastText: "read: grocery list" })
  })

  it("drops a chat once it is paired", () => {
    expect(unpairedSenders([refusal()], ["555"])).toEqual([])
  })

  it("ignores events that were not pairing refusals", () => {
    const applied = refusal({ status: "applied", summary: "Added 2 items" })
    const otherIgnore = refusal({ summary: "Ignored group" })
    expect(unpairedSenders([applied, otherIgnore], [])).toEqual([])
  })

  it("carries a username seen on an older message of the same chat", () => {
    const senders = unpairedSenders(
      [
        refusal({ at: "2026-09-21T18:00:56.000Z", username: undefined }),
        refusal({ at: "2026-09-21T17:52:30.000Z", username: "otherworld" }),
      ],
      [],
    )
    expect(senders[0].username).toBe("otherworld")
  })
})
