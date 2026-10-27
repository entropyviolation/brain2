/**
 * lib/graph/identity-match.ts — One person, still many records (KG-I, E2)
 *
 * Deterministic name and Instagram-handle match across People I Know items,
 * Company person pens, and who-pen details. A pair is a proposal. Accept
 * writes a recorded `same-as` through the graph inbox. Dismiss stays a
 * dismissal on that proposal. Nothing here merges or deletes a person.
 *
 * A Company pen already joined by a `company-pen` pipeline is the same node
 * as that item (`people-sync`), so it is not proposed again.
 *
 * Instagram login accounts in Settings are the person's own sessions, not
 * other people. The handle on `personProfile.instagram` is the local fact
 * this matcher reads.
 */
import type { GraphProposal } from "@/lib/graph/proposal-schema"
import { COMPANY, isWhoPen, variantPerson } from "@/lib/people-sync"
import { companyPersonPens, type SpineItem, type SpineScope } from "@/lib/graph/vault-graph"

export interface IdentityLink {
  sourceId: string
  relation: string
  targetId: string
}

export interface IdentityCandidate {
  /** Bare item id. Accept writes the link on this item. */
  sourceId: string
  /** Bare item id, or a `pen:` / `who:` address. */
  targetId: string
  relation: "same-as"
  reason: string
}

interface Side {
  address: string
  itemId?: string
  kind: "person item" | "Company pen" | "who detail"
  names: string[]
  instagram?: string
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function handle(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "")
  return cleaned || undefined
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000")
}

function endKey(itemId: string | undefined, address: string): string {
  return itemId ? `item:${itemId}` : address
}

export function identityCandidates(input: {
  items: readonly (SpineItem & { personProfile?: { nicknames?: string[]; instagram?: string } | null })[]
  scopes: readonly SpineScope[]
  /** Dismissed same-as proposals. A dismissal is not a deletion. */
  dismissed?: readonly { sourceId?: string; targetId?: string; relation?: string }[]
}): IdentityCandidate[] {
  const blocked = new Set<string>()
  const block = (a: string, b: string) => blocked.add(pairKey(a, b))

  const personItems = input.items.filter(
    (item) => item.type === "person" || !!item.personProfile || (item.personPipelines?.length ?? 0) > 0,
  )

  for (const item of input.items) {
    for (const link of item.links ?? []) {
      if (link.relation !== "same-as" && link.relation !== "different-from") continue
      const target = link.targetId.startsWith("item:") ? link.targetId : link.targetId.includes(":") ? link.targetId : `item:${link.targetId}`
      block(`item:${item.id}`, target)
    }
    for (const pipeline of item.personPipelines ?? []) {
      if (pipeline.kind === "company-pen" && pipeline.penId) block(`item:${item.id}`, `pen:${pipeline.penId}`)
    }
  }
  for (const row of input.dismissed ?? []) {
    if (row.relation && row.relation !== "same-as") continue
    if (!row.sourceId || !row.targetId) continue
    const target = row.targetId.includes(":") ? row.targetId : `item:${row.targetId}`
    block(`item:${row.sourceId}`, target)
  }

  const sides: Side[] = []
  for (const item of personItems) {
    const names = [item.title, item.description, ...(item.personProfile?.nicknames ?? [])].map((value) => norm(value ?? "")).filter(Boolean)
    sides.push({
      address: `item:${item.id}`,
      itemId: item.id,
      kind: "person item",
      names: [...new Set(names)],
      instagram: handle(item.personProfile?.instagram),
    })
  }
  for (const pen of companyPersonPens(input.scopes)) {
    const name = norm(pen.name)
    if (name) sides.push({ address: `pen:${pen.id}`, kind: "Company pen", names: [name] })
  }
  for (const scope of input.scopes) {
    if (scope.id === COMPANY) continue
    for (const pen of scope.pens) {
      if (!isWhoPen(scope.id, pen)) continue
      for (const variant of pen.variants ?? []) {
        const resolved = variantPerson(input.scopes as Parameters<typeof variantPerson>[0], scope.id, pen as Parameters<typeof variantPerson>[2], variant)
        if (resolved) continue
        const name = norm(variant.name)
        if (!name) continue
        sides.push({
          address: `who:${scope.id}:${pen.id}:${variant.id}`,
          kind: "who detail",
          names: [name],
        })
      }
    }
  }

  const out: IdentityCandidate[] = []
  const emitted = new Set<string>()
  for (let i = 0; i < sides.length; i++) {
    for (let j = i + 1; j < sides.length; j++) {
      const a = sides[i]
      const b = sides[j]
      if (a.address === b.address) continue
      const left = endKey(a.itemId, a.address)
      const right = endKey(b.itemId, b.address)
      if (blocked.has(pairKey(left, right))) continue
      const sharedHandle = !!a.instagram && a.instagram === b.instagram
      const sharedName = a.names.some((name) => b.names.includes(name))
      if (!sharedHandle && !sharedName) continue
      const source = a.itemId && b.itemId ? (a.itemId < b.itemId ? a : b) : a.itemId ? a : b.itemId ? b : null
      if (!source?.itemId) continue
      const other = source === a ? b : a
      const targetId = other.itemId ?? other.address
      if (targetId === source.itemId) continue
      const key = pairKey(`item:${source.itemId}`, endKey(other.itemId, other.address))
      if (emitted.has(key)) continue
      emitted.add(key)
      const reason = sharedHandle
        ? `Same Instagram handle on a ${source.kind} and a ${other.kind}.`
        : `Same name on a ${source.kind} and a ${other.kind}.`
      out.push({ sourceId: source.itemId, targetId, relation: "same-as", reason })
    }
  }
  out.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.targetId.localeCompare(b.targetId))
  return out
}

/** Inbox rows. Origin `densify:` so Accept writes order recorded, not inferred. */
export function identityProposals(candidates: readonly IdentityCandidate[], now = new Date().toISOString()): GraphProposal[] {
  return candidates.map((candidate) => ({
    id: `identity-${candidate.sourceId}-${candidate.targetId}`,
    kind: "link" as const,
    sourceId: candidate.sourceId,
    relation: candidate.relation,
    targetId: candidate.targetId,
    origin: "densify:identity" as const,
    reason: candidate.reason,
    createdAt: now,
    status: "open" as const,
  }))
}
