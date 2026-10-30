import { describe, expect, it } from "vitest"
import { resolveLogSourceLabel } from "./log-entry-source"

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
