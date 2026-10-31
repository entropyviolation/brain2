import { describe, expect, it } from "vitest"
import { resolveCreatedByLabel, resolveLogSourceLabel } from "./log-entry-source"

describe("resolveLogSourceLabel", () => {
  it("prefers a stored door, then the stamp, then unknown", () => {
    expect(resolveLogSourceLabel({ logSource: "quick-add" })).toBe("quick add")
    expect(resolveLogSourceLabel({ logSource: "tracking-composer" })).toBe("Tracking log")
    expect(resolveLogSourceLabel({ logSource: "tracking-shelf-now" })).toBe("the list")
    expect(resolveLogSourceLabel({ logSource: "now-popup" })).toBe("Now")
    expect(resolveLogSourceLabel({ logSource: "bim" })).toBe("BIM")
    expect(resolveLogSourceLabel({ logSource: "inbox-transfer" })).toBe("Inbox")
    expect(resolveLogSourceLabel({ logSource: "telegram-feed" })).toBe("Telegram")
    expect(resolveLogSourceLabel({ logSource: "statement-import" })).toBe("a statement")
    expect(resolveLogSourceLabel({ logSource: "nfc" })).toBe("NFC")
    expect(resolveLogSourceLabel({ logSource: "phone-sync" })).toBe("phone sync")

    expect(resolveLogSourceLabel({ generatedBy: { kind: "text", id: "nfc:vitamin:2026-06-20T15:00:00.000Z" } })).toBe(
      "NFC",
    )
    expect(resolveLogSourceLabel({ generatedBy: { kind: "phone-sync", id: "messages:guid" } })).toBe("phone sync")
    expect(
      resolveLogSourceLabel({
        generatedBy: { kind: "text", id: "2026-06-20" },
        notes: "from text message at 8:15am\nfrom text pipeline",
      }),
    ).toBe("BIM")
    expect(resolveLogSourceLabel({ notes: "from text pipeline" })).toBe("BIM")
    expect(resolveLogSourceLabel({})).toBe("Unknown source")
    expect(resolveLogSourceLabel({ generatedBy: { kind: "sleep", id: "2026-06-20" } })).toBe("Unknown source")
  })
})

describe("resolveCreatedByLabel", () => {
  it("names the creator and the shell", () => {
    expect(resolveCreatedByLabel({ createdBy: { surface: "user", client: "ios" } })).toBe("Created by you on iOS")
    expect(resolveCreatedByLabel({ createdBy: { surface: "user", client: "electron" } })).toBe("Created by you on Electron")
    expect(resolveCreatedByLabel({ createdBy: { surface: "bim", client: "electron" } })).toBe(
      "Created automatically from BIM chat input on Electron",
    )
    expect(
      resolveCreatedByLabel({ createdBy: { surface: "llm-suggestion" }, generatedBy: { kind: "llm", id: "bim-suggest:a" } }),
    ).toBe("Suggested by the LLM, confirmed by you")
  })
  it("reads older rows and admits when it cannot", () => {
    expect(resolveCreatedByLabel({ generatedBy: { kind: "llm", id: "x" } })).toBe("Suggested by the LLM, confirmed by you")
    expect(resolveCreatedByLabel({ generatedBy: { kind: "sleep", id: "2026-06-20" } })).toBe(
      "Created automatically from the sleep log",
    )
    expect(resolveCreatedByLabel({ logSource: "nfc" })).toBe("Created automatically from NFC")
    expect(resolveCreatedByLabel({})).toBe("Creator not recorded (made before this was tracked)")
  })
})
