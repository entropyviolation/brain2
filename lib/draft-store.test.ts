import { beforeEach, describe, expect, it } from "vitest"
import { BIM_CHAT_DRAFT_KEY, readDraft, writeDraft, writeTextDraft } from "@/lib/draft-store"

describe("draft-store", () => {
  beforeEach(() => localStorage.clear())

  it("round-trips text and flags", () => {
    writeTextDraft(BIM_CHAT_DRAFT_KEY, "half a thought", { bulk: true })
    expect(readDraft(BIM_CHAT_DRAFT_KEY)).toEqual({ text: "half a thought", bulk: true })
  })

  it("drops the key when the text is blank", () => {
    writeTextDraft(BIM_CHAT_DRAFT_KEY, "x")
    writeTextDraft(BIM_CHAT_DRAFT_KEY, "  ")
    expect(localStorage.getItem(BIM_CHAT_DRAFT_KEY)).toBeNull()
  })

  it("ignores corrupt values", () => {
    localStorage.setItem(BIM_CHAT_DRAFT_KEY, "{nope")
    expect(readDraft(BIM_CHAT_DRAFT_KEY)).toBeNull()
    writeDraft(BIM_CHAT_DRAFT_KEY, null)
  })
})
