/**
 * lib/ingest/ingest-store.test.ts — pairing survives a seed rehydrate
 */
import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import { useIngestStore } from "./ingest-store"

const KEY = persistKey("ingest-store")

describe("ingest allowlist rehydrate", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
    useIngestStore.setState({
      allowedChats: [],
      revokedChatIds: [],
      allowlistRev: 0,
      events: [],
      shortcuts: {},
    })
  })

  it("keeps a paired chat when an empty snapshot rehydrates over it", async () => {
    useIngestStore.setState({
      allowedChats: [{ chatId: "99", userId: "99", pairedAt: "2026-09-21T00:00:00.000Z" }],
      revokedChatIds: [],
      allowlistRev: 2,
    })
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: { allowedChats: [], revokedChatIds: [], allowlistRev: 0, events: [], shortcuts: {} },
        version: 2,
      }),
    )
    await useIngestStore.persist.rehydrate()
    expect(useIngestStore.getState().isAllowed("99")).toBe(true)
  })

  it("does not restore a chat that was revoked", async () => {
    useIngestStore.getState().allowChat({
      chatId: "99",
      pairedAt: "2026-09-21T00:00:00.000Z",
    })
    useIngestStore.getState().revokeChat("99")
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: {
          allowedChats: [{ chatId: "99", pairedAt: "2026-09-21T00:00:00.000Z" }],
          revokedChatIds: [],
          allowlistRev: 0,
          events: [],
        },
        version: 2,
      }),
    )
    await useIngestStore.persist.rehydrate()
    expect(useIngestStore.getState().isAllowed("99")).toBe(false)
  })

  it("drops gps tracking points from the log on rehydrate", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: {
          events: [
            {
              id: "g",
              at: "2026-09-22T04:00:00.000Z",
              kind: "gps",
              status: "applied",
              summary: "GPS → Home",
              channel: "telegram",
              chatId: "1",
              raw: "gps: Home",
            },
            {
              id: "c",
              at: "2026-09-22T05:00:00.000Z",
              kind: "capture",
              status: "applied",
              summary: "Inbox",
              channel: "telegram",
              chatId: "1",
              raw: "milk",
            },
          ],
          allowedChats: [],
          allowlistRev: 0,
        },
        version: 4,
      }),
    )
    await useIngestStore.persist.rehydrate()
    expect(useIngestStore.getState().events.map((event) => event.id)).toEqual(["c"])
  })

  it("treats the Telegram user id as the same paired sender", () => {
    useIngestStore.getState().allowChat({
      chatId: "99",
      userId: "42",
      pairedAt: "2026-09-21T00:00:00.000Z",
    })
    expect(useIngestStore.getState().isAllowed("42")).toBe(true)
  })
})
