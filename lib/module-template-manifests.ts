/**
 * lib/module-template-manifests.ts — One manifest per module template
 *
 * `TEMPLATE_MANIFEST_JSON` is typed by `ModuleTemplateId`, so a new template
 * id does not compile until its manifest is listed here.
 * `lib/module-template-manifests.test.ts` then checks each manifest against
 * what `buildModuleTemplate` makes. A template ships with its capabilities
 * stated, or it does not ship.
 *
 * Budget and Book Tasting are recipes: the same golden JSON their builders
 * read. The rest are declarations beside a compiled builder.
 */
import type { ModuleInstance } from "@/lib/modules-store"
import type { ModuleTemplateId } from "@/lib/module-templates"
import { parseModuleManifest, type ModuleManifest } from "@/lib/module-manifest"
import budget from "@/lib/packages/golden/budget.json"
import bookTasting from "@/lib/packages/golden/book-tasting.json"
import itinerary from "@/lib/packages/manifests/itinerary.json"
import houseCleaning from "@/lib/packages/manifests/house-cleaning.json"
import filmrecs from "@/lib/packages/manifests/filmrecs.json"
import gradsearch from "@/lib/packages/manifests/gradsearch.json"
import sweep from "@/lib/packages/manifests/sweep.json"
import speedread from "@/lib/packages/manifests/speedread.json"
import blank from "@/lib/packages/manifests/blank.json"

const TEMPLATE_MANIFEST_JSON: Record<ModuleTemplateId, unknown> = {
  itinerary,
  "house-cleaning": houseCleaning,
  budget,
  "book-tasting": bookTasting,
  filmrecs,
  gradsearch,
  sweep,
  speedread,
  blank,
}

const parsed = new Map<ModuleTemplateId, ModuleManifest>()

/** The manifest for a template. Parsed on first ask; throws if the JSON is wrong. */
export function templateManifest(id: ModuleTemplateId): ModuleManifest {
  let manifest = parsed.get(id)
  if (!manifest) {
    manifest = parseModuleManifest(TEMPLATE_MANIFEST_JSON[id])
    parsed.set(id, manifest)
  }
  return manifest
}

/** The manifest a stored workspace was built from, when its template still exists. */
export function manifestForModule(module: Pick<ModuleInstance, "templateId">): ModuleManifest | undefined {
  const id = module.templateId
  if (!id || !(id in TEMPLATE_MANIFEST_JSON)) return undefined
  return templateManifest(id as ModuleTemplateId)
}
