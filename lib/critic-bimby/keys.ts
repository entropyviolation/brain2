/**
 * lib/critic-bimby/keys.ts — A finding becomes a key the person may press (pure)
 *
 * The critic never edits the plan. A key is an edit the person chose, run by code on the draft. "Keep as is" is
 * drawn by the screen and is always there.
 */

import { planItemId } from "@/lib/plan-bimby/parse"
import type { PlanDraft } from "@/lib/plan-bimby/types"
import type { CriticKey, Critique, KeyAction } from "./types"

const MAX_KEYS = 4

const clean = (s: string) => s.replace(/^(?:and|but|also|hopefully|then)\s+/i, "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim().slice(0, 60)

export function keysOf(critique: Critique, draft: Pick<PlanDraft, "items">): CriticKey[] {
  const keys: CriticKey[] = []
  const seen = new Set<string>()
  const add = (label: string, action: KeyAction) => {
    const id = JSON.stringify(action)
    if (seen.has(id) || keys.length >= MAX_KEYS) return
    seen.add(id)
    keys.push({ label, action })
  }
  const title = (id: string) => draft.items.find((i) => i.id === id)?.title ?? "that task"
  for (const x of critique.findings) {
    if (x.kind === "dropped" && x.quote && clean(x.quote)) add(`Add “${clean(x.quote)}” as a task`, { kind: "add-row", title: clean(x.quote) })
    else if (x.kind === "invented" && draft.items.some((i) => i.id === x.where) && x.strength === "hint") add(`Remove “${title(x.where)}”`, { kind: "remove-row", rowId: x.where })
    else if (x.kind === "wrong-link" && draft.items.some((i) => i.id === x.where)) add(`Clear the link on “${title(x.where)}”`, { kind: "clear-link", rowId: x.where })
  }
  return keys
}

/** Run a key on the draft. The critique stays on it, so the strip still shows what was found. */
export function applyKey(draft: PlanDraft, action: KeyAction): PlanDraft {
  switch (action.kind) {
    case "add-row":
      return { ...draft, items: [...draft.items, { id: planItemId(), title: action.title, subtasks: [], pace: "steady" }] }
    case "remove-row":
      return { ...draft, items: draft.items.filter((i) => i.id !== action.rowId) }
    case "clear-link":
      return { ...draft, items: draft.items.map((i) => (i.id === action.rowId ? { ...i, link: undefined } : i)) }
  }
}
