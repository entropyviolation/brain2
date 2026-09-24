/**
 * One-shot: write docs/BIM_COMMANDS.md from the live catalog.
 * Run: npx vitest run lib/ingest/write-bim-commands-doc.test.ts
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { BIM_COMMAND_CATALOG, catalogMarkdown } from "./command-catalog"

describe("docs/BIM_COMMANDS.md", () => {
  it("writes the complete catalog markdown", () => {
    const md = catalogMarkdown()
    writeFileSync(join(process.cwd(), "docs/BIM_COMMANDS.md"), md)
    expect(md).toContain("BIM command catalog")
    expect(md).toContain("`groc`")
    expect(md).toContain("`add`")
    expect(md).toContain("`bulk`")
    expect(md).toContain("retired")
    expect(BIM_COMMAND_CATALOG.length).toBeGreaterThan(50)
  })
})
