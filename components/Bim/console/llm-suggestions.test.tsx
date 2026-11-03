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
    expect(screen.getByText("Accepted LLM blocks that overlap (1)")).toBeTruthy()
    expect(screen.getByText(/Dishes 10:00–11:00 × Podcast 10:00–12:00 · 60 min shared/)).toBeTruthy()
  })

  it("shows the last pass's suggestions again, minus decided ones", () => {
    localStorage.setItem(
      "bim-llm-suggestions-v1",
      JSON.stringify({ suggestions: [block("keep", "Laundry", 9, 10), block("gone", "Nap", 13, 14)], at: new Date().toISOString() }),
    )
    localStorage.setItem(
      "bimsuggest-verdicts-v1",
      JSON.stringify([{ suggestionId: "gone", verdict: "rejected", reason: "no", at: new Date().toISOString() }]),
    )
    render(<LlmSuggestions />)
    expect(screen.getByText("Laundry")).toBeTruthy()
    expect(screen.queryByText("Nap")).toBeNull()
  })
})
