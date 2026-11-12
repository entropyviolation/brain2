/**
 * lib/agents/adapters/finance-bimby.ts — The Financial BIMBY, seen as a Blueprint
 *
 * Four built pipelines, each also a tool: log a money line, attach a receipt, keep a verdict, and say what
 * the ledger knows before a buy. Code: `lib/finance-bimby/`. Its lab is `/lab/finance-bimby`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const FINANCE_BIMBY_HREF = "/lab/finance-bimby"
export const FINANCE_BIMBY_ID = "finance-bimby"

export const FINANCE_LOG_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "code", does: "Reads the sentence for a money verb and an amount: a spend (what, shop, how it was paid, day), an earning, a debt either way, a debt settled, or a discount." },
  { id: "file", label: "File", cost: "code", does: "A spend goes on the Tracking log with a purchase record beside it; debts and earnings go to the money book; a discount is kept here. Each write can be undone." },
  { id: "recall", label: "Recall", cost: "code", does: "Adds what the ledger already says: how earlier buys at that shop sat, the month there so far, and a discount to ask about." },
]

const RECEIPT_STAGES: PipelineStage[] = [
  { id: "keep", label: "Keep", cost: "code", does: "Stores the picture in the attachment store." },
  { id: "ocr", label: "Read", cost: "code", does: "Local OCR, then the total from a total line and the shop from a known name. A total is never guessed from the largest number." },
  { id: "match", label: "Match", cost: "code", does: "Attaches it to the purchase the caption names, else the one just told, else the one with the same total. With none, a read total becomes the purchase; an unread receipt waits 15 minutes for one." },
]

const VERDICT_STAGES: PipelineStage[] = [
  { id: "feel", label: "Feel", cost: "code", does: "Reads regret, satisfied or mixed from the sentence, and which purchase it means by its words." },
  { id: "keep", label: "Keep", cost: "code", does: "Keeps the verdict and the person's own words on the purchase. With no reason given, asks for one." },
  { id: "reply", label: "Reply", cost: "local-model", does: "One to three sentences from the fact sheet (this purchase, earlier verdicts, the month). With no model the facts are shown as they are." },
]

const ADVISE_STAGES: PipelineStage[] = [
  { id: "topic", label: "Topic", cost: "code", does: "Reads what is about to be bought and where, from a line being weighed or a spend just logged." },
  { id: "facts", label: "Facts", cost: "code", does: "Counts earlier verdicts on buys like it, quotes the newest two, and lists unused discounts and the shop's month so far." },
]

export const FINANCE_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "log-money-line", name: "Log a money line", does: "A sentence about spending, earning, owing or a discount is filed in the right ledger.", status: "built", stages: FINANCE_LOG_STAGES, asTool: "log-money-line" },
  { id: "attach-receipt", name: "Attach a receipt", does: "A receipt photo or screenshot is read and attached to its purchase.", status: "built", stages: RECEIPT_STAGES, asTool: "attach-receipt" },
  { id: "keep-verdict", name: "Keep how a purchase sat", does: "Regret or satisfaction about a purchase is kept in your words and talked through.", status: "built", stages: VERDICT_STAGES, asTool: "keep-verdict" },
  { id: "advise-buy", name: "Before you buy", does: "Says what your own history says about a buy you are weighing or just made.", status: "built", stages: ADVISE_STAGES, asTool: "advise-buy" },
  { id: "budget-watch", name: "Watch the budgets", does: "Warns when a spend takes an envelope past its monthly cap.", status: "planned", stages: [] },
  { id: "statement-match", name: "Match a statement", does: "Pairs statement lines with purchases and asks about the ones it has never heard of.", status: "planned", stages: [] },
]

export function financeBimbyBlueprint(): Blueprint {
  return {
    id: FINANCE_BIMBY_ID,
    name: "Financial BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Keeps your money straight from plain sentences: what you spent and where, who owes whom, discounts waiting, the receipt, and how each purchase sat with you afterwards, so it can say something useful next time.",
    senses: ["message", "question", "item"],
    memory: { reads: ["episodic", "semantic"], writes: ["episodic"] },
    tools: [
      { name: "log-money-line", writes: true },
      { name: "attach-receipt", writes: true },
      { name: "keep-verdict", writes: true },
      { name: "advise-buy", writes: false },
    ],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1 },
    door: { proposes: ["spend", "debt", "earning", "perk", "purchase-verdict"], surface: "finance-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: FINANCE_LOG_STAGES, pipelines: FINANCE_BIMBY_PIPELINES },
  }
}
