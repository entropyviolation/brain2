/**
 * lib/budget-store.ts — Shared budget lines (earnings, and spending kept off the log)
 *
 * Spending logged on the Tracking log stays there (`isSpendEntry`); the budget
 * view reads those rows too. This store holds what the log has no place for:
 * earnings and deposits, plus any line the user adds by hand. Integer cents,
 * a date, a name, a source, plus optional notes, account, and an attached item
 * (`itemId`: a project, trip, or any task item, so a budget can ride on it).
 * `status: "expected"` is prospective money (a plan, never counted as received);
 * `certainty` says how sure. Plan: `docs/BUDGET_REDESIGN.md`. Storage: `brain2-budget` (persist v2; v1 lines load as received), the same
 * hub-safe Zustand persist as the other vault stores.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const BUDGET_STORAGE_KEY = persistKey("budget")

export interface BudgetLine {
  id: string
  /** `YYYY-MM-DD`. */
  date: string
  name: string
  /** Positive integer cents. */
  cents: number
  kind: "earning" | "spend"
  source: string
  /** Absent means received (retrospective). `expected` is prospective. */
  status?: "received" | "expected"
  /** Prospective only: how sure the money is. */
  certainty?: "sure" | "likely" | "maybe"
  notes?: string
  account?: string
  /** Free text group for breakdowns, such as Housing or Giving. */
  category?: string
  /** Attached item id (project, trip, category item). */
  itemId?: string
}

export type BudgetDraft = Omit<BudgetLine, "id">

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `bud_${crypto.randomUUID()}`
  return `bud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function clean(draft: BudgetDraft): BudgetDraft | null {
  const name = draft.name.trim()
  const source = draft.source.trim()
  if (!DATE_KEY.test(draft.date) || !name || !source) return null
  if (!Number.isInteger(draft.cents) || draft.cents <= 0) return null
  const expected = draft.status === "expected"
  const notes = draft.notes?.trim()
  const account = draft.account?.trim()
  const category = draft.category?.trim()
  const itemId = draft.itemId?.trim()
  return {
    date: draft.date,
    name,
    source,
    cents: draft.cents,
    kind: draft.kind === "spend" ? "spend" : "earning",
    ...(expected ? { status: "expected" as const, certainty: draft.certainty ?? "sure" } : {}),
    ...(notes ? { notes } : {}),
    ...(account ? { account } : {}),
    ...(category ? { category } : {}),
    ...(itemId ? { itemId } : {}),
  }
}

interface BudgetState {
  lines: BudgetLine[]
  addLines: (drafts: BudgetDraft[]) => number
  updateLine: (id: string, patch: Partial<BudgetDraft>) => void
  removeLine: (id: string) => void
}

export function sanitizeBudgetLines(raw: unknown): BudgetLine[] {
  const rows = (raw as { lines?: unknown } | null | undefined)?.lines
  if (!Array.isArray(rows)) return []
  const out: BudgetLine[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Partial<BudgetLine>
    const ok = clean({ date: String(r.date ?? ""), name: String(r.name ?? ""), source: String(r.source ?? ""), cents: Number(r.cents), kind: r.kind === "spend" ? "spend" : "earning", status: r.status, certainty: r.certainty, notes: r.notes, account: r.account, category: r.category, itemId: r.itemId })
    if (ok) out.push({ id: typeof r.id === "string" && r.id ? r.id : newId(), ...ok })
  }
  return out
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      lines: [],
      addLines: (drafts) => {
        const added: BudgetLine[] = []
        for (const draft of drafts) {
          const ok = clean(draft)
          if (ok) added.push({ id: newId(), ...ok })
        }
        if (added.length) set({ lines: [...get().lines, ...added] })
        return added.length
      },
      updateLine: (id, patch) =>
        set({
          lines: get().lines.map((line) => {
            if (line.id !== id) return line
            const ok = clean({ ...line, ...patch })
            return ok ? { id, ...ok } : line
          }),
        }),
      removeLine: (id) => set({ lines: get().lines.filter((line) => line.id !== id) }),
    }),
    {
      name: BUDGET_STORAGE_KEY,
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => ({ ...current, lines: sanitizeBudgetLines(persisted) }),
    },
  ),
)
