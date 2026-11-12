/**
 * lib/finance-bimby/store.ts — The Financial BIMBY's memory, and its own chat
 *
 * In the vault (`brain2-finance-bimby`): purchases (shop, receipt, verdict), perks, and receipts waiting for
 * their purchase. The chat transcript rides along, capped. The amounts themselves are in the Tracking log
 * and `brain2-budget`; a purchase here points at its log entry.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { registerPhoneWindowStore } from "@/lib/phone-window"
import { persistKey } from "@/lib/storage-keys"
import type { IncomingAttachment } from "@/lib/ingest/types"
import type { LooseReceipt, Perk, Purchase, PurchaseVerdict } from "./types"

export const FINANCE_STORAGE_KEY = persistKey("finance-bimby")
const LINE_CAP = 200

export type FinanceChoice = { label: string; text: string }

export interface FinanceLine {
  id: string
  at: string
  who: "you" | "bimby"
  text: string
  choices?: FinanceChoice[]
  /** The purchase this line is about, so the chat can draw its receipt. */
  purchaseId?: string
}

export function financeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : [])

function cleanPurchase(raw: unknown): Purchase | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<Purchase>
  const cents = Number(r.cents)
  if (!str(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) || !Number.isInteger(cents) || cents <= 0) return null
  const v = r.verdict
  const verdict: PurchaseVerdict | undefined =
    v && (v.kind === "regret" || v.kind === "satisfied" || v.kind === "mixed") ? { kind: v.kind, at: str(v.at) || new Date().toISOString(), ...(str(v.why) ? { why: str(v.why) } : {}) } : undefined
  return {
    id: str(r.id),
    at: str(r.at) || new Date().toISOString(),
    date: str(r.date),
    cents,
    what: str(r.what) || "Spent",
    receipts: strings(r.receipts),
    tokens: strings(r.tokens),
    ...(str(r.merchant) ? { merchant: str(r.merchant) } : {}),
    ...(str(r.account) ? { account: str(r.account) } : {}),
    ...(str(r.entryId) ? { entryId: str(r.entryId) } : {}),
    ...(str(r.receiptText) ? { receiptText: str(r.receiptText).slice(0, 4000) } : {}),
    ...(verdict ? { verdict } : {}),
  }
}

function cleanPerk(raw: unknown): Perk | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<Perk>
  if (!str(r.id) || !str(r.text)) return null
  return {
    id: str(r.id),
    at: str(r.at) || new Date().toISOString(),
    text: str(r.text),
    tokens: strings(r.tokens),
    ...(Number.isInteger(r.cents) && (r.cents as number) > 0 ? { cents: r.cents as number } : {}),
    ...(typeof r.percent === "number" && r.percent > 0 ? { percent: r.percent } : {}),
    ...(str(r.what) ? { what: str(r.what) } : {}),
    ...(str(r.merchant) ? { merchant: str(r.merchant) } : {}),
    ...(str(r.usedAt) ? { usedAt: str(r.usedAt) } : {}),
    ...(str(r.cueId) ? { cueId: str(r.cueId) } : {}),
  }
}

function cleanLoose(raw: unknown): LooseReceipt | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<LooseReceipt>
  if (!str(r.uri)) return null
  return { uri: str(r.uri), at: str(r.at) || new Date().toISOString(), ...(str(r.text) ? { text: str(r.text).slice(0, 4000) } : {}) }
}

function list<T>(raw: unknown, one: (row: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(one).filter((x): x is T => x !== null) : []
}

interface FinanceState {
  purchases: Purchase[]
  perks: Perk[]
  loose: LooseReceipt[]
  lines: FinanceLine[]
  busy: boolean
  /** A line typed in the BIMBY's own chat. The work is in `run.ts`, bound at load so the store has no import cycle. */
  send: (text: string, photos?: IncomingAttachment[]) => Promise<void>
  say: (line: Omit<FinanceLine, "id" | "at">) => void
  clearChat: () => void
}

type Talk = (text: string, photos: IncomingAttachment[], now: Date) => Promise<{ text: string; choices?: FinanceChoice[]; purchaseId?: string }>
let talk: Talk | null = null
/** `run.ts` hands the store the function its chat calls. */
export function bindFinanceTalk(fn: Talk): void {
  talk = fn
}

export const useFinanceBimby = create<FinanceState>()(
  persist(
    (set, get) => ({
      purchases: [],
      perks: [],
      loose: [],
      lines: [],
      busy: false,
      say: (line) => set((s) => ({ lines: [...s.lines, { id: financeId("fl"), at: new Date().toISOString(), ...line }].slice(-LINE_CAP) })),
      send: async (raw, photos = []) => {
        const text = raw.trim()
        if ((!text && !photos.length) || get().busy) return
        const tag = photos.length ? `📷 ${photos.length === 1 ? "receipt" : `${photos.length} receipts`}` : ""
        get().say({ who: "you", text: [tag, text].filter(Boolean).join(" · ") })
        set({ busy: true })
        try {
          if (!talk) await import("./run")
          const reply = await talk!(text, photos, new Date())
          get().say({ who: "bimby", text: reply.text, ...(reply.choices?.length ? { choices: reply.choices } : {}), ...(reply.purchaseId ? { purchaseId: reply.purchaseId } : {}) })
        } catch (error) {
          get().say({ who: "bimby", text: `That failed: ${error instanceof Error ? error.message : String(error)}` })
        }
        set({ busy: false })
      },
      clearChat: () => set({ lines: [] }),
    }),
    {
      name: FINANCE_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (s) => ({ purchases: s.purchases, perks: s.perks, loose: s.loose, lines: s.lines }),
      merge: (persisted, current) => {
        const blob = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {}
        return {
          ...current,
          purchases: list(blob.purchases, cleanPurchase),
          perks: list(blob.perks, cleanPerk),
          loose: list(blob.loose, cleanLoose),
          lines: Array.isArray(blob.lines) ? (blob.lines as FinanceLine[]).filter((l) => l && typeof l.text === "string").slice(-LINE_CAP) : [],
        }
      },
    },
  ),
)

registerPhoneWindowStore(useFinanceBimby)

/** Change one purchase in place. */
export function patchPurchase(id: string, patch: (p: Purchase) => Purchase): void {
  useFinanceBimby.setState((s) => ({ purchases: s.purchases.map((p) => (p.id === id ? patch(p) : p)) }))
}

export function patchPerk(id: string, patch: (p: Perk) => Perk): void {
  useFinanceBimby.setState((s) => ({ perks: s.perks.map((p) => (p.id === id ? patch(p) : p)) }))
}
