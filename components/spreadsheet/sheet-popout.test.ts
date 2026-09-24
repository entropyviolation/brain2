/**
 * sheet-popout — path + hash round-trip for the spreadsheet pop-out window.
 */
import { describe, expect, it } from "vitest"
import {
  parseSheetPopoutCategoryId,
  parseSheetPopoutFromSearch,
  parseSheetPopoutLocation,
  sheetPopoutHash,
  sheetPopoutPath,
} from "./sheet-popout"

describe("sheet pop-out routing", () => {
  it("round-trips a category id via the /popout/ query", () => {
    expect(parseSheetPopoutFromSearch(sheetPopoutPath("list-1").split("?")[1])).toBe("list-1")
  })

  it("round-trips a category id via the legacy hash", () => {
    expect(parseSheetPopoutCategoryId(sheetPopoutHash("list-1"))).toBe("list-1")
  })

  it("encodes ids with reserved characters", () => {
    const id = "list/with spaces?&"
    expect(parseSheetPopoutFromSearch(sheetPopoutPath(id).split("?")[1])).toBe(id)
    expect(parseSheetPopoutCategoryId(sheetPopoutHash(id))).toBe(id)
  })

  it("prefers the query string over a leftover hash", () => {
    expect(
      parseSheetPopoutLocation({ search: "?sheet=from-query", hash: "#popout/sheet/from-hash" }),
    ).toBe("from-query")
  })

  it("ignores unrelated hashes (incl. the module pop-out route)", () => {
    expect(parseSheetPopoutCategoryId("#popout/module/m1")).toBeNull()
    expect(parseSheetPopoutCategoryId("#some/other")).toBeNull()
    expect(parseSheetPopoutCategoryId("")).toBeNull()
    expect(parseSheetPopoutCategoryId(null)).toBeNull()
  })
})

