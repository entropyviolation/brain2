import { beforeEach, describe, expect, it } from "vitest"
import { loadHistory, originOf, saveHistory, type SavedRun } from "./run-history"
import { decidedIds, loadVerdicts, recordVerdict } from "./suggestion-verdicts"

const row = (id: string, at: string, origin?: SavedRun["origin"]): SavedRun => ({
  id,
  flowId: "log-routed",
  flowName: "Log",
  at,
  model: "m",
  inputLabel: "",
  flow: { id: "log-routed", nodes: [], edges: [] } as unknown as SavedRun["flow"],
  run: { model: "m", startedAt: at, ms: 1, messages: [], blocks: [] },
  ...(origin ? { origin } : {}),
})

describe("run history origins", () => {
  beforeEach(() => localStorage.clear())

  it("keeps button runs apart from bench runs and reads both back newest first", () => {
    saveHistory([row("b1", "2026-10-30T10:00:00Z", "brain2-button"), row("r1", "2026-10-30T09:00:00Z")])
    expect(JSON.parse(localStorage.getItem("bimflow-button-runs-v1")!).map((r: SavedRun) => r.id)).toEqual(["b1"])
    expect(JSON.parse(localStorage.getItem("bimflow-runs-v1")!).map((r: SavedRun) => r.id)).toEqual(["r1"])
    expect(loadHistory().map((r) => [r.id, originOf(r)])).toEqual([["b1", "brain2-button"], ["r1", "bench"]])
  })
})

describe("suggestion verdicts", () => {
  beforeEach(() => localStorage.clear())

  it("keeps the reason, replaces an earlier verdict, and hides decided and old dismissed ids", () => {
    const s = { id: "tb-1", kind: "timeblock" as const, title: "Dishes", detail: "", at: "2026-10-30T10:00:00Z", source: "bim" as const, why: "", evidence: [] }
    recordVerdict({ suggestionId: "tb-1", verdict: "accepted", reason: "", at: "x", suggestion: s })
    recordVerdict({ suggestionId: "tb-1", verdict: "rejected", reason: "I was at work", at: "y", suggestion: s })
    expect(loadVerdicts()).toMatchObject([{ suggestionId: "tb-1", verdict: "rejected", reason: "I was at work" }])
    localStorage.setItem("bimsuggest-dismissed-v1", JSON.stringify(["it-9"]))
    expect([...decidedIds(loadVerdicts())].sort()).toEqual(["it-9", "tb-1"])
  })
})
