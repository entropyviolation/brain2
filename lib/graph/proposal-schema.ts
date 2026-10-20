/**
 * lib/graph/proposal-schema.ts — The proposal file a model or agent hands
 * back (LINKS_REDESIGN §6.5, §11.2, L8.2). Rows are checked: ids exist,
 * relations exist (or the row proposes one), scope holds, a reason is
 * given. Malformed rows are counted and dropped. Nothing here writes a link.
 */
import type { RelationDef } from "@/lib/links"
import type { NewRelationInput } from "@/lib/relation-registry"
import type { RelationRule } from "@/lib/graph/relation-rules"

export type ProposalOrigin = `model:${string}` | `import:${string}` | `densify:${string}`

export interface GraphProposal {
  id: string
  kind: "link" | "relation" | "rule"
  sourceId?: string
  relation?: string
  targetId?: string
  relationDraft?: NewRelationInput & { parent?: string }
  ruleDraft?: Omit<RelationRule, "id" | "createdAt">
  origin: ProposalOrigin
  reason: string
  evidence?: { itemId: string; field: string; span: string }
  score?: number
  createdAt: string
  status: "open" | "accepted" | "dismissed"
}

export const PROPOSAL_SCHEMA = {
  version: 1,
  row: "{ kind: 'link'|'relation'|'rule', sourceId?, relation?, targetId?, relationDraft?, ruleDraft?, reason, evidence?: {itemId, field, span}, score? }",
  rules: [
    "kind link: sourceId and targetId must be item ids in the snapshot; relation must be a snapshot relation id.",
    "kind relation: relationDraft { label, inverseLabel?, symmetric?, fromTypes?, toTypes?, family?, parent? }.",
    "kind rule: ruleDraft { label, chain (1-3 relation ids), head, unless?, enabled }.",
    "Every row needs a one-line reason. Rows are proposals; the person accepts or dismisses each one.",
  ],
}

export interface ImportContext {
  hasItem: (id: string) => boolean
  getDef: (id: string) => Pick<RelationDef, "fromTypes" | "toTypes"> | undefined
  typeOf?: (id: string) => string | undefined
  origin: ProposalOrigin
  now?: Date
}

export function parseProposalFile(raw: unknown, ctx: ImportContext): { rows: GraphProposal[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { proposals?: unknown }).proposals) ? (raw as { proposals: unknown[] }).proposals : null
  if (!list) return { rows: [], dropped: 0 }
  const rows: GraphProposal[] = []
  let dropped = 0
  const now = (ctx.now ?? new Date()).toISOString()
  list.forEach((value, i) => {
    const row = checkRow(value, ctx)
    if (!row) return void dropped++
    rows.push({ ...row, id: `prop-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`, origin: ctx.origin, createdAt: now, status: "open" })
  })
  return { rows, dropped }
}

type Row = Omit<GraphProposal, "id" | "origin" | "createdAt" | "status">

function checkRow(value: unknown, ctx: ImportContext): Row | null {
  if (!value || typeof value !== "object") return null
  const r = value as Record<string, unknown>
  const reason = typeof r.reason === "string" ? r.reason.trim() : ""
  if (!reason) return null
  const score = typeof r.score === "number" && r.score >= 0 && r.score <= 1 ? r.score : undefined
  const ev = r.evidence as GraphProposal["evidence"] | undefined
  const evidence = ev && typeof ev.itemId === "string" && typeof ev.span === "string" ? { itemId: ev.itemId, field: String(ev.field ?? ""), span: ev.span } : undefined
  const base = { reason, ...(score !== undefined ? { score } : {}), ...(evidence ? { evidence } : {}) }
  if (r.kind === "link") {
    const { sourceId, targetId, relation } = r as { sourceId?: string; targetId?: string; relation?: string }
    if (typeof sourceId !== "string" || typeof targetId !== "string" || typeof relation !== "string") return null
    if (sourceId === targetId || !ctx.hasItem(sourceId) || !ctx.hasItem(targetId)) return null
    const def = ctx.getDef(relation)
    if (!def) return null
    if (ctx.typeOf) {
      const from = ctx.typeOf(sourceId)
      const to = ctx.typeOf(targetId)
      if (def.fromTypes?.length && from && !def.fromTypes.includes(from)) return null
      if (def.toTypes?.length && to && !def.toTypes.includes(to)) return null
    }
    return { kind: "link", sourceId, targetId, relation, ...base }
  }
  if (r.kind === "relation") {
    const d = r.relationDraft as GraphProposal["relationDraft"]
    if (!d || typeof d.label !== "string" || !d.label.trim()) return null
    return { kind: "relation", relationDraft: d, ...base }
  }
  if (r.kind === "rule") {
    const d = r.ruleDraft as GraphProposal["ruleDraft"]
    if (!d || !Array.isArray(d.chain) || d.chain.length < 1 || d.chain.length > 3 || typeof d.head !== "string") return null
    if (![...d.chain, d.head].every((id) => typeof id === "string" && ctx.getDef(id))) return null
    return { kind: "rule", ruleDraft: { ...d, label: d.label || d.head, enabled: false }, ...base }
  }
  return null
}
