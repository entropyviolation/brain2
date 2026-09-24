import { describe, expect, it } from "vitest"
import { parseLsofFpc, reclaimablePids } from "@/scripts/dev-port.mjs"

describe("parseLsofFpc", () => {
  it("reads pid/command pairs from lsof -Fpc", () => {
    expect(parseLsofFpc("p7801\ncnode\n")).toEqual([{ pid: 7801, command: "node" }])
  })
})

describe("reclaimablePids", () => {
  it("returns leftover Next/node pids", () => {
    expect(reclaimablePids([{ pid: 7801, command: "node" }])).toEqual([7801])
  })

  it("refuses a mixed or foreign listener", () => {
    expect(
      reclaimablePids([
        { pid: 1, command: "node" },
        { pid: 2, command: "Python" },
      ]),
    ).toBeNull()
    expect(reclaimablePids([{ pid: 9, command: "nginx" }])).toBeNull()
  })

  it("is a no-op when nothing is listening", () => {
    expect(reclaimablePids([])).toEqual([])
  })
})
