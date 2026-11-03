/**
 * Golden recipes for Budget and Book Tasting.
 *
 * Each file is a full package (slots, views, workflows), parsed with
 * `parseModulePackage` and compared to `buildModuleTemplate(..., 1)`.
 * Generated ids (`tmpl-1-…`, module ids, view ids, workflow ids, dashboard
 * card ids) are dropped; list ids in views and workflows are slot roles.
 *
 * Seed items and `templateId` are outside this schema, so they are not compared.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import type { DashboardCard, ModuleView, ModuleViewConfig } from "@/lib/modules-store"
import type { WorkflowDefinition } from "@/lib/types"
import { parseModulePackage, type ModulePackage, type ModulePackageView, type ModulePackageWorkflow } from "@/lib/module-package"
import { buildModuleTemplate, type BuiltModuleTemplate, type ModuleTemplateId } from "@/lib/module-templates"

function loadGolden(name: string): string {
  return readFileSync(join(__dirname, "packages", "golden", `${name}.json`), "utf8")
}

function dropUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => dropUndefined(entry)) as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue
      out[key] = dropUndefined(entry)
    }
    return out as T
  }
  return value
}

function roleByListId(built: BuiltModuleTemplate, pkg: ModulePackage): Map<string, string> {
  const roles = new Map<string, string>()
  built.lists.forEach((list, i) => {
    const slot = pkg.slots[i]
    if (slot && list.id) roles.set(list.id, slot.role)
  })
  return roles
}

function roleFor(id: string, roles: Map<string, string>): string {
  return roles.get(id) ?? id
}

/** Dashboard card ids are minted per build; the recipe keeps stable ids. */
function cardsWithoutIds(cards: DashboardCard[] | undefined, roles?: Map<string, string>): Array<Omit<DashboardCard, "id">> | undefined {
  if (!cards) return undefined
  return cards.map((card) => {
    const categoryId = roles ? roleFor(card.categoryId, roles) : card.categoryId
    const subtract = card.subtract
      ? {
          ...card.subtract,
          categoryId: roles ? roleFor(card.subtract.categoryId, roles) : card.subtract.categoryId,
        }
      : undefined
    return dropUndefined({
      label: card.label,
      categoryId,
      attrId: card.attrId,
      fn: card.fn,
      includeAttrId: card.includeAttrId,
      unit: card.unit,
      subtract,
    })
  })
}

function configWithRoles(config: ModuleViewConfig, roles: Map<string, string>): ModuleViewConfig {
  const next: ModuleViewConfig = { ...config }
  const listKeys = [
    "categoryId",
    "matchTargetCategoryId",
    "quizSourceCategoryId",
    "daysCategoryId",
    "flightsCategoryId",
    "entriesCategoryId",
    "placesCategoryId",
  ] as const
  for (const key of listKeys) {
    const value = next[key]
    if (typeof value === "string") next[key] = roleFor(value, roles)
  }
  if (next.cards) next.cards = cardsWithoutIds(next.cards, roles) as DashboardCard[]
  return dropUndefined(next)
}

function viewFromBuilt(view: ModuleView, roles: Map<string, string>): ModulePackageView {
  const config = configWithRoles(view.config, roles)
  const slot = view.config.categoryId ? roleFor(view.config.categoryId, roles) : undefined
  return dropUndefined({ title: view.title, kind: view.kind, slot, config })
}

function viewFromPackage(view: ModulePackageView): ModulePackageView {
  const config = view.config
    ? dropUndefined({
        ...view.config,
        cards: cardsWithoutIds(view.config.cards) as DashboardCard[] | undefined,
      })
    : undefined
  return dropUndefined({ title: view.title, kind: view.kind, slot: view.slot, config })
}

function workflowFromBuilt(wf: WorkflowDefinition, roles: Map<string, string>): ModulePackageWorkflow {
  return dropUndefined({
    name: wf.name,
    scope: wf.scope
      ? { ...wf.scope, listIds: wf.scope.listIds?.map((id) => roleFor(id, roles)) }
      : undefined,
    trigger: wf.trigger,
    conditions: wf.conditions,
    actions: wf.actions.map((action) => {
      const next = { ...action } as WorkflowDefinition["actions"][number] & { categoryId?: string; fromCategoryId?: string }
      if (typeof next.categoryId === "string") next.categoryId = roleFor(next.categoryId, roles)
      if (typeof next.fromCategoryId === "string") next.fromCategoryId = roleFor(next.fromCategoryId, roles)
      return next
    }),
    enabled: wf.enabled,
  })
}

function workflowFromPackage(wf: ModulePackageWorkflow): ModulePackageWorkflow {
  const { id: _id, moduleId: _moduleId, ...rest } = wf
  return dropUndefined(rest)
}

function assertMatches(id: ModuleTemplateId, file: string) {
  const pkg = parseModulePackage(loadGolden(file))
  const built = buildModuleTemplate(id, 1)
  const roles = roleByListId(built, pkg)

  expect(pkg.nativeTemplate).toBeUndefined()
  expect(pkg.id).toBe(id)
  expect(pkg.name).toBe(built.module.title)
  expect(pkg.description).toBe(built.module.description)
  expect(pkg.slots.every((slot) => slot.policy === "create")).toBe(true)

  expect(pkg.slots.map((slot) => slot.name)).toEqual(built.lists.map((list) => list.name))
  expect(pkg.slots.map((slot) => (slot.attributes ?? []).map((attr) => attr.id))).toEqual(
    built.lists.map((list) => (list.itemAttributes ?? []).map((attr) => attr.id)),
  )
  expect(pkg.slots.map((slot) => slot.attributes ?? [])).toEqual(built.lists.map((list) => list.itemAttributes ?? []))
  expect(pkg.slots.map((slot) => slot.displayedAttributes)).toEqual(built.lists.map((list) => list.displayedAttributes))
  expect(pkg.slots.map((slot) => slot.defaultAttributeValues)).toEqual(
    built.lists.map((list) => list.defaultAttributeValues),
  )
  expect(pkg.slots.map((slot) => ({ color: slot.color, description: slot.description, itemLabel: slot.itemLabel }))).toEqual(
    built.lists.map((list) => ({ color: list.color, description: list.description, itemLabel: list.itemLabel })),
  )

  const builtViews = (built.module.views ?? []).map((view) => viewFromBuilt(view, roles))
  const pkgViews = pkg.views.map((view) => viewFromPackage(view))
  expect(pkgViews.map((view) => view.kind)).toEqual(builtViews.map((view) => view.kind))
  expect(pkgViews).toEqual(builtViews)

  const builtWorkflows = (built.workflows ?? []).map((wf) => workflowFromBuilt(wf, roles))
  const pkgWorkflows = (pkg.workflows ?? []).map((wf) => workflowFromPackage(wf))
  expect(pkgWorkflows.map((wf) => wf.name)).toEqual(builtWorkflows.map((wf) => wf.name))
  expect(pkgWorkflows.map((wf) => wf.trigger)).toEqual(builtWorkflows.map((wf) => wf.trigger))
  expect(pkgWorkflows.map((wf) => (wf.actions ?? []).map((action) => action.kind))).toEqual(
    builtWorkflows.map((wf) => wf.actions.map((action) => action.kind)),
  )
  expect(pkgWorkflows).toEqual(builtWorkflows)
}

describe("golden module packages", () => {
  it("budget matches buildModuleTemplate", () => {
    assertMatches("budget", "budget")
  })

  it("book-tasting matches buildModuleTemplate", () => {
    assertMatches("book-tasting", "book-tasting")
  })
})
