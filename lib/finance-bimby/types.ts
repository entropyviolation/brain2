/**
 * lib/finance-bimby/types.ts — What the Financial BIMBY remembers
 *
 * The money itself stays where it already lives: spending on the Tracking log, debts and earnings in
 * `brain2-budget`. These records hold what those have no place for: where a purchase was made, its receipt,
 * how the person felt about it afterwards, and discounts waiting to be used.
 */

export type Verdict = "regret" | "satisfied" | "mixed"

export interface PurchaseVerdict {
  kind: Verdict
  /** The person's own words, never a model's. */
  why?: string
  at: string
}

/** One thing bought. `entryId` is the Tracking log spend it stands beside. */
export interface Purchase {
  id: string
  /** When it was told, ISO. */
  at: string
  /** `YYYY-MM-DD` the money was spent. */
  date: string
  cents: number
  what: string
  merchant?: string
  /** How it was paid ("Amex", "Cash"). */
  account?: string
  entryId?: string
  /** Receipt pictures, as `idb:<id>` attachment URIs. */
  receipts: string[]
  /** What OCR read from the receipt, kept so a later question can be answered from it. */
  receiptText?: string
  verdict?: PurchaseVerdict
  /** Stemmed words of what and merchant. A later line is matched on these. */
  tokens: string[]
}

/** A discount or credit told in passing ("got $15 off restaurant food on Instacart"). */
export interface Perk {
  id: string
  at: string
  /** The sentence kept, as said. */
  text: string
  cents?: number
  percent?: number
  what?: string
  merchant?: string
  tokens: string[]
  usedAt?: string
  /** The reminder cue made with it (`lib/cues/`), when the line asked for one. */
  cueId?: string
}

/** A receipt sent before its purchase was told. The next spend takes it. */
export interface LooseReceipt {
  uri: string
  at: string
  text?: string
}

export type MoneyRead =
  | { kind: "spend"; cents: number; what: string; merchant?: string; account?: string; accountKind?: "cash" | "bank" | "card"; date: string }
  | { kind: "earning"; cents: number; what: string; from?: string; date: string }
  | { kind: "debt"; direction: "owe" | "owed"; who: string; cents: number; note?: string }
  | { kind: "settle"; direction: "owe" | "owed"; who: string; cents?: number; date: string }
  | { kind: "perk"; text: string; cents?: number; percent?: number; what?: string; merchant?: string }

export type MoneyAsk =
  | { kind: "owed"; who?: string }
  | { kind: "owe" }
  | { kind: "spent"; from: string; to: string; label: string; about: string[] }
  | { kind: "regrets" }
  | { kind: "perks" }

export interface Reflection {
  kind: Verdict
  /** The sentence, as said. */
  words: string
}

/** A thing the person is about to buy, or wonders about buying. */
export interface BuyIntent {
  topic: string
  tokens: string[]
  cents?: number
}
