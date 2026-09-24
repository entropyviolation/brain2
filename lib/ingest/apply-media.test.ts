import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ingestIncoming, ingestIncomingAsync } from "./executor"
import { useIngestStore } from "./ingest-store"
import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID } from "@/lib/note-types"
import type { IncomingMessage } from "./types"

const NOW = new Date(2026, 8, 21, 17, 42, 0)

function sim(text: string, extra?: Partial<IncomingMessage>): IncomingMessage {
  return {
    source: { channel: "simulate", chatId: "sim" },
    text,
    receivedAt: NOW.toISOString(),
    ...extra,
  }
}

describe("media ingest", () => {
  beforeEach(() => {
    resetAllStores()
    useIngestStore.setState({
      enabled: true,
      allowGroups: false,
      pairing: null,
      allowedChats: [],
      pendingByChat: {},
      events: [],
      lastPollAt: null,
      lastPollError: null,
      lastPollSource: null,
      shortcuts: {},
      phoneHubUrl: "",
      livePins: {},
    })
  })

  it("checks off grocery from a receipt and bumps pantry", () => {
    ingestIncoming(sim("groc milk"), NOW)
    ingestIncoming(sim("groc bread"), NOW)
    const result = ingestIncoming(
      sim("receipt:\nMILK 2% GAL          4.99\nBREAD                3.00\nTOTAL 7.99"),
      NOW,
    )
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.kind).toBe("receipt")
      expect(result.reply).toMatch(/Got/i)
    }
    const milk = useTaskStore.getState().tasks.find((t) => t.description === "milk")
    const bread = useTaskStore.getState().tasks.find((t) => t.description === "bread")
    expect(milk?.completed).toBe(true)
    expect(bread?.completed).toBe(true)
    const pantry = useTaskStore.getState().tasks.filter((t) => t.tags?.includes("inventory"))
    expect(pantry.length).toBeGreaterThan(0)
  })

  it("asks when a receipt line is new, then inv parks it in pantry", () => {
    ingestIncoming(sim("groc milk"), NOW)
    const first = ingestIncoming(sim("receipt:\nKALE ORGANIC          2.49\nTOTAL 2.49"), NOW)
    expect(first.status).toBe("needs_clarify")
    const answer = ingestIncoming(sim("inv"), NOW)
    expect(answer.status).toBe("ok")
    const kale = useTaskStore.getState().tasks.find((t) => /kale/i.test(t.description))
    expect(kale).toBeTruthy()
    const inv = useTaskStore.getState().lists.find((list) => list.id === kale?.lists?.[0])
    expect(inv?.name).toMatch(/inventory/i)
  })

  it("parks journal text as a Docs note", () => {
    const result = ingestIncoming(sim("journal: morning pages\nwalked to the lake"), NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/Docs:/)
    const doc = useTaskStore.getState().tasks.find((t) => t.type === NOTE_TYPE_ID)
    expect(doc?.description).toMatch(/morning pages/i)
    expect(doc?.attributes?.docsFolder).toBe("From phone")
  })

  it("OCRs a photo via ocrText without calling Tesseract", async () => {
    ingestIncoming(sim("groc oats"), NOW)
    const result = await ingestIncomingAsync(
      sim("receipt", {
        attachments: [{ kind: "photo", mime: "image/jpeg", name: "receipt.jpg", dataUrl: "" }],
        ocrText: "OATS               3.49\nTOTAL 3.49",
      }),
      NOW,
    )
    expect(result.status).toBe("ok")
    expect(useTaskStore.getState().tasks.find((t) => t.description === "oats")?.completed).toBe(true)
  })

  it("dumps and bumps inventory with inv", () => {
    const added = ingestIncoming(sim("inv oats"), NOW)
    expect(added.status).toBe("ok")
    const dump = ingestIncoming(sim("inv"), NOW)
    expect(dump.status).toBe("ok")
    if (dump.status === "ok") expect(dump.reply).toMatch(/oats/i)
  })
})
