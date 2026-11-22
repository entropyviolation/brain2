import { describe, expect, it } from "vitest"
import { crewFor } from "./crew"
import { residentCrew } from "./chat-models"
import { keepAliveFor } from "./ollama"

describe("the chat crew stays resident", () => {
  const all = ["qwen2.5:3b-instruct", "qwen2.5:14b-instruct", "qwen3:30b-a3b"]

  it("leaves the 30B out of every chat ladder, so it never pushes the 3B and 14B out", () => {
    const crew = residentCrew(crewFor(all))!
    for (const role of ["route", "gate", "pick", "extract", "prose", "check", "critic"] as const) expect(crew[role]).not.toContain("qwen3:30b-a3b")
    expect(crew.prose).toEqual(["qwen2.5:14b-instruct"])
    expect(crew.main).toBe("qwen2.5:14b-instruct")
  })

  it("keeps the 30B when it is the chosen main model or the only one", () => {
    expect(residentCrew(crewFor(all, "qwen3:30b-a3b"))!.prose).toContain("qwen3:30b-a3b")
    expect(residentCrew(crewFor(["qwen3:30b-a3b"]))!.prose).toEqual(["qwen3:30b-a3b"])
  })

  it("keeps the 3B router loaded for good, the rest for 15 minutes", () => {
    expect(keepAliveFor("qwen2.5:3b-instruct")).toBe(-1)
    expect(keepAliveFor("qwen2.5:14b-instruct")).toBe("15m")
  })
})
