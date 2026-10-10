import { describe, expect, it } from "vitest"
import { quickAddLogIntent } from "./quick-add-log"

describe("quickAddLogIntent", () => {
  it("treats a leading log: as the tracking log", () => {
    expect(quickAddLogIntent("log: left room")?.kind).toBe("event-log")
    expect(quickAddLogIntent("log: left room")?.payload).toBe("left room")
  })

  it("leaves a folder path that names a list log as capture", () => {
    expect(quickAddLogIntent("next actions: log: buy milk")).toBeNull()
  })

  it("stays off when Plain is on", () => {
    expect(quickAddLogIntent("log: left room", true)).toBeNull()
  })
})
