/**
 * sheet-popout — hash route round-trip for the spreadsheet pop-out window.
 */
import { describe, expect, it } from "vitest"
import { parseSheetPopoutCategoryId, sheetPopoutHash } from "./sheet-popout"

describe("sheet pop-out hash", () => {
  it("round-trips a category id", () => {
    expect(parseSheetPopoutCategoryId(sheetPopoutHash("list-1"))).toBe("list-1")
  })

  it("encodes ids with reserved characters", () => {
    const id = "list/with spaces?&"
    expect(parseSheetPopoutCategoryId(sheetPopoutHash(id))).toBe(id)
  })

  it("ignores unrelated hashes (incl. the module pop-out route)", () => {
    expect(parseSheetPopoutCategoryId("#popout/module/m1")).toBeNull()
    expect(parseSheetPopoutCategoryId("#some/other")).toBeNull()
    expect(parseSheetPopoutCategoryId("")).toBeNull()
    expect(parseSheetPopoutCategoryId(null)).toBeNull()
  })
})
