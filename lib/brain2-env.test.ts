import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const { brain2Env, brain2EnvLine } = createRequire(import.meta.url)("./brain2-env.cjs")

describe("brain2Env", () => {
  it("prefers BRAIN2_ and still reads COGS_", () => {
    expect(brain2Env("CAPTURE_TOKEN", { BRAIN2_CAPTURE_TOKEN: "new", COGS_CAPTURE_TOKEN: "old" })).toBe("new")
    expect(brain2Env("CAPTURE_TOKEN", { COGS_CAPTURE_TOKEN: "old" })).toBe("old")
    expect(brain2Env("CAPTURE_TOKEN", { BRAIN2_CAPTURE_TOKEN: "", COGS_CAPTURE_TOKEN: "old" })).toBe("old")
    expect(brain2Env("CAPTURE_TOKEN", {})).toBeUndefined()
  })

  it("reads either name from an env file", () => {
    expect(brain2EnvLine("BRAIN2_TELEGRAM_BOT_TOKEN=abc\n", "TELEGRAM_BOT_TOKEN")).toBe("abc")
    expect(brain2EnvLine("COGS_TELEGRAM_BOT_TOKEN=legacy\n", "TELEGRAM_BOT_TOKEN")).toBe("legacy")
    expect(brain2EnvLine('BRAIN2_CAPTURE_TOKEN="q"\nCOGS_CAPTURE_TOKEN=no\n', "CAPTURE_TOKEN")).toBe("q")
  })
})