/**
 * module-popout — path + hash round-trip for the module pop-out window.
 */
import { describe, expect, it } from "vitest"
import {
  modulePopoutHash,
  modulePopoutPath,
  parseModulePopoutFromSearch,
  parseModulePopoutLocation,
  parseModulePopoutModuleId,
} from "./module-popout"

describe("module pop-out routing", () => {
  it("round-trips a module id via the /popout/ query", () => {
    expect(parseModulePopoutFromSearch(modulePopoutPath("m1").split("?")[1])).toBe("m1")
  })

  it("round-trips a module id via the legacy hash", () => {
    expect(parseModulePopoutModuleId(modulePopoutHash("m1"))).toBe("m1")
  })

  it("encodes ids with reserved characters", () => {
    const id = "mod/with spaces?&"
    expect(parseModulePopoutFromSearch(modulePopoutPath(id).split("?")[1])).toBe(id)
    expect(parseModulePopoutModuleId(modulePopoutHash(id))).toBe(id)
  })

  it("prefers the query string over a leftover hash", () => {
    expect(
      parseModulePopoutLocation({ search: "?module=from-query", hash: "#popout/module/from-hash" }),
    ).toBe("from-query")
  })

  it("falls back to the hash when the query is empty", () => {
    expect(parseModulePopoutLocation({ search: "", hash: "#popout/module/m1" })).toBe("m1")
  })

  it("ignores unrelated hashes", () => {
    expect(parseModulePopoutModuleId("#popout/sheet/list-1")).toBeNull()
    expect(parseModulePopoutModuleId("#some/other")).toBeNull()
    expect(parseModulePopoutModuleId("")).toBeNull()
    expect(parseModulePopoutModuleId(null)).toBeNull()
  })
})
