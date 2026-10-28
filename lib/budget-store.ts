/**
 * lib/budget-store.ts — The money book
 *
 * Spending logged on the Tracking log stays there (`isSpendEntry`); the month
 * view reads those rows too. This store holds what the log has no place for:
 * earnings, hand-added lines, and prospective plans (`status: "expected"`).
 * Accounts (cash, bank, card) and debts (a person you owe, or who owes you)
 * are separate lists. Debts are never accounts. Bills, budget envelopes, paid
 * gigs, and statement text live here too. Storage: `brain2-budget` (persist v2;
 * older lines load as received). Plan: `docs/BUDGET_REDESIGN.md`.
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

export type AccountKind = "cash" | "bank" | "card"

/** Where money sits. Not a person you owe. */
export interface MoneyAccount {
  id: string
  name: string
  kind: AccountKind
  last4?: string
}

/** A person or name, kept off the account list. */
export interface MoneyDebt {
  id: string
  who: string
  /** `owe` = this person is owed. `owed` = they owe you. */
  direction: "owe" | "owed"
  cents: number
  note?: string
}

export type BillCadence = "weekly" | "monthly" | "yearly"

export interface MoneyBill {
  id: string
  name: string
  cents: number
  cadence: BillCadence
  /** Day of month (monthly, yearly) or weekday 0–6 (weekly). */
  day?: number
  active: boolean
}

/** A monthly cap for one name, such as Groceries. */
export interface MoneyEnvelope {
  id: string
  name: string
  cents: number
}

export type GigStatus = "open" | "finished" | "paid"

/** Pay due when the work finishes. `paid` has already landed. */
export interface MoneyGig {
  id: string
  name: string
  cents: number
  status: GigStatus
  note?: string
}

/** Statement text kept on this device. CSV and plain text, not a bank login. */
export interface MoneyStatement {
  id: string
  name: string
  addedAt: string
  text: string
}

export type MoneyBookData = {
  lines: BudgetLine[]
  accounts: MoneyAccount[]
  debts: MoneyDebt[]
  bills: MoneyBill[]
  envelopes: MoneyEnvelope[]
  gigs: MoneyGig[]
  statements: MoneyStatement[]
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const STATEMENT_CAP = 500_000

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function keepId(raw: unknown, prefix: string): string {
  return typeof raw === "string" && raw.trim() ? raw.trim() : newId(prefix)
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

function positiveCents(value: unknown): number | null {
  const cents = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(cents) || cents <= 0) return null
  return cents
}

function cleanAccount(raw: unknown): MoneyAccount | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyAccount>
  const name = String(row.name ?? "").trim()
  if (!name) return null
  const kind = row.kind === "cash" || row.kind === "card" ? row.kind : row.kind === "bank" ? "bank" : null
  if (!kind) return null
  const last4 = String(row.last4 ?? "").replace(/\D/g, "").slice(-4)
  return { id: keepId(row.id, "acct"), name, kind, ...(last4 ? { last4 } : {}) }
}

function cleanDebt(raw: unknown): MoneyDebt | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyDebt>
  const who = String(row.who ?? "").trim()
  const cents = positiveCents(row.cents)
  if (!who || cents == null) return null
  if (row.direction !== "owe" && row.direction !== "owed") return null
  const note = String(row.note ?? "").trim()
  return { id: keepId(row.id, "debt"), who, direction: row.direction, cents, ...(note ? { note } : {}) }
}

function cleanBill(raw: unknown): MoneyBill | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyBill>
  const name = String(row.name ?? "").trim()
  const cents = positiveCents(row.cents)
  if (!name || cents == null) return null
  const cadence = row.cadence === "weekly" || row.cadence === "yearly" ? row.cadence : row.cadence === "monthly" ? "monthly" : null
  if (!cadence) return null
  const day = typeof row.day === "number" && Number.isInteger(row.day) ? row.day : undefined
  return { id: keepId(row.id, "bill"), name, cents, cadence, ...(day != null ? { day } : {}), active: row.active !== false }
}

function cleanEnvelope(raw: unknown): MoneyEnvelope | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyEnvelope>
  const name = String(row.name ?? "").trim()
  const cents = positiveCents(row.cents)
  if (!name || cents == null) return null
  return { id: keepId(row.id, "env"), name, cents }
}

function cleanGig(raw: unknown): MoneyGig | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyGig>
  const name = String(row.name ?? "").trim()
  const cents = positiveCents(row.cents)
  if (!name || cents == null) return null
  const status = row.status === "finished" || row.status === "paid" ? row.status : "open"
  const note = String(row.note ?? "").trim()
  return { id: keepId(row.id, "gig"), name, cents, status, ...(note ? { note } : {}) }
}

function cleanStatement(raw: unknown): MoneyStatement | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MoneyStatement>
  const name = String(row.name ?? "").trim()
  const text = String(row.text ?? "").slice(0, STATEMENT_CAP)
  if (!name || !text.trim()) return null
  const addedAt = String(row.addedAt ?? "").trim() || new Date().toISOString()
  return { id: keepId(row.id, "stmt"), name, addedAt, text }
}

function listOf<T>(raw: unknown, cleanOne: (row: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  for (const row of raw) {
    const ok = cleanOne(row)
    if (ok) out.push(ok)
  }
  return out
}

export function sanitizeBudgetLines(raw: unknown): BudgetLine[] {
  const rows = (raw as { lines?: unknown } | null | undefined)?.lines
  if (!Array.isArray(rows)) return []
  const out: BudgetLine[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const r = row as Partial<BudgetLine>
    const ok = clean({
      date: String(r.date ?? ""),
      name: String(r.name ?? ""),
      source: String(r.source ?? ""),
      cents: Number(r.cents),
      kind: r.kind === "spend" ? "spend" : "earning",
      status: r.status,
      certainty: r.certainty,
      notes: r.notes,
      account: r.account,
      category: r.category,
      itemId: r.itemId,
    })
    if (ok) out.push({ id: typeof r.id === "string" && r.id ? r.id : newId("bud"), ...ok })
  }
  return out
}

/** v2 lines stay. Unknown account kinds (including a debt stuffed into accounts) drop. */
export function sanitizeMoneyBook(raw: unknown): MoneyBookData {
  const blob = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    lines: sanitizeBudgetLines(blob),
    accounts: listOf(blob.accounts, cleanAccount),
    debts: listOf(blob.debts, cleanDebt),
    bills: listOf(blob.bills, cleanBill),
    envelopes: listOf(blob.envelopes, cleanEnvelope),
    gigs: listOf(blob.gigs, cleanGig),
    statements: listOf(blob.statements, cleanStatement),
  }
}

export const EMPTY_MONEY_BOOK: MoneyBookData = {
  lines: [],
  accounts: [],
  debts: [],
  bills: [],
  envelopes: [],
  gigs: [],
  statements: [],
}

interface BudgetState extends MoneyBookData {
  addLines: (drafts: BudgetDraft[]) => number
  updateLine: (id: string, patch: Partial<BudgetDraft>) => void
  removeLine: (id: string) => void
  ensureAccount: (draft: { name: string; kind: AccountKind; last4?: string }) => void
  addDebt: (draft: Omit<MoneyDebt, "id">) => void
  removeDebt: (id: string) => void
  addBill: (draft: Omit<MoneyBill, "id" | "active"> & { active?: boolean }) => void
  removeBill: (id: string) => void
  addEnvelope: (draft: Omit<MoneyEnvelope, "id">) => void
  removeEnvelope: (id: string) => void
  addGig: (draft: Omit<MoneyGig, "id" | "status"> & { status?: GigStatus }) => void
  setGigStatus: (id: string, status: GigStatus) => void
  removeGig: (id: string) => void
  rememberStatement: (draft: { name: string; text: string }) => void
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      ...EMPTY_MONEY_BOOK,
      addLines: (drafts) => {
        const added: BudgetLine[] = []
        for (const draft of drafts) {
          const ok = clean(draft)
          if (ok) added.push({ id: newId("bud"), ...ok })
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
      ensureAccount: (draft) => {
        const name = draft.name.trim()
        if (!name) return
        if (get().accounts.some((account) => account.name.toLowerCase() === name.toLowerCase())) return
        const last4 = draft.last4?.replace(/\D/g, "").slice(-4)
        set({
          accounts: [...get().accounts, { id: newId("acct"), name, kind: draft.kind, ...(last4 ? { last4 } : {}) }],
        })
      },
      addDebt: (draft) => {
        const ok = cleanDebt({ ...draft, id: newId("debt") })
        if (!ok) return
        set({ debts: [...get().debts, ok] })
      },
      removeDebt: (id) => set({ debts: get().debts.filter((debt) => debt.id !== id) }),
      addBill: (draft) => {
        const ok = cleanBill({ ...draft, id: newId("bill"), active: draft.active !== false })
        if (!ok) return
        set({ bills: [...get().bills, ok] })
      },
      removeBill: (id) => set({ bills: get().bills.filter((bill) => bill.id !== id) }),
      addEnvelope: (draft) => {
        const ok = cleanEnvelope({ ...draft, id: newId("env") })
        if (!ok) return
        set({ envelopes: [...get().envelopes, ok] })
      },
      removeEnvelope: (id) => set({ envelopes: get().envelopes.filter((row) => row.id !== id) }),
      addGig: (draft) => {
        const ok = cleanGig({ ...draft, id: newId("gig"), status: draft.status ?? "open" })
        if (!ok) return
        set({ gigs: [...get().gigs, ok] })
      },
      setGigStatus: (id, status) =>
        set({
          gigs: get().gigs.map((gig) => (gig.id === id ? { ...gig, status } : gig)),
        }),
      removeGig: (id) => set({ gigs: get().gigs.filter((gig) => gig.id !== id) }),
      rememberStatement: (draft) => {
        const ok = cleanStatement({ ...draft, id: newId("stmt"), addedAt: new Date().toISOString() })
        if (!ok) return
        set({ statements: [...get().statements, ok] })
      },
    }),
    {
      name: BUDGET_STORAGE_KEY,
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        lines: state.lines,
        accounts: state.accounts,
        debts: state.debts,
        bills: state.bills,
        envelopes: state.envelopes,
        gigs: state.gigs,
        statements: state.statements,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeMoneyBook(persisted) }),
    },
  ),
)
