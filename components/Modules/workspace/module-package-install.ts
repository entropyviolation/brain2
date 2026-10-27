/**
 * components/Modules/workspace/module-package-install.ts — Install-dialog gate
 *
 * Create-only files and `nativeTemplate` files go straight to
 * `installModulePackage`. That path never calls `scoreSlot`.
 *
 * A slot with `policy: "bind"` is scored first. Every such slot must decide
 * `"bind"` or this installs nothing and returns the candidate lists. The
 * scorer does not write. A matched list is referenced as it stands: no
 * `createdByModuleId`, no `moduleSlotId`, no attribute edits. Create slots in
 * the same file still mint new lists.
 */
import type { AttributeDefinition, List, WorkflowDefinition } from "@/lib/types"
import type { ModuleInstance, ModulePackageConfig, ModuleView, ModuleViewConfig } from "@/lib/modules-store"
import { useModulesStore } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { addModuleCreatedLists, taskStoreModuleListsMutators } from "@/lib/module-lists"
import {
  installModulePackage,
  isRenderedModuleViewKind,
  makeIds,
  ModulePackageError,
  reqString,
  resolveRole,
  resolveViewConfig,
  type ModulePackageSlot,
} from "@/lib/module-package"
import { scoreSlot, type SlotScoreDecision } from "@/lib/module-slot-score"

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

const SLOT_COLORS = ["#64748b", "#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#b45309"]

type JsonRecord = Record<string, unknown>

export interface PackageBindCandidate {
  listId: string
  name: string
}

/** One bind slot that did not earn a unique list. Nothing was installed. */
export interface PackageBindBlock {
  slotName: string
  role: string
  decision: Exclude<SlotScoreDecision, "bind"> | "refused"
  candidates: PackageBindCandidate[]
}

export type PackageBindReview =
  | { action: "install" }
  | { action: "stop"; blocks: PackageBindBlock[] }
  | { action: "bound"; raw: JsonRecord; bindings: Record<string, string> }

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function fail(message: string): never {
  throw new ModulePackageError(message)
}

function listName(lists: readonly List[], id: string): string {
  return lists.find((list) => list.id === id)?.name || id
}

function scoreAttributes(raw: unknown): AttributeDefinition[] | undefined {
  if (raw == null) return undefined
  if (!Array.isArray(raw)) return undefined
  const attributes: AttributeDefinition[] = []
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.trim() === "") continue
    const id = entry.id.trim()
    attributes.push({
      id,
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name : id,
      type: "string",
    })
  }
  return attributes
}

/**
 * Decide whether this file may install.
 *
 * `"install"` skips the scorer (create-only, `nativeTemplate`, or not a package
 * object — the installer reports the parse error). `"stop"` means a bind slot
 * was `"ask"`, `"none"`, or refused. `"bound"` means every bind slot chose one
 * list. This function does not write.
 */
export function reviewPackageBind(text: string, lists: readonly List[]): PackageBindReview {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { action: "install" }
  }
  if (!isRecord(raw)) return { action: "install" }
  if (typeof raw.nativeTemplate === "string" && raw.nativeTemplate.trim()) return { action: "install" }
  if (!Array.isArray(raw.slots)) return { action: "install" }

  const bindSlots = raw.slots.filter((slot) => isRecord(slot) && slot.policy === "bind")
  if (bindSlots.length === 0) return { action: "install" }

  const blocks: PackageBindBlock[] = []
  const bindings: Record<string, string> = {}
  const seen = new Set<string>()

  for (const slot of bindSlots) {
    const role = typeof slot.role === "string" ? slot.role.trim() : ""
    const name = typeof slot.name === "string" && slot.name.trim() ? slot.name.trim() : role || "Slot"
    if (!role || seen.has(role)) {
      blocks.push({ slotName: name, role: role || "slot", decision: "refused", candidates: [] })
      continue
    }
    seen.add(role)
    const scored = scoreSlot(lists, {
      role,
      name,
      policy: "bind" as ModulePackageSlot["policy"],
      attributes: scoreAttributes(slot.attributes),
    })
    if (scored.refused || scored.decision !== "bind" || !scored.listId) {
      blocks.push({
        slotName: name,
        role,
        decision: scored.refused ? "refused" : scored.decision === "ask" ? "ask" : "none",
        candidates: scored.candidates.map((candidate) => ({
          listId: candidate.listId,
          name: listName(lists, candidate.listId),
        })),
      })
      continue
    }
    bindings[role] = scored.listId
  }

  if (blocks.length > 0) return { action: "stop", blocks }
  return { action: "bound", raw, bindings }
}

function assertKnownKeys(raw: JsonRecord, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) fail(`${path} has unknown field "${key}"`)
  }
}

function resolveAttributes(
  raw: unknown,
  slots: Map<string, string>,
  path: string,
): AttributeDefinition[] | undefined {
  if (raw == null) return undefined
  if (!Array.isArray(raw)) fail(`${path} must be an array`)
  return raw.map((entry, i) => {
    if (!isRecord(entry)) fail(`${path}[${i}] must be an object`)
    const next = { ...entry } as unknown as AttributeDefinition
    if (typeof next.refListId === "string") {
      next.refListId = resolveRole(next.refListId, slots, `${path}[${i}].refListId`)
    }
    if (typeof next.optionListId === "string") {
      next.optionListId = resolveRole(next.optionListId, slots, `${path}[${i}].optionListId`)
    }
    return next
  })
}

function resolveWorkflow(
  raw: unknown,
  slots: Map<string, string>,
  moduleId: string,
  uid: (suffix: string) => string,
  index: number,
): WorkflowDefinition {
  if (!isRecord(raw)) fail(`package.workflows[${index}] must be an object`)
  const copy = JSON.parse(JSON.stringify(raw)) as JsonRecord
  const actionsRaw = copy.actions
  if (!Array.isArray(actionsRaw)) fail(`package.workflows[${index}].actions must be an array`)
  const actions = actionsRaw.map((action, i) => {
    if (!isRecord(action)) fail(`package.workflows[${index}].actions[${i}] must be an object`)
    const next = { ...action }
    if (typeof next.categoryId === "string") {
      next.categoryId = resolveRole(next.categoryId, slots, `package.workflows[${index}].actions[${i}].categoryId`)
    }
    if (typeof next.fromCategoryId === "string") {
      next.fromCategoryId = resolveRole(
        next.fromCategoryId,
        slots,
        `package.workflows[${index}].actions[${i}].fromCategoryId`,
      )
    }
    return next
  })
  const scopeRaw = isRecord(copy.scope) ? copy.scope : undefined
  const scope = scopeRaw
    ? {
        ...scopeRaw,
        listIds: Array.isArray(scopeRaw.listIds)
          ? scopeRaw.listIds.map((role, i) => {
              if (typeof role !== "string") fail(`package.workflows[${index}].scope.listIds[${i}] must be a slot role`)
              return resolveRole(role, slots, `package.workflows[${index}].scope.listIds[${i}]`)
            })
          : undefined,
      }
    : undefined
  return {
    ...(copy as unknown as WorkflowDefinition),
    id: uid("wf"),
    name: reqString(copy.name, `package.workflows[${index}].name`),
    moduleId,
    scope: scope as unknown as WorkflowDefinition["scope"],
    actions: actions as unknown as WorkflowDefinition["actions"],
  }
}

/**
 * Install a package whose bind slots already resolved to existing lists.
 * Builds the whole module first. Writes only after that succeeds.
 * Existing lists are not passed to `addModuleCreatedLists`.
 */
function commitBoundPackage(raw: JsonRecord, bindings: Record<string, string>, lists: readonly List[]): string {
  assertKnownKeys(raw, PACKAGE_KEYS, "package")
  const name = reqString(raw.name, "package.name")
  const packageId = reqString(raw.id, "package.id")
  const version = reqString(raw.version, "package.version")
  const description = raw.description == null ? undefined : reqString(raw.description, "package.description")
  if (!Array.isArray(raw.slots)) fail("package.slots must be an array")
  if (!Array.isArray(raw.views)) fail("package.views must be an array")

  const uid = makeIds()
  const moduleId = uid("module")
  const slotIds = new Map<string, string>()
  const preexisting = new Set(lists.map((list) => list.id))
  const newLists: List[] = []
  const seen = new Set<string>()
  const slots = raw.slots.map((entry, i) => {
    if (!isRecord(entry)) fail(`package.slots[${i}] must be an object`)
    assertKnownKeys(entry, SLOT_KEYS, `package.slots[${i}]`)
    const role = reqString(entry.role, `package.slots[${i}].role`)
    reqString(entry.name, `package.slots[${i}].name`)
    if (seen.has(role)) fail(`package.slots[${i}] repeats role "${role}"`)
    seen.add(role)
    if (entry.policy === "bind") {
      const listId = bindings[role]
      if (!listId || !preexisting.has(listId)) fail(`package.slots[${i}] has no list to bind`)
      slotIds.set(role, listId)
    } else if (entry.policy === "create") {
      const id = uid("list")
      if (preexisting.has(id)) fail("Refusing to rewrite an existing list.")
      slotIds.set(role, id)
    } else {
      fail(`package.slots[${i}] policy must be "create" or "bind"`)
    }
    return { entry, role, index: i }
  })

  for (const { entry, role, index } of slots) {
    if (entry.policy !== "create") continue
    const id = slotIds.get(role)!
    const attributes = resolveAttributes(entry.attributes, slotIds, `package.slots[${index}].attributes`)
    const displayed = entry.displayedAttributes == null ? undefined : entry.displayedAttributes
    if (displayed != null && (!Array.isArray(displayed) || displayed.some((item) => typeof item !== "string"))) {
      fail(`package.slots[${index}].displayedAttributes must be strings`)
    }
    if (displayed) {
      const ids = new Set((attributes ?? []).map((attr) => attr.id))
      for (const id of displayed as string[]) {
        if (!ids.has(id)) fail(`package.slots[${index}].displayedAttributes names unknown attribute "${id}"`)
      }
    }
    if (entry.defaultAttributeValues != null && !isRecord(entry.defaultAttributeValues)) {
      fail(`package.slots[${index}].defaultAttributeValues must be an object`)
    }
    newLists.push({
      id,
      name: reqString(entry.name, `package.slots[${index}].name`),
      color: typeof entry.color === "string" && entry.color.trim() ? entry.color : SLOT_COLORS[index % SLOT_COLORS.length],
      description: typeof entry.description === "string" ? entry.description : undefined,
      createdAt: new Date(),
      scheduleable: false,
      icon: typeof entry.icon === "string" ? entry.icon : undefined,
      itemLabel: typeof entry.itemLabel === "string" && entry.itemLabel.trim() ? entry.itemLabel : "item",
      itemTypeId: typeof entry.itemType === "string" ? entry.itemType : undefined,
      itemTypeIds: typeof entry.itemType === "string" ? [entry.itemType] : undefined,
      itemAttributes: attributes,
      displayedAttributes: (displayed as string[] | undefined) ?? attributes?.map((attr) => attr.id),
      defaultAttributeValues:
        entry.defaultAttributeValues == null
          ? undefined
          : (entry.defaultAttributeValues as List["defaultAttributeValues"]),
      createdByModuleId: moduleId,
      moduleSlotId: role,
    })
  }

  for (const listId of Object.values(bindings)) {
    if (!preexisting.has(listId)) fail("That list is no longer here.")
  }
  for (const list of newLists) {
    if (preexisting.has(list.id) || Object.values(bindings).includes(list.id)) {
      fail("Refusing to rewrite an existing list.")
    }
  }

  const views: ModuleView[] = raw.views.map((entry, i) => {
    if (!isRecord(entry)) fail(`package.views[${i}] must be an object`)
    const kind = reqString(entry.kind, `package.views[${i}].kind`)
    if (!isRenderedModuleViewKind(kind)) fail(`package.views[${i}] view kind "${kind}" is not rendered`)
    const title = reqString(entry.title, `package.views[${i}].title`)
    const config: ModuleViewConfig = isRecord(entry.config) ? { ...(entry.config as ModuleViewConfig) } : {}
    if (entry.config != null && !isRecord(entry.config)) fail(`package.views[${i}].config must be an object`)
    if (typeof entry.slot === "string" && entry.slot) {
      if (config.categoryId && config.categoryId !== entry.slot) {
        fail(`view "${title}" slot "${entry.slot}" does not match categoryId "${config.categoryId}"`)
      }
      config.categoryId = entry.slot
    }
    return {
      id: uid("view"),
      title,
      kind,
      config: resolveViewConfig(config, slotIds, `view "${title}"`),
    }
  })

  const workflows = Array.isArray(raw.workflows)
    ? raw.workflows.map((wf, i) => resolveWorkflow(wf, slotIds, moduleId, uid, i))
    : raw.workflows == null
      ? []
      : fail("package.workflows must be an array")

  const packageConfig: ModulePackageConfig = {
    id: packageId,
    version,
    slots: Object.fromEntries(slotIds),
  }
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: name,
    description,
    config: { package: packageConfig },
    views,
  }

  if (newLists.length > 0) {
    addModuleCreatedLists(taskStoreModuleListsMutators(), module, newLists)
  }
  useModulesStore.getState().addModuleInstance(module)
  for (const workflow of workflows) useWorkflowsStore.getState().addWorkflowDefinition(workflow)
  return moduleId
}

/**
 * Install `text`, or return the bind slots that stopped the install.
 * A returned array means no module was added and no existing list was written.
 */
export function installReviewedPackage(text: string, lists: readonly List[]): string | PackageBindBlock[] {
  const review = reviewPackageBind(text, lists)
  if (review.action === "stop") return review.blocks
  if (review.action === "install") return installModulePackage(text)
  return commitBoundPackage(review.raw, review.bindings, lists)
}
