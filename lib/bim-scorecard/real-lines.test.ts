/**
 * The code-only scorecard on the committed fixture (`fixture.ts`): every line through the real BIM chat turn with
 * LLM off, scored for lane, action and no invented write. The floors are the baseline; a change that drops a line
 * below them fails CI, the way the real-feed "no invented block" drop (86 → 65) should have.
 * Raise a floor when a fix lands. The full set runs with `npm run bim:scorecard`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { formatCard, summarize } from "./card"
import { FIXTURE_LINES } from "./fixture"
import { replayLines } from "./replay"

/** The baseline of 2026-11-21 (code only). Floors, not targets. */
export const FLOOR = { lane: 19, action: 19, clean: 41 }
/** The flagged social line (many people in one line): checks passed of 6. 0 today; step 3 raises it. */
export const SOCIAL_FLOOR = 0

function reset() {
  resetAllStores()
  useBimChatStore.setState({ lines: [], busy: false })
}

describe("BIM real-line scorecard (code only, fixture)", () => {
  beforeEach(() => {
    // No network in CI: the web, the texts hub and the model daemon all answer "down".
    vi.stubGlobal("fetch", async () => {
      throw new Error("no network in tests")
    })
  })

  it("keeps lane, action and no-invented-write at or above the floor", async () => {
    const run = await replayLines(FIXTURE_LINES, { variant: "code", label: "Code only", llm: false, reset })
    const card = summarize(run, "fixture", false)
    if (process.env.BIM_SCORECARD_PRINT) {
      process.stdout.write(`${formatCard(card)}\n`)
      for (const r of card.rows) if (!r.laneRight) process.stdout.write(`  miss ${r.expected} → ${r.observed}: ${r.text.slice(0, 50)} | ${r.reply.slice(0, 60).replace(/\n/g, " ")}\n`)
    }
    expect(card.n).toBe(FIXTURE_LINES.length)
    expect(card.totals.lane).toBeGreaterThanOrEqual(FLOOR.lane)
    expect(card.totals.action).toBeGreaterThanOrEqual(FLOOR.action)
    expect(card.totals.clean).toBeGreaterThanOrEqual(FLOOR.clean)
    const social = card.rows.find((r) => r.priority && r.social)?.social
    expect(social, "the flagged social line is in the fixture").toBeDefined()
    expect(social!.passed).toBeGreaterThanOrEqual(SOCIAL_FLOOR)
    vi.unstubAllGlobals()
  }, 60_000)
})
