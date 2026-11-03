/**
 * components/Mobile/phone-sheet-close.test.ts
 *
 * The iOS shell keeps portaled sheets below the status bar. A close at the
 * top of a 100dvh sheet sits in that bar, and the tap never arrives.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function css(path: string): string {
  return readFileSync(join(root, path), "utf8")
}

describe("phone sheet close", () => {
  it("clears the status bar even when the safe-area inset is 0", () => {
    const mobile = css("components/Mobile/mobile.css")
    expect(mobile).toContain("--phone-sheet-top: max(env(safe-area-inset-top, 0px), 59px)")
    expect(mobile).toContain("body [role=\"dialog\"].ui-dialog-content")
    expect(mobile).toContain("top: calc(var(--phone-sheet-top) + 12px)")
    expect(mobile).toContain("button.home-widget-dismiss")
    expect(mobile).toContain("min-height: 44px")
  })

  it("does not pin the known full-screen sheets to the top of the viewport", () => {
    const sheets = [
      "components/Home/home-chrome.css",
      "components/Home/Habits/habit-form-dialog.css",
      "components/Home/ToDo/session-planner.css",
      "components/Home/ToDo/task-card/task-card.css",
    ]
    for (const path of sheets) {
      const phone = css(path)
      expect(phone, path).not.toMatch(/height:\s*100dvh\s*!important/)
      expect(phone, path).not.toMatch(/max-height:\s*100dvh\s*!important/)
      expect(phone, path).toContain("--phone-sheet-top")
    }
  })
})
