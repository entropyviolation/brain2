/**
 * lib/people-sync.ts — One person, three places: a "Who with?" detail, a Company pen, a People I Know item
 *
 * A person shows up as a detail on a "who" pen (Activity → Social, "Who
 * with?"; any pen outside Company whose detail question names who), as a
 * Company pen, and as an item on Lists → People I Know. This keeps the three
 * matched, by name, without moving anyone's data:
 *
 * - A local detail on a who pen (Social · Elijah) gets a Company pen Elijah,
 *   on the Person level, if Company has none by that name.
 * - A Company person pen with no detail of that name on a who pen gets a
 *   cross-view detail there, so it can be ticked on a Social block.
 * - Every Company person pen gets a People I Know item joined by a
 *   `company-pen` pipeline: an existing person with that pipeline, else one with
 *   the same name (the pipeline is added), else a new item.
 *
 * Person pens exclude Alone / Together / In conversation, pens on the "Alone or
 * with anyone" or Group level, and groups (pens others count as).
 *
 * `variantPerson(...)` is how the block-level mirror (`lib/entry-links.ts`)
 * reads a local who detail as the same-named Company pen. The one-time
 * `backfillPeopleDetails` runs that mirror over existing blocks so old Social ·
 * Elijah afternoons show Elijah in Company too (blank minutes only).
 */
import { childrenOf } from "@/lib/pen-tree"
import { penLevelId } from "@/lib/pen-levels"

export const COMPANY = "company"
const BUILTIN_KIND = new Set(["co-alone", "co-together", "co-talking"])

type SyncVariant = { id: string; name: string; penId?: string; scopeId?: string }
type SyncPen = {
  id: string
  name: string
  color: string
  parentId?: string
  parentIds?: string[]
  levelId?: string
  variantLabel?: string
  variants?: SyncVariant[]
}
type SyncScope = { id: string; pens: SyncPen[]; levels?: { id: string; name: string }[] }

const norm = (s: string) => s.trim().toLowerCase()

export function isWhoPen(scopeId: string, pen: { variantLabel?: string }): boolean {
  return scopeId !== COMPANY && /\bwho\b/i.test(pen.variantLabel ?? "")
}

export function isPersonPen(scope: SyncScope, pen: SyncPen): boolean {
  if (scope.id !== COMPANY || BUILTIN_KIND.has(pen.id)) return false
  if (["alone", "together", "in conversation"].includes(norm(pen.name))) return false
  const level = penLevelId(scope, pen)
  if (level === "lvl-company-kind" || level === "lvl-company-group") return false
  if (level === "lvl-company-person") return true
  return childrenOf(scope.pens, pen.id).length === 0
}

export function companyPenNamed(scopes: SyncScope[], name: string): SyncPen | undefined {
  const company = scopes.find((s) => s.id === COMPANY)
  return company?.pens.find((p) => norm(p.name) === norm(name) && isPersonPen(company, p))
}

/** The Company pen a who-pen detail stands for: its cross-view target, or the same-named person. */
export function variantPerson(
  scopes: SyncScope[],
  ownerScopeId: string,
  owner: SyncPen | undefined,
  variant: SyncVariant,
): string | undefined {
  if (variant.scopeId === COMPANY && variant.penId) return variant.penId
  if (variant.scopeId || !owner || !isWhoPen(ownerScopeId, owner)) return undefined
  return companyPenNamed(scopes, variant.name)?.id
}

export type PeopleSyncPlan = {
  /** Company pens to create, by name. */
  createCompany: string[]
  /** Cross-view details to add: on (scopeId, penId), pointing at a Company pen. */
  addDetail: { scopeId: string; penId: string; companyPenId: string }[]
}

export function planPeopleSync(scopes: SyncScope[]): PeopleSyncPlan {
  const company = scopes.find((s) => s.id === COMPANY)
  const plan: PeopleSyncPlan = { createCompany: [], addDetail: [] }
  if (!company) return plan
  const companyNames = new Set(company.pens.map((p) => norm(p.name)))
  const whoPens = scopes.flatMap((scope) => scope.pens.filter((pen) => isWhoPen(scope.id, pen)).map((pen) => ({ scope, pen })))
  for (const { pen } of whoPens) {
    for (const variant of pen.variants ?? []) {
      if (variant.scopeId) continue
      const key = norm(variant.name)
      if (!key || companyNames.has(key)) continue
      companyNames.add(key)
      plan.createCompany.push(variant.name.trim())
    }
  }
  for (const person of company.pens.filter((p) => isPersonPen(company, p))) {
    for (const { scope, pen } of whoPens) {
      const has = (pen.variants ?? []).some(
        (v) => (v.scopeId === COMPANY && v.penId === person.id) || (!v.scopeId && norm(v.name) === norm(person.name)),
      )
      if (!has) plan.addDetail.push({ scopeId: scope.id, penId: pen.id, companyPenId: person.id })
    }
  }
  return plan
}

type PersonTask = { id: string; title?: string; description?: string; personPipelines?: unknown }

/** Which person items to join or create so every Company person pen has one. */
export function planPeopleItems(
  scopes: SyncScope[],
  people: PersonTask[],
  joinedPenIds: (task: PersonTask) => string[],
): { join: { taskId: string; penId: string }[]; create: { name: string; penId: string }[] } {
  const company = scopes.find((s) => s.id === COMPANY)
  const out = { join: [] as { taskId: string; penId: string }[], create: [] as { name: string; penId: string }[] }
  if (!company) return out
  const joined = new Set(people.flatMap((task) => joinedPenIds(task)))
  for (const pen of company.pens) {
    if (!isPersonPen(company, pen) || joined.has(pen.id)) continue
    const byName = people.find((task) => norm(task.title || task.description || "") === norm(pen.name))
    if (byName) out.join.push({ taskId: byName.id, penId: pen.id })
    else out.create.push({ name: pen.name, penId: pen.id })
  }
  return out
}
