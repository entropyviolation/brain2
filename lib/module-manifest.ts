/**
 * lib/module-manifest.ts — Module manifest (rung 2): a package plus its capabilities
 *
 * A manifest is one hand-written JSON object. It is a module package
 * (`lib/module-package.ts`: slots, views, workflows) with two more fields:
 * `manifest: 1`, and `capabilities`. Capabilities say what the module may do
 * to the house: which of its lists it reads and which it writes, and every
 * door it uses past its own lists (`ModuleBridgeGrant`). Nothing is ambient.
 * A slot with no entry in `capabilities.lists` is an error, not a default.
 *
 * Two kinds of manifest:
 * - A **recipe** (no `nativeTemplate`). Slots, views, and workflows are the
 *   whole module. `installModuleManifest` builds it and records the list
 *   access on `config.package.access`.
 * - A **declaration** (`nativeTemplate` set). The compiled builder in
 *   `lib/module-templates.ts` still builds the module. The manifest states
 *   what that builder makes and what the compiled view touches.
 *   `manifestGaps` checks the statement against a build.
 *
 * `parseModuleManifest` only reads. The template manifests live in
 * `lib/module-template-manifests.ts`.
 */
import type { List, WorkflowDefinition } from "@/lib/types"
import type { ModuleView } from "@/lib/modules-store"
import { useModulesStore } from "@/lib/modules-store"
import {
  ModulePackageError,
  installModulePackage,
  parseModulePackage,
  resolveRole,
  resolveViewConfig,
  type ModulePackage,
} from "@/lib/module-package"
import { MODULE_TEMPLATES, type ModuleTemplateId } from "@/lib/module-templates"

export const MODULE_MANIFEST_VERSION = 1

/** What a module may do to the items on one of its lists. Write includes read. */
export type ListAccess = "read" | "write"

/**
 * One door past the module's own lists. Each is a thing the module does today
 * or a door named in `docs/MODULE_PLATFORM.md`.
 */
export type ModuleBridgeGrant =
  /** Items outside its lists, by item type (Speed Read finds or creates a Book). */
  | { bridge: "items"; access: ListAccess; types: string[] }
  /** Mints its own lists at run time, stamped `createdByModuleId`, and writes them (Tidy areas, trip days). */
  | { bridge: "lists"; itemTypes?: string[] }
  /** Authors a note body in Docs. */
  | { bridge: "docs" }
  /** Writes dates into Plan / Scheduler. */
  | { bridge: "schedule" }
  /** Reports `ModuleOutput`s a habit may count (`lib/module-output.ts`). */
  | { bridge: "habits"; measures: string[] }
  /** Reports sessions a Tracking pen may paint (`lib/module-session-apply.ts`). */
  | { bridge: "tracking" }
  /** Awards points on completion. */
  | { bridge: "points" }
  /** Claims a text prefix in ingest. */
  | { bridge: "ingest"; phrases: string[] }
  /** Talks to hosts outside this machine. `*.` matches subdomains. */
  | { bridge: "network"; hosts: string[] }
  /** Uses a desktop or local API door, named by its path. */
  | { bridge: "desktop"; door: string }
  /**
   * Keeps state outside Items. This is debt (law 2 and law 3), stated so it
   * can be counted. Only a compiled template may declare it.
   */
  | { bridge: "private-store"; where: "module.config" | "localStorage"; keys: string[] }

export type ModuleBridgeName = ModuleBridgeGrant["bridge"]

export interface ModuleCapabilities {
  /** Slot role → access. Every slot is listed; no other key is allowed. */
  lists: Record<string, ListAccess>
  /** Doors past its own lists. Empty means none. */
  bridges: ModuleBridgeGrant[]
}

export interface ModuleManifest extends ModulePackage {
  manifest: typeof MODULE_MANIFEST_VERSION
  capabilities: ModuleCapabilities
}

type JsonRecord = Record<string, unknown>

function fail(message: string): never {
  throw new ModulePackageError(message)
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function strings(raw: unknown, path: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    fail(`${path} must be non-empty strings`)
  }
  return (raw as string[]).map((entry) => entry.trim())
}

function onlyKeys(raw: JsonRecord, allowed: string[], path: string): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) fail(`${path} has unknown field "${key}"`)
  }
}

function access(raw: unknown, path: string): ListAccess {
  if (raw !== "read" && raw !== "write") fail(`${path} must be "read" or "write"`)
  return raw
}

const HOST = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/

function parseBridge(raw: unknown, path: string): ModuleBridgeGrant {
  if (!isRecord(raw)) fail(`${path} must be an object`)
  switch (raw.bridge) {
    case "items":
      onlyKeys(raw, ["bridge", "access", "types"], path)
      return { bridge: "items", access: access(raw.access, `${path}.access`), types: strings(raw.types, `${path}.types`) }
    case "lists":
      onlyKeys(raw, ["bridge", "itemTypes"], path)
      return raw.itemTypes == null
        ? { bridge: "lists" }
        : { bridge: "lists", itemTypes: strings(raw.itemTypes, `${path}.itemTypes`) }
    case "docs":
    case "schedule":
    case "tracking":
    case "points":
      onlyKeys(raw, ["bridge"], path)
      return { bridge: raw.bridge }
    case "habits":
      onlyKeys(raw, ["bridge", "measures"], path)
      return { bridge: "habits", measures: strings(raw.measures, `${path}.measures`) }
    case "ingest":
      onlyKeys(raw, ["bridge", "phrases"], path)
      return { bridge: "ingest", phrases: strings(raw.phrases, `${path}.phrases`) }
    case "network": {
      onlyKeys(raw, ["bridge", "hosts"], path)
      const hosts = strings(raw.hosts, `${path}.hosts`)
      for (const host of hosts) if (!HOST.test(host)) fail(`${path}.hosts has "${host}", which is not a host name`)
      return { bridge: "network", hosts }
    }
    case "desktop": {
      onlyKeys(raw, ["bridge", "door"], path)
      if (typeof raw.door !== "string" || raw.door.trim() === "") fail(`${path}.door must be a non-empty string`)
      return { bridge: "desktop", door: raw.door.trim() }
    }
    case "private-store": {
      onlyKeys(raw, ["bridge", "where", "keys"], path)
      if (raw.where !== "module.config" && raw.where !== "localStorage") {
        fail(`${path}.where must be "module.config" or "localStorage"`)
      }
      return { bridge: "private-store", where: raw.where, keys: strings(raw.keys, `${path}.keys`) }
    }
    default:
      fail(`${path}.bridge "${String(raw.bridge)}" is not a bridge`)
  }
}

/** Doors only a compiled template can use. A file cannot grant itself these. */
const COMPILED_ONLY: ModuleBridgeName[] = ["private-store", "desktop"]

function parseCapabilities(raw: unknown, roles: string[], native: boolean): ModuleCapabilities {
  if (!isRecord(raw)) fail("manifest.capabilities must be an object")
  onlyKeys(raw, ["lists", "bridges"], "manifest.capabilities")
  if (!isRecord(raw.lists)) fail("manifest.capabilities.lists must be an object")
  const lists: Record<string, ListAccess> = {}
  for (const [role, value] of Object.entries(raw.lists)) {
    if (!roles.includes(role)) fail(`manifest.capabilities.lists names unknown slot "${role}"`)
    lists[role] = access(value, `manifest.capabilities.lists.${role}`)
  }
  for (const role of roles) {
    if (!(role in lists)) fail(`manifest.capabilities.lists has no entry for slot "${role}"`)
  }
  if (!Array.isArray(raw.bridges)) fail("manifest.capabilities.bridges must be an array")
  const bridges = raw.bridges.map((entry, i) => parseBridge(entry, `manifest.capabilities.bridges[${i}]`))
  if (!native) {
    for (const grant of bridges) {
      if (COMPILED_ONLY.includes(grant.bridge)) {
        fail(`manifest.capabilities.bridges: "${grant.bridge}" is only for a compiled template`)
      }
    }
  }
  return { lists, bridges }
}

/** Actions that do not change an item. Every other action writes its scope. */
const QUIET_ACTIONS = new Set(["throw", "runWorkflow", "syncPlan"])

function checkRoles(pkg: ModulePackage, lists: Record<string, ListAccess>): void {
  const roles = new Map(Object.keys(lists).map((role) => [role, role]))
  const needWrite = (role: string, path: string) => {
    if (lists[resolveRole(role, roles, path)] !== "write") fail(`${path} writes slot "${role}", which is read-only`)
  }
  pkg.views.forEach((view, i) => {
    const path = `manifest.views[${i}]`
    if (view.slot) resolveRole(view.slot, roles, `${path}.slot`)
    if (view.config) resolveViewConfig(view.config, roles, `${path}.config`)
  })
  ;(pkg.workflows ?? []).forEach((wf, i) => {
    const path = `manifest.workflows[${i}]`
    const scope = wf.scope?.listIds ?? []
    const writes = wf.actions.some((action) => !QUIET_ACTIONS.has(action.kind))
    scope.forEach((role, j) => {
      if (writes) needWrite(role, `${path}.scope.listIds[${j}]`)
      else resolveRole(role, roles, `${path}.scope.listIds[${j}]`)
    })
    wf.actions.forEach((action, j) => {
      if (action.kind === "createItem") needWrite(action.categoryId, `${path}.actions[${j}].categoryId`)
      if (action.kind === "pickRandom") resolveRole(action.fromCategoryId, roles, `${path}.actions[${j}].fromCategoryId`)
    })
  })
}

/** True when the JSON says it is a manifest. The parser decides if it is a good one. */
export function looksLikeModuleManifest(input: unknown): boolean {
  let raw = input
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return false
    }
  }
  return isRecord(raw) && "manifest" in raw
}

/**
 * Read a manifest from a JSON string or a plain object. Throws
 * `ModulePackageError` with the path of the first thing that is wrong.
 * Unlike `parseModulePackage`, a `nativeTemplate` manifest keeps its slots,
 * views, and workflows: they are the declaration.
 */
export function parseModuleManifest(input: unknown): ModuleManifest {
  let raw = input
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      fail("Module manifest JSON could not be parsed")
    }
  }
  if (!isRecord(raw)) fail("manifest must be an object")
  if (raw.manifest !== MODULE_MANIFEST_VERSION) fail(`manifest.manifest must be ${MODULE_MANIFEST_VERSION}`)
  const { manifest: _version, capabilities, nativeTemplate, ...recipe } = raw

  let native: ModuleTemplateId | undefined
  if (nativeTemplate != null) {
    if (!MODULE_TEMPLATES.some((template) => template.id === nativeTemplate)) {
      fail(`nativeTemplate "${String(nativeTemplate)}" is not a module template`)
    }
    native = nativeTemplate as ModuleTemplateId
  }
  // A declaration may have no lists and one compiled view. A recipe must state both.
  const pkg = parseModulePackage(native ? { slots: [], views: [], ...recipe } : recipe)
  const caps = parseCapabilities(capabilities, pkg.slots.map((slot) => slot.role), Boolean(native))
  checkRoles(pkg, caps.lists)
  return { ...pkg, ...(native ? { nativeTemplate: native } : {}), manifest: MODULE_MANIFEST_VERSION, capabilities: caps }
}

/** The private stores a manifest admits to. Empty means the module keeps its records as Items. */
export function manifestDebt(manifest: ModuleManifest): Extract<ModuleBridgeGrant, { bridge: "private-store" }>[] {
  return manifest.capabilities.bridges.filter(
    (grant): grant is Extract<ModuleBridgeGrant, { bridge: "private-store" }> => grant.bridge === "private-store",
  )
}

/** The grant for one bridge, if the manifest has it. */
export function manifestBridge<B extends ModuleBridgeName>(
  manifest: ModuleManifest,
  bridge: B,
): Extract<ModuleBridgeGrant, { bridge: B }> | undefined {
  return manifest.capabilities.bridges.find(
    (grant): grant is Extract<ModuleBridgeGrant, { bridge: B }> => grant.bridge === bridge,
  )
}

/**
 * List ids an installed package may write, from the access recorded at
 * install. `undefined` means nothing was recorded (a plain package, or a
 * module stored before manifests), so the caller keeps its old rule.
 */
export function writableListIds(pkg: { slots: Record<string, string>; access?: Record<string, ListAccess> } | undefined): string[] | undefined {
  if (!pkg?.access) return undefined
  return Object.entries(pkg.slots)
    .filter(([role]) => pkg.access![role] === "write")
    .map(([, listId]) => listId)
}

/** What a build made, in the shape `buildModuleTemplate` returns. */
export interface ManifestBuild {
  lists: List[]
  module: { title: string; views?: ModuleView[] }
  workflows?: WorkflowDefinition[]
}

/**
 * Where a build and its manifest disagree, as plain sentences. Empty means
 * the manifest covers the build: every list the build made is a declared
 * slot with the same attributes, every view is stated, every workflow is
 * named, and a workflow writes only a slot marked write.
 * Lists pair with slots by name, in order.
 */
export function manifestGaps(manifest: ModuleManifest, built: ManifestBuild): string[] {
  const gaps: string[] = []
  if (manifest.name !== built.module.title) gaps.push(`name is "${manifest.name}", the build is titled "${built.module.title}"`)

  const roleByListId = new Map<string, string>()
  const free = [...manifest.slots]
  for (const list of built.lists) {
    const at = free.findIndex((slot) => slot.name === list.name)
    if (at < 0) {
      gaps.push(`list "${list.name}" is built but is not a slot`)
      continue
    }
    const [slot] = free.splice(at, 1)
    roleByListId.set(list.id, slot.role)
    const declared = (slot.attributes ?? []).map((a) => `${a.id}:${a.type}`)
    const made = (list.itemAttributes ?? []).map((a) => `${a.id}:${a.type}`)
    if (declared.join() !== made.join()) {
      gaps.push(`slot "${slot.role}" declares attributes [${declared.join(", ")}], the build has [${made.join(", ")}]`)
    }
    if ((slot.itemType ?? "") !== (list.itemTypeId ?? "")) {
      gaps.push(`slot "${slot.role}" item type is "${slot.itemType ?? ""}", the build has "${list.itemTypeId ?? ""}"`)
    }
  }

  const role = (listId: string | undefined) => (listId ? roleByListId.get(listId) ?? `(${listId})` : "")
  const declaredViews = manifest.views.map((view) => `${view.title}|${view.kind}|${view.slot ?? view.config?.categoryId ?? ""}`)
  const builtViews = (built.module.views ?? []).map((view) => `${view.title}|${view.kind}|${role(view.config.categoryId)}`)
  if (declaredViews.join("\n") !== builtViews.join("\n")) {
    gaps.push(`views are [${declaredViews.join(", ")}], the build has [${builtViews.join(", ")}]`)
  }

  const declaredFlows = (manifest.workflows ?? []).map((wf) => wf.name)
  const builtFlows = (built.workflows ?? []).map((wf) => wf.name)
  if (declaredFlows.join("\n") !== builtFlows.join("\n")) {
    gaps.push(`workflows are [${declaredFlows.join(", ")}], the build has [${builtFlows.join(", ")}]`)
  }
  for (const wf of built.workflows ?? []) {
    for (const action of wf.actions) {
      if (action.kind !== "createItem") continue
      const target = roleByListId.get(action.categoryId)
      if (!target || manifest.capabilities.lists[target] !== "write") {
        gaps.push(`workflow "${wf.name}" creates items in a list the manifest does not mark write`)
      }
    }
  }
  return gaps
}

/**
 * Install a manifest and return the new module id.
 *
 * A recipe installs like a create-only package, then records
 * `capabilities.lists` on `config.package.access`. A sandboxed `package-app`
 * frame may then write only the slots marked write. A declaration commits its
 * compiled template unchanged, like a `nativeTemplate` package.
 * Other bridges are recorded nowhere yet: a sandboxed frame has no door for them.
 */
export function installModuleManifest(input: unknown): string {
  const { manifest: _version, capabilities, ...pkg } = parseModuleManifest(input)
  if (pkg.nativeTemplate) {
    return installModulePackage({ id: pkg.id, name: pkg.name, version: pkg.version, nativeTemplate: pkg.nativeTemplate })
  }
  const moduleId = installModulePackage(pkg)
  const store = useModulesStore.getState()
  const instance = store.modules.find((m) => m.id === moduleId)
  if (instance?.config.package) {
    store.updateModule(moduleId, {
      config: { ...instance.config, package: { ...instance.config.package, access: { ...capabilities.lists } } },
    })
  }
  return moduleId
}
