import { describe, expect, it } from "vitest"
import { textsUpdatedLabel } from "@/lib/texts-report"

describe("textsUpdatedLabel", () => {
  it("says a refused Messages read needs Full Disk Access", () => {
    const error = "analyze.py failed: PermissionError: [Errno 1] Operation not permitted: '/Users/me/Library/Messages/chat.db'"
    expect(textsUpdatedLabel({ lastRun: null, error })).toMatch(/Full Disk Access/)
  })

  it("names any other failure", () => {
    expect(textsUpdatedLabel({ error: "build_report.py failed: 1" })).toBe("The last update failed: build_report.py failed: 1")
  })

  it("shows the run and the never-run state", () => {
    expect(textsUpdatedLabel({ running: true, error: "old" })).toBe("Updating now…")
    expect(textsUpdatedLabel({ lastRun: null })).toBe("Not run yet")
  })
})
