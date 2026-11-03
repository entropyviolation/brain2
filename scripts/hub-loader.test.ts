import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The launchd hub loads persist-api through jiti (`scripts/phone-hub.mjs`), which
 * rewrites `import "node:sqlite"` to `sqlite` and fails. Vitest does not go
 * through jiti, so this runs the same loader in a child process.
 */
describe("hub loaded through jiti", () => {
  it("opens the SQLite stores and takes a write", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "jiti-"))
    try {
      const file = path.join(dir, "shared-persist.json")
      writeFileSync(file, JSON.stringify({ items: { "brain2-notes": "{}" } }))
      const root = path.resolve(__dirname, "..")
      const code = `
        const jiti = require(${JSON.stringify(path.join(root, "node_modules/jiti"))})(${JSON.stringify(path.join(root, "scripts/phone-hub.ts"))}, { alias: { "@": ${JSON.stringify(root)} }, interopDefault: true, esmResolve: true })
        const api = jiti(${JSON.stringify(path.join(root, "scripts/persist-api.mjs"))})
        api._resetSharedPersistForTests(${JSON.stringify(file)}, { store: "shadow", rowMirror: true })
        api.upsertSharedPersistItem("brain2-notes", '{"a":1}', "test")
        api.flushSharedPersistSync()
        console.log("loaded")
      `
      const out = execFileSync(process.execPath, ["--no-warnings", "-e", code], { encoding: "utf8", timeout: 60_000 })
      expect(out).toContain("loaded")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
