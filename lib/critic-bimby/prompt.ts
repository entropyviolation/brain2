/**
 * lib/critic-bimby/prompt.ts — What the model critic is asked, what it may answer, and how its answer becomes findings
 *
 * One schema-bound call. The critic reads the LINE first, then the finished plan, never the planner's reasoning. Every
 * finding must quote the line; `keepQuoted` (verdict.ts) drops a finding whose quote is not really in it. The model
 * can only raise hints. Only code can be certain.
 */

import type { PlanDraft, PlanItem } from "@/lib/plan-bimby/types"
import type { Finding, FindingKind } from "./types"

const KINDS = ["ok", "invented", "misordered", "wrong-link", "too-broad", "ambiguous"] as const

export const CRITIC_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["rows", "missing", "unsure"],
  properties: {
    rows: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        required: ["n", "kind", "quote", "reason"],
        properties: {
          n: { type: "integer", minimum: 1, maximum: 16 },
          kind: { type: "string", enum: [...KINDS] },
          quote: { type: "string", maxLength: 80 },
          reason: { type: "string", maxLength: 140 },
        },
      },
    },
    missing: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        required: ["quote", "reason"],
        properties: { quote: { type: "string", maxLength: 80 }, reason: { type: "string", maxLength: 140 } },
      },
    },
    unsure: { type: "boolean" },
  },
}

export const CRITIC_SYSTEM = `You check a plan against the sentence it was made from. You do not rewrite it.
LINE is what the person said. PLAN is the list of tasks someone else wrote from it.
For each PLAN row n answer kind:
- ok: the row is something the LINE asked for.
- invented: the LINE never asked for this task.
- misordered: the LINE puts it at a different place in the order.
- wrong-link: the "also" part (logs intake, waits for a flight, time on a task) is not what the LINE meant.
- too-broad: one row holds two separate things the LINE asked for.
- ambiguous: the LINE could mean two different tasks here.
quote: words copied exactly from the LINE, the ones the answer rests on. For an invented row, quote the nearest words of the LINE. Never quote the PLAN.
reason: one short plain sentence.
missing: things the LINE asked for that no row covers, each with its quote from the LINE. None is fine.
unsure: true only when you cannot tell. Be strict about invented tasks and missing tasks, and relaxed about wording: "make more coffee" matches "coffee".
Rows marked ok need an empty quote and reason. Never add tasks.`

/** The plan as the critic reads it: one compact line per row, numbered from 1. */
export function renderPlan(draft: Pick<PlanDraft, "items" | "remarks">): string {
  const rows = draft.items.map((i, at) => {
    const bits = [`${at + 1}. ${i.title}`]
    if (i.minutes) bits.push(`${i.minutes} min`)
    if (i.paceNote) bits.push(`pace "${i.paceNote}"`)
    if (i.subtasks.length) bits.push(`parts: ${i.subtasks.map((s) => (s.due ? `${s.title} (${s.due})` : s.title)).join("; ")}`)
    if (i.link) bits.push(i.link.kind === "intake" ? `also: logs ${i.link.label}` : i.link.kind === "flight" ? "also: waits for a flight confirmation" : `also: time on "${i.link.title}"`)
    return bits.join(" | ")
  })
  const remarks = draft.remarks.length ? `\nNOT TASKS (asides): ${draft.remarks.join("; ")}` : ""
  return `${rows.join("\n")}${remarks}`
}

export function criticUser(draft: Pick<PlanDraft, "items" | "remarks" | "source">): string {
  return `LINE: ${draft.source}\n\nPLAN:\n${renderPlan(draft)}`
}

export interface CriticAnswer {
  rows?: { n?: number; kind?: string; quote?: string; reason?: string }[]
  missing?: { quote?: string; reason?: string }[]
  unsure?: boolean
}

/** A model answer as findings. Rows that point at no row, unknown kinds and `ok` rows are dropped. Quotes are checked later. */
export function findingsOf(out: unknown, items: readonly PlanItem[]): Finding[] {
  const a = (out ?? {}) as CriticAnswer
  const found: Finding[] = []
  for (const r of Array.isArray(a.rows) ? a.rows : []) {
    const item = items[Number(r?.n) - 1]
    const kind = String(r?.kind ?? "") as FindingKind | "ok"
    if (!item || kind === "ok" || !(KINDS as readonly string[]).includes(kind)) continue
    found.push({ kind, where: item.id, quote: String(r?.quote ?? "").trim() || undefined, reason: String(r?.reason ?? "").trim().slice(0, 140) || `“${item.title}” may not match what you said.`, by: "model", strength: "hint" })
  }
  for (const m of Array.isArray(a.missing) ? a.missing : []) {
    const quote = String(m?.quote ?? "").trim()
    if (!quote) continue
    found.push({ kind: "dropped", where: "plan", quote, reason: String(m?.reason ?? "").trim().slice(0, 140) || `“${quote}” is in your sentence but in no task.`, by: "model", strength: "hint" })
  }
  return found
}

export const wasUnsure = (out: unknown): boolean => (out as CriticAnswer | null)?.unsure === true
