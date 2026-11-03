import { describe, expect, it } from "vitest"
import { formatRunReport } from "./run-report"

describe("formatRunReport", () => {
  it("labels input, each step in order, and the result", () => {
    const text = formatRunReport({
      agent: "Tracking Helper",
      input: "slept then ran",
      summary: "route day · 2 blocks · 40 ms",
      stages: [
        { stage: "ROUTE", ms: 1, output: { route: "day" } },
        { stage: "WIRE", note: "one call", ms: 39, prompt: "SYSTEM", output: [1] },
      ],
      result: ["sleep 00:00–07:00"],
    })
    expect(text).toContain("# Agent run report: Tracking Helper")
    expect(text).toContain("## Input")
    expect(text.indexOf("## Step 1 of 2: ROUTE (1 ms)")).toBeLessThan(text.indexOf("## Step 2 of 2: WIRE (39 ms)"))
    expect(text).toContain("Prompt the model saw:")
    expect(text).toContain("- sleep 00:00–07:00")
  })
})
