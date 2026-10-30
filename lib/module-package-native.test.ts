/**
 * Facade packages for the current templates.
 *
 * Each file names a `nativeTemplate`. Installing one would call
 * `buildModuleTemplate`; this test only parses, so it never writes stores.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseModulePackage } from "@/lib/module-package"
import { MODULE_TEMPLATES, type ModuleTemplateId } from "@/lib/module-templates"

const nativeDir = join(__dirname, "packages", "native")

function loadNative(): { file: string; json: string }[] {
  return readdirSync(nativeDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => ({ file, json: readFileSync(join(nativeDir, file), "utf8") }))
}

describe("native module packages", () => {
  const files = loadNative()

  it("covers every current template", () => {
    const ids = files.map(({ json }) => parseModulePackage(json).nativeTemplate)
    expect(ids).toEqual([...MODULE_TEMPLATES.map((template) => template.id)].sort())
  })

  it.each(files.map(({ file }) => file))("parses %s as that template", (file) => {
    const pkg = parseModulePackage(readFileSync(join(nativeDir, file), "utf8"))
    const template = MODULE_TEMPLATES.find((entry) => entry.id === pkg.nativeTemplate)
    expect(template).toBeDefined()
    expect(pkg.nativeTemplate).toBe(template!.id)
    expect(pkg.name).toBe(template!.name)
    expect(pkg.description).toBe(template!.description)
    expect(pkg.id).toBe(template!.id)
    expect(pkg.version).toBe("1.0.0")
    expect(pkg.slots).toEqual([])
    expect(pkg.views).toEqual([])
  })

  it("names each file after its template id", () => {
    for (const { file, json } of files) {
      const pkg = parseModulePackage(json)
      expect(file).toBe(`${pkg.nativeTemplate}.json`)
      expect(MODULE_TEMPLATES.some((template) => template.id === (pkg.nativeTemplate as ModuleTemplateId))).toBe(true)
    }
  })
})
