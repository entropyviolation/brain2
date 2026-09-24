/**
 * lib/ingest/apply-receipt.ts — OCR lines → grocery checkout + pantry bump
 *
 * Unique grocery matches check off and bump inventory. Ambiguous or new names
 * ask (number / inv / skip) instead of silently deleting a grocery line.
 */
import { completeTask } from "@/lib/services/completion-service"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { applyBoughtCandidate, findGroceryList, groceryDumpText } from "./apply-grocery"
import { bumpInventory } from "./apply-inventory"
import { resolveName } from "./name-resolve"
import { parseReceiptLines, type ReceiptLine } from "./receipt-parse"
import type { ApplyResult, NameCandidate, PendingClarify } from "./types"

export interface ReceiptSession {
  lines: ReceiptLine[]
  index: number
  checked: string[]
  pantry: string[]
  skipped: string[]
}

export function applyReceiptText(payload: string, now = new Date()): ApplyResult {
  const lines = parseReceiptLines(payload)
  if (lines.length === 0) {
    return {
      status: "error",
      kind: "receipt",
      reply: "No grocery lines on that receipt. Caption journal to park the page in Docs.",
    }
  }
  return continueReceipt({ lines, index: 0, checked: [], pantry: [], skipped: [] }, now)
}

export function continueReceipt(session: ReceiptSession, now: Date): ApplyResult {
  const grocery = findGroceryList()
  while (session.index < session.lines.length) {
    const line = session.lines[session.index]!
    const open = grocery
      ? useTaskStore
          .getState()
          .tasks.filter((task) => task.lists?.includes(grocery.id) && !task.completed)
          .map((task) => ({ id: task.id, name: itemTitleOrUntitled(task) }))
      : []
    const hit = open.length ? resolveName(line.name, open) : { status: "none" as const, query: line.name }

    if (hit.status === "match") {
      completeTask(hit.candidate.id)
      const pantry = bumpInventory(hit.candidate.name, line.qty, now)
      session.checked.push(hit.candidate.name)
      session.pantry.push(`${pantry.name} ×${pantry.count}`)
      session.index += 1
      continue
    }

    if (hit.status === "ambiguous") {
      return clarifyReceipt(session, line, hit.candidates, now, "Which grocery line")
    }

    return clarifyReceipt(session, line, [], now, "New on the receipt")
  }

  return finishReceipt(session)
}

export function applyReceiptAnswer(pending: PendingClarify, text: string, now: Date): ApplyResult {
  const session = parseReceiptSession(pending.remainder)
  if (!session) {
    return { status: "error", kind: "receipt", reply: "Receipt expired. Send the photo again." }
  }
  const line = session.lines[session.index]
  if (!line) return finishReceipt(session)

  const lower = text.trim().toLowerCase()
  if (lower === "skip" || lower === "-" || lower === "no") {
    session.skipped.push(line.name)
    session.index += 1
    return continueReceipt(session, now)
  }

  if (lower === "inv" || lower === "inventory" || lower === "pantry" || lower === "new") {
    const pantry = bumpInventory(pending.createName || line.name, line.qty, now)
    session.pantry.push(`${pantry.name} ×${pantry.count}`)
    session.index += 1
    return continueReceipt(session, now)
  }

  const picked =
    pickIndex(text, pending.candidates) ??
    pending.candidates.find((c) => c.name.toLowerCase() === lower)
  if (picked) {
    const bought = applyBoughtCandidate(picked.id)
    if (bought.status === "ok") {
      session.checked.push(picked.name)
      const pantry = bumpInventory(picked.name, line.qty, now)
      session.pantry.push(`${pantry.name} ×${pantry.count}`)
    }
    session.index += 1
    return continueReceipt(session, now)
  }

  const grocery = findGroceryList()
  const open = grocery
    ? useTaskStore
        .getState()
        .tasks.filter((task) => task.lists?.includes(grocery.id) && !task.completed)
        .map((task) => ({ id: task.id, name: itemTitleOrUntitled(task) }))
    : []
  const hit = open.length ? resolveName(text.trim(), open) : { status: "none" as const, query: text }
  if (hit.status === "match") {
    completeTask(hit.candidate.id)
    session.checked.push(hit.candidate.name)
    const pantry = bumpInventory(hit.candidate.name, line.qty, now)
    session.pantry.push(`${pantry.name} ×${pantry.count}`)
    session.index += 1
    return continueReceipt(session, now)
  }
  if (hit.status === "ambiguous") {
    return clarifyReceipt(session, line, hit.candidates, now, "Which grocery line")
  }

  const pantry = bumpInventory(text.trim() || line.name, line.qty, now)
  session.pantry.push(`${pantry.name} ×${pantry.count}`)
  session.index += 1
  return continueReceipt(session, now)
}

export function parseReceiptSession(remainder?: string): ReceiptSession | null {
  if (!remainder) return null
  try {
    const parsed = JSON.parse(remainder) as ReceiptSession
    if (!parsed || !Array.isArray(parsed.lines)) return null
    return {
      lines: parsed.lines,
      index: Number(parsed.index) || 0,
      checked: parsed.checked || [],
      pantry: parsed.pantry || [],
      skipped: parsed.skipped || [],
    }
  } catch {
    return null
  }
}

function clarifyReceipt(
  session: ReceiptSession,
  line: ReceiptLine,
  candidates: NameCandidate[],
  now: Date,
  heading: string,
): ApplyResult {
  const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
  const extra = list ? `\n${list}` : ""
  return {
    status: "needs_clarify",
    kind: "receipt",
    reply: `${heading} for “${line.name}”? Reply a number, inv (pantry), skip, or the grocery name.${extra}`,
    pending: {
      kind: "receipt",
      query: line.name,
      candidates,
      createName: line.name,
      remainder: JSON.stringify(session),
      createdAt: now.toISOString(),
    },
  }
}

function finishReceipt(session: ReceiptSession): ApplyResult {
  const bits = [
    session.checked.length ? `Got ${session.checked.join(", ")}.` : null,
    session.pantry.length ? `Pantry ${session.pantry.join(", ")}.` : null,
    session.skipped.length ? `Skipped ${session.skipped.join(", ")}.` : null,
  ].filter(Boolean)
  if (!bits.length) {
    return { status: "error", kind: "receipt", reply: "Nothing applied from that receipt." }
  }
  return {
    status: "ok",
    kind: "receipt",
    reply: bits.join(" "),
    summary: session.checked.length
      ? `Receipt got ${session.checked.join(", ")}`
      : `Receipt pantry ${session.pantry.join(", ")}`,
    itemIds: [],
    pinText: groceryDumpText() ?? undefined,
  }
}

function pickIndex(text: string, candidates: { id: string }[]) {
  const n = Number(text.trim())
  if (!Number.isInteger(n) || n < 1 || n > candidates.length) return null
  return candidates[n - 1]
}
