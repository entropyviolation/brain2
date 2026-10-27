/**
 * lib/module-package.ts — Installable module package (create-only)
 *
 * A package is JSON beside the built-in templates. `parseModulePackage` only
 * reads it. `installModulePackage` mints new lists and a new workspace, or,
 * when `nativeTemplate` is set, commits `buildModuleTemplate` unchanged.
 *
 * The builder's Install package control calls this for create-only files and
 * for `nativeTemplate`. A bind file is scored in the dialog and is not passed
 * here. Template cards still call `instantiateModuleTemplate`. This file does
 * not scan or rewrite lists that already exist, and it does not read or write
 * `houseCleaning` or `tripItinerary`.
 *
 * View kinds stay the ones `ModuleViewBody` already renders
 * (`components/Modules/workspace/module-view-bodies.tsx`). `package-app` is
 * the sandboxed folder for a new package. It does not replace a compiled view.
 */
import type { AttributeDefinition, AttributeType, List, WorkflowDefinition } from "@/lib/types"
import type { ModuleInstance, ModulePackageConfig, ModuleView, ModuleViewConfig, ModuleViewKind } from "@/lib/modules-store"
import { useModulesStore } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { addModuleCreatedLists, taskStoreModuleListsMutators } from "@/lib/module-lists"
import { buildModuleTemplate, MODULE_TEMPLATES, type BuiltModuleTemplate, type ModuleTemplateId } from "@/lib/module-templates"

/** Kinds the workspace view switch already mounts. Subset of `ModuleViewKind`. */
export const RENDERED_MODULE_VIEW_KINDS = [
  "spreadsheet",
  "checklist",
  "agenda",
  "summary",
  "randomizer",
  "timer",
  "stat",
  "gallery",
  "notes",
  "doc",
  "itinerary-doc",
  "trip-map",
  "film-dna",
  "house-cleaning",
  "grad-search",
  "html",
  "package-app",
  "decision-matrix",
  "kanban",
  "timeline",
  "matcher",
  "quiz",
  "dashboard",
] as const satisfies readonly ModuleViewKind[]

const RENDERED_KIND_SET = new Set<string>(RENDERED_MODULE_VIEW_KINDS)

export function isRenderedModuleViewKind(kind: string): kind is ModuleViewKind {
  return RENDERED_KIND_SET.has(kind)
}

/** The only slot policy this installer accepts. Bind is not implemented. */
export type ModulePackageSlotPolicy = "create"

/**
 * One list the package creates. List-id fields on attributes (`refListId`,
 * `optionListId`) name a slot role, not a list that already exists.
 */
export interface ModulePackageSlot {
  role: string
  /** List name. */
  name: string
  policy: ModulePackageSlotPolicy
  attributes?: AttributeDefinition[]
  /** Default item type id stamped on the new list. */
  itemType?: string
  description?: string
  color?: string
  icon?: string
  itemLabel?: string
  displayedAttributes?: string[]
  defaultAttributeValues?: List["defaultAttributeValues"]
}

/**
 * A view whose list ids are slot roles. `slot` is the source list
 * (`categoryId`). The same role strings go in `config` wherever
 * `ModuleViewConfig` stores a list id.
 */
export interface ModulePackageView {
  title: string
  kind: ModuleViewKind
  slot?: string
  config?: ModuleViewConfig
}

/**
 * A workflow whose list ids are slot roles: `scope.listIds`, and
 * `categoryId` / `fromCategoryId` on actions. Install mints a new id and
 * sets `moduleId`.
 */
export type ModulePackageWorkflow = Omit<WorkflowDefinition, "id" | "moduleId"> & {
  id?: string
  moduleId?: string
}

export interface ModulePackage {
  id: string
  name: string
  version: string
  description?: string
  slots: ModulePackageSlot[]
  views: ModulePackageView[]
  workflows?: ModulePackageWorkflow[]
  /**
   * When set, install ignores `slots`, `views`, and `workflows` and commits
   * `buildModuleTemplate(nativeTemplate)` with no package fields added.
   */
  nativeTemplate?: ModuleTemplateId
}

export class ModulePackageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModulePackageError"
  }
}

const PACKAGE_KEYS = new Set(["id", "name", "version", "description", "slots", "views", "workflows", "nativeTemplate"])

const SLOT_KEYS = new Set([
  "role",
  "name",
  "policy",
  "attributes",
  "itemType",
  "description",
  "color",
  "icon",
  "itemLabel",
  "displayedAttributes",
  "defaultAttributeValues",
])

const ATTRIBUTE_TYPES = new Set<AttributeType>([
  "string",
  "boolean",
  "color",
  "datetime",
  "list",
  "multistring",
  "number",
  "selection",
  "image",
  "multiimage",
  "file",
  "multifile",
  "item",
  "link",
  "phone",
  "goal",
  "formula",
])

const ATTRIBUTE_KEYS = new Set([
  "id",
  "name",
  "type",
  "options",
  "unit",
  "labels",
  "formula",
  "formatAs",
  "refListId",
  "booleanDisplay",
  "allowFloat",
  "allowMultiple",
  "optionSource",
  "optionListId",
  "datetimeMode",
  "createdAt",
])

const VIEW_KEYS = new Set(["title", "kind", "slot", "config"])

const VIEW_CONFIG_KEYS = new Set([
  "categoryId",
  "filterAttrId",
  "filterValue",
  "groupAttrId",
  "valueAttrId",
  "dateAttrId",
  "pickCount",
  "framing",
  "timerMinutes",
  "stat",
  "notesKey",
  "criteria",
  "statusAttrId",
  "sheetConfig",
  "timeAttrId",
  "matchTargetCategoryId",
  "matchTextAttrId",
  "linkRelation",
  "matchThreshold",
  "quizSourceCategoryId",
  "fileAttrId",
  "quizChoiceCount",
  "cards",
  "docId",
  "checklistStyle",
  "daysCategoryId",
  "flightsCategoryId",
  "entriesCategoryId",
  "placesCategoryId",
  "htmlDocId",
  "htmlListIds",
  "htmlCanWrite",
  "packageAppId",
])

const LIST_ROLE_FIELDS = [
  "categoryId",
  "matchTargetCategoryId",
  "quizSourceCategoryId",
  "daysCategoryId",
  "flightsCategoryId",
  "entriesCategoryId",
  "placesCategoryId",
] as const satisfies readonly (keyof ModuleViewConfig)[]

const WORKFLOW_KEYS = new Set(["id", "name", "moduleId", "scope", "trigger", "conditions", "actions", "enabled"])

const SLOT_COLORS = ["#64748b", "#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#b45309"]

type JsonRecord = Record<string, unknown>

function fail(message: string): never {
  throw new ModulePackageError(message)
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

/** Reject functions and anything else JSON cannot hold. */
function assertJson(value: unknown, path: string): void {
  if (value === null) return
  const t = typeof value
  if (t === "string" || t === "boolean") return
  if (t === "number") {
    if (!Number.isFinite(value)) fail(`${path} is not JSON (number)`)
    return
  }
  if (t === "function") fail(`${path} contains a function`)
  if (t !== "object") fail(`${path} is not JSON (${t})`)
  if (Array.isArray(value)) {
    value.forEach((entry, i) => assertJson(entry, `${path}[${i}]`))
    return
  }
  if (!isRecord(value)) fail(`${path} is not a plain object`)
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue
    if (key === "__proto__" || key === "constructor" || key === "prototype") fail(`${path} contains "${key}"`)
    assertJson(entry, path ? `${path}.${key}` : key)
  }
}

function assertKnownKeys(obj: JsonRecord, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(`${path} has unknown field "${key}"`)
  }
}

export function reqString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${path} must be a non-empty string`)
  return value.trim()
}

function optString(value: unknown, path: string): string | undefined {
  if (value == null) return undefined
  if (typeof value !== "string") fail(`${path} must be a string`)
  return value
}

function decode(input: unknown): unknown {
  if (typeof input !== "string") return input
  try {
    return JSON.parse(input) as unknown
  } catch {
    fail("Module package JSON could not be parsed")
  }
}

function templateId(value: unknown): ModuleTemplateId | undefined {
  if (value == null) return undefined
  if (typeof value !== "string" || !MODULE_TEMPLATES.some((t) => t.id === value)) {
    fail(`nativeTemplate "${String(value)}" is not a module template`)
  }
  return value as ModuleTemplateId
}

function parseAttribute(raw: unknown, path: string): AttributeDefinition {
  if (!isRecord(raw)) fail(`${path} must be an object`)
  assertKnownKeys(raw, ATTRIBUTE_KEYS, path)
  const id = reqString(raw.id, `${path}.id`)
  const name = reqString(raw.name, `${path}.name`)
  if (typeof raw.type !== "string" || !ATTRIBUTE_TYPES.has(raw.type as AttributeType)) {
    fail(`${path}.type is not an attribute type`)
  }
  if (raw.options != null && (!Array.isArray(raw.options) || raw.options.some((o) => typeof o !== "string"))) {
    fail(`${path}.options must be strings`)
  }
  return raw as unknown as AttributeDefinition
}

function parseSlot(raw: unknown, path: string, seen: Set<string>): ModulePackageSlot {
  if (!isRecord(raw)) fail(`${path} must be an object`)
  assertKnownKeys(raw, SLOT_KEYS, path)
  if (typeof raw.role !== "string" || raw.role.trim() === "") fail(`${path} lacks a role`)
  const role = raw.role.trim()
  if (seen.has(role)) fail(`${path} repeats role "${role}"`)
  seen.add(role)
  if (raw.policy !== "create") fail(`${path} policy must be "create"`)
  const attributes = raw.attributes == null ? undefined : parseAttributes(raw.attributes, `${path}.attributes`)
  const displayed = raw.displayedAttributes == null ? undefined : stringList(raw.displayedAttributes, `${path}.displayedAttributes`)
  if (displayed) {
    const ids = new Set((attributes ?? []).map((a) => a.id))
    for (const id of displayed) {
      if (!ids.has(id)) fail(`${path}.displayedAttributes names unknown attribute "${id}"`)
    }
  }
  if (raw.defaultAttributeValues != null && !isRecord(raw.defaultAttributeValues)) {
    fail(`${path}.defaultAttributeValues must be an object`)
  }
  return {
    role,
    name: reqString(raw.name, `${path}.name`),
    policy: "create",
    attributes,
    itemType: raw.itemType == null ? undefined : reqString(raw.itemType, `${path}.itemType`),
    description: optString(raw.description, `${path}.description`),
    color: raw.color == null ? undefined : reqString(raw.color, `${path}.color`),
    icon: optString(raw.icon, `${path}.icon`),
    itemLabel: raw.itemLabel == null ? undefined : reqString(raw.itemLabel, `${path}.itemLabel`),
    displayedAttributes: displayed,
    defaultAttributeValues: raw.defaultAttributeValues == null
      ? undefined
      : (raw.defaultAttributeValues as List["defaultAttributeValues"]),
  }
}

function parseAttributes(raw: unknown, path: string): AttributeDefinition[] {
  if (!Array.isArray(raw)) fail(`${path} must be an array`)
  const seen = new Set<string>()
  return raw.map((entry, i) => {
    const attr = parseAttribute(entry, `${path}[${i}]`)
    if (seen.has(attr.id)) fail(`${path} repeats attribute "${attr.id}"`)
    seen.add(attr.id)
    return attr
  })
}

function stringList(raw: unknown, path: string): string[] {
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    fail(`${path} must be non-empty strings`)
  }
  return raw.map((entry) => (entry as string).trim())
}

function parseView(raw: unknown, path: string): ModulePackageView {
  if (!isRecord(raw)) fail(`${path} must be an object`)
  assertKnownKeys(raw, VIEW_KEYS, path)
  const kind = reqString(raw.kind, `${path}.kind`)
  if (!isRenderedModuleViewKind(kind)) fail(`${path} view kind "${kind}" is not rendered`)
  const title = reqString(raw.title, `${path}.title`)
  const slot = raw.slot == null ? undefined : reqString(raw.slot, `${path}.slot`)
  let config: ModuleViewConfig | undefined
  if (raw.config != null) {
    if (!isRecord(raw.config)) fail(`${path}.config must be an object`)
    assertKnownKeys(raw.config, VIEW_CONFIG_KEYS, `${path}.config`)
    config = raw.config as ModuleViewConfig
  }
  return { title, kind, slot, config }
}

function parseWorkflow(raw: unknown, path: string): ModulePackageWorkflow {
  if (!isRecord(raw)) fail(`${path} must be an object`)
  assertKnownKeys(raw, WORKFLOW_KEYS, path)
  if (!isRecord(raw.trigger)) fail(`${path}.trigger must be an object`)
  if (!Array.isArray(raw.actions)) fail(`${path}.actions must be an array`)
  return raw as unknown as ModulePackageWorkflow & { name: string }
}

function parseSlots(raw: unknown): ModulePackageSlot[] {
  if (!Array.isArray(raw)) fail("package.slots must be an array")
  const seen = new Set<string>()
  return raw.map((entry, i) => parseSlot(entry, `package.slots[${i}]`, seen))
}

function parseViews(raw: unknown): ModulePackageView[] {
  if (!Array.isArray(raw)) fail("package.views must be an array")
  return raw.map((entry, i) => parseView(entry, `package.views[${i}]`))
}

function parseWorkflows(raw: unknown): ModulePackageWorkflow[] | undefined {
  if (raw == null) return undefined
  if (!Array.isArray(raw)) fail("package.workflows must be an array")
  return raw.map((entry, i) => {
    const wf = parseWorkflow(entry, `package.workflows[${i}]`)
    wf.name = reqString(wf.name, `package.workflows[${i}].name`)
    return wf
  })
}

/**
 * Read a package from a JSON string or a plain object.
 * When `nativeTemplate` is set, slots, views, and workflows are dropped:
 * install ignores that recipe.
 */
export function parseModulePackage(input: unknown): ModulePackage {
  const raw = decode(input)
  assertJson(raw, "package")
  if (!isRecord(raw)) fail("package must be an object")
  assertKnownKeys(raw, PACKAGE_KEYS, "package")
  const id = reqString(raw.id, "package.id")
  const name = reqString(raw.name, "package.name")
  const version = reqString(raw.version, "package.version")
  const description = optString(raw.description, "package.description")
  const nativeTemplate = templateId(raw.nativeTemplate)
  if (nativeTemplate) {
    return { id, name, version, description, nativeTemplate, slots: [], views: [] }
  }
  return {
    id,
    name,
    version,
    description,
    slots: parseSlots(raw.slots),
    views: parseViews(raw.views),
    workflows: parseWorkflows(raw.workflows),
  }
}

export function makeIds(): (suffix: string) => string {
  const seed = Date.now().toString(36)
  let n = 0
  return (suffix: string) => `pkg-${seed}-${(n++).toString(36)}-${suffix}`
}

export function resolveRole(role: string, slots: Map<string, string>, path: string): string {
  const id = slots.get(role)
  if (!id) fail(`${path} names unknown slot "${role}"`)
  return id
}

function resolveAttributes(attrs: AttributeDefinition[] | undefined, slots: Map<string, string>, path: string): AttributeDefinition[] | undefined {
  if (!attrs) return undefined
  return attrs.map((attr, i) => {
    const next = { ...attr }
    if (next.refListId) next.refListId = resolveRole(next.refListId, slots, `${path}[${i}].refListId`)
    if (next.optionListId) next.optionListId = resolveRole(next.optionListId, slots, `${path}[${i}].optionListId`)
    return next
  })
}

export function resolveViewConfig(config: ModuleViewConfig, slots: Map<string, string>, path: string): ModuleViewConfig {
  const next: ModuleViewConfig = { ...config }
  for (const key of LIST_ROLE_FIELDS) {
    const value = next[key]
    if (value == null || value === "") continue
    if (typeof value !== "string") fail(`${path}.${key} must be a slot role`)
    next[key] = resolveRole(value, slots, `${path}.${key}`)
  }
  if (next.htmlListIds) {
    if (!Array.isArray(next.htmlListIds)) fail(`${path}.htmlListIds must be slot roles`)
    next.htmlListIds = next.htmlListIds.map((role, i) => {
      if (typeof role !== "string") fail(`${path}.htmlListIds[${i}] must be a slot role`)
      return resolveRole(role, slots, `${path}.htmlListIds[${i}]`)
    })
  }
  if (next.cards) {
    next.cards = next.cards.map((card, i) => {
      if (typeof card.categoryId !== "string") fail(`${path}.cards[${i}].categoryId must be a slot role`)
      const subtract = card.subtract
        ? {
            ...card.subtract,
            categoryId:
              typeof card.subtract.categoryId === "string"
                ? resolveRole(card.subtract.categoryId, slots, `${path}.cards[${i}].subtract.categoryId`)
                : fail(`${path}.cards[${i}].subtract.categoryId must be a slot role`),
          }
        : undefined
      return {
        ...card,
        categoryId: resolveRole(card.categoryId, slots, `${path}.cards[${i}].categoryId`),
        subtract,
      }
    })
  }
  return next
}

function resolveWorkflow(
  wf: ModulePackageWorkflow,
  slots: Map<string, string>,
  moduleId: string,
  uid: (suffix: string) => string,
  index: number,
): WorkflowDefinition {
  const copy = JSON.parse(JSON.stringify(wf)) as ModulePackageWorkflow
  const actions = copy.actions.map((action, i) => {
    if (!action || typeof action !== "object") fail(`package.workflows[${index}].actions[${i}] must be an object`)
    const next = { ...action } as WorkflowDefinition["actions"][number] & { categoryId?: string; fromCategoryId?: string }
    if (typeof next.categoryId === "string") {
      next.categoryId = resolveRole(next.categoryId, slots, `package.workflows[${index}].actions[${i}].categoryId`)
    }
    if (typeof next.fromCategoryId === "string") {
      next.fromCategoryId = resolveRole(next.fromCategoryId, slots, `package.workflows[${index}].actions[${i}].fromCategoryId`)
    }
    return next
  })
  const scope = copy.scope
    ? {
        ...copy.scope,
        listIds: copy.scope.listIds?.map((role, i) =>
          resolveRole(role, slots, `package.workflows[${index}].scope.listIds[${i}]`),
        ),
      }
    : undefined
  return { ...copy, id: uid("wf"), moduleId, scope, actions }
}

function buildCreate(pkg: ModulePackage, uid: (suffix: string) => string): { module: ModuleInstance; lists: List[]; workflows: WorkflowDefinition[] } {
  for (const view of pkg.views) {
    if (!isRenderedModuleViewKind(view.kind)) fail(`view kind "${view.kind}" is not rendered`)
  }
  const moduleId = uid("module")
  const slotIds = new Map<string, string>()
  for (const slot of pkg.slots) slotIds.set(slot.role, uid("list"))
  const lists: List[] = pkg.slots.map((slot, i) => {
    const id = slotIds.get(slot.role)!
    const attributes = resolveAttributes(slot.attributes, slotIds, `package.slots[${i}].attributes`)
    return {
      id,
      name: slot.name,
      color: slot.color ?? SLOT_COLORS[i % SLOT_COLORS.length],
      description: slot.description,
      createdAt: new Date(),
      scheduleable: false,
      icon: slot.icon,
      itemLabel: slot.itemLabel ?? "item",
      itemTypeId: slot.itemType,
      itemTypeIds: slot.itemType ? [slot.itemType] : undefined,
      itemAttributes: attributes,
      displayedAttributes: slot.displayedAttributes ?? attributes?.map((a) => a.id),
      defaultAttributeValues: slot.defaultAttributeValues,
      createdByModuleId: moduleId,
      moduleSlotId: slot.role,
    }
  })
  const views: ModuleView[] = pkg.views.map((view) => {
    const config: ModuleViewConfig = { ...(view.config ?? {}) }
    if (view.slot) {
      if (config.categoryId && config.categoryId !== view.slot) {
        fail(`view "${view.title}" slot "${view.slot}" does not match categoryId "${config.categoryId}"`)
      }
      config.categoryId = view.slot
    }
    return {
      id: uid("view"),
      title: view.title,
      kind: view.kind,
      config: resolveViewConfig(config, slotIds, `view "${view.title}"`),
    }
  })
  const packageConfig: ModulePackageConfig = {
    id: pkg.id,
    version: pkg.version,
    slots: Object.fromEntries(slotIds),
  }
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: pkg.name,
    description: pkg.description,
    config: { package: packageConfig },
    views,
  }
  const workflows = (pkg.workflows ?? []).map((wf, i) => resolveWorkflow(wf, slotIds, moduleId, uid, i))
  return { module, lists, workflows }
}

function commitBuilt(built: BuiltModuleTemplate): void {
  const taskStore = useTaskStore.getState()
  addModuleCreatedLists(taskStoreModuleListsMutators(), built.module, built.lists)
  for (const task of built.seedTasks) taskStore.addTask(task)
  useModulesStore.getState().addModuleInstance(built.module)
  for (const workflow of built.workflows ?? []) useWorkflowsStore.getState().addWorkflowDefinition(workflow)
}

/**
 * Install a package.
 *
 * Returns the new module id.
 *
 * Create-only: every slot mints a new list (`createdByModuleId`, `moduleSlotId`)
 * and the instance stores `config.package`. No existing list is read or
 * rewritten. `houseCleaning` and `tripItinerary` are not touched.
 *
 * When `nativeTemplate` is set, the rest of the recipe is ignored and this
 * commits `buildModuleTemplate(id)` unchanged: no `config.package`, no
 * `moduleSlotId`. It does not call `syncModuleListContents` (that stays on
 * `instantiateModuleTemplate`).
 */
export function installModulePackage(input: unknown): string {
  const pkg = parseModulePackage(input)
  if (pkg.nativeTemplate) {
    const built = buildModuleTemplate(pkg.nativeTemplate)
    commitBuilt(built)
    return built.module.id
  }
  const draft = buildCreate(pkg, makeIds())
  commitBuilt({ lists: draft.lists, seedTasks: [], module: draft.module, workflows: draft.workflows })
  return draft.module.id
}
