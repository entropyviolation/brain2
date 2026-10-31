import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { acceptSuggestion } from "@/lib/bim-flow/accept"
import type { Suggestion } from "@/lib/bim-flow/suggestions"
import { resetAllStores } from "@/tests/test-utils"
import { LlmSuggestions } from "./llm-suggestions"

const block = (id: string, title: string, h0: number, h1: number): Suggestion => ({
  id,
  kind: "timeblock",
  title,
  detail: "",
  at: new Date(2026, 9, 29, h0).toISOString(),
  end: new Date(2026, 9, 29, h1).toISOString(),
  source: "bim",
  why: "said so",
  evidence: [],
})

describe("LlmSuggestions", () => {
  beforeEach(() => resetAllStores())

  it("lists accepted LLM blocks that still overlap", () => {
    acceptSuggestion(block("a", "Dishes", 10, 11))
    acceptSuggestion(block("b", "Podcast", 10, 12))
    render(<LlmSuggestions />)
    expect(screen.getByText("ACCEPTED LLM BLOCKS THAT OVERLAP (1)")).toBeTruthy()
    expect(screen.getByText(/DISHES 10:00–11:00 × PODCAST 10:00–12:00 · 60 MIN SHARED/)).toBeTruthy()
  })
})
