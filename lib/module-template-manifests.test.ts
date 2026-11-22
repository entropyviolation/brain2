/**
 * Every template has a manifest, and each manifest states what the build makes.
 * If a builder adds a list, a view, or a workflow, this fails until the
 * manifest says so.
 */
import { describe, expect, it } from "vitest"
import { MODULE_TEMPLATES } from "@/lib/module-templates"
import { buildModuleTemplate } from "@/lib/module-templates"
import { manifestDebt, manifestGaps } from "@/lib/module-manifest"
import { manifestForModule, templateManifest } from "@/lib/module-template-manifests"

describe("template manifests", () => {
  it.each(MODULE_TEMPLATES.map((t) => t.id))("%s matches its build", (id) => {
    const manifest = templateManifest(id)
    expect(manifest.id).toBe(id)
    expect(manifestGaps(manifest, buildModuleTemplate(id, 1))).toEqual([])
  })

  it("is a recipe for Budget and Book Tasting, a declaration for the rest", () => {
    const recipes = MODULE_TEMPLATES.filter((t) => !templateManifest(t.id).nativeTemplate).map((t) => t.id)
    expect(recipes.sort()).toEqual(["book-tasting", "budget"])
  })

  it("counts the private stores still on the books", () => {
    const debt = Object.fromEntries(
      MODULE_TEMPLATES.map((t) => [t.id, manifestDebt(templateManifest(t.id)).map((g) => `${g.where}:${g.keys.join(",")}`)]),
    )
    expect(debt).toEqual({
      itinerary: ["module.config:tripItinerary"],
      "house-cleaning": ["module.config:houseCleaning"],
      budget: [],
      "book-tasting": [],
      filmrecs: [],
      gradsearch: ["localStorage:gs-*"],
      sweep: [],
      speedread: ["localStorage:brain2-speed-read,brain2-speed-read-open"],
      blank: [],
    })
  })

  it("finds the manifest for a stored workspace", () => {
    expect(manifestForModule({ templateId: "budget" })?.id).toBe("budget")
    expect(manifestForModule({ templateId: "gone" })).toBeUndefined()
    expect(manifestForModule({})).toBeUndefined()
  })

  it("names a gap in plain words", () => {
    const built = buildModuleTemplate("blank", 1)
    built.lists[0].name = "Other"
    expect(manifestGaps(templateManifest("blank"), built)[0]).toBe('list "Other" is built but is not a slot')
  })
})
