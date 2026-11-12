/**
 * lib/finance-bimby/run.ts — One line (or one receipt) to the Financial BIMBY
 *
 * Called by BIM chat's `money` lane and by the BIMBY's own chat. In BIM chat it takes a line only when the
 * line reads as money in code, and returns null otherwise so the line goes on. In its own chat (`own`) every
 * line is its to answer.
 *
 * Order: an open question of its own (did you use the discount; what about the purchase), a money statement,
 * a ledger question, a verdict on a purchase, a purchase being weighed, then talk. Reading and writing are
 * code. A model is asked only to say one or two sentences from the fact sheet, and only its sentences are
 * shown as its own: what is filed is always the person's words.
 */

import { putImageDataUrl } from "@/lib/attachments"
import { infoText, isInfoRequest } from "@/lib/agents/info"
import { financeBimbyBlueprint, FINANCE_BIMBY_HREF } from "@/lib/agents/adapters/finance-bimby"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { IncomingAttachment } from "@/lib/ingest/types"
import { adviceFor, answerAsk, factSheet, findPurchase, perkLabel, purchaseLabel, relatedPurchases, verdictLines } from "./advise"
import { applyMoney, attachReceipts, holdReceipts, ledgerNow, markPerkUsed, readContext, setVerdict, undoLastMoney } from "./apply"
import { MONEY_WORD, money, moneyTokens, readAsk, readIntent, readMoney, readReflection } from "./read"
import { readReceipt } from "./receipt"
import { bindFinanceTalk, useFinanceBimby, type FinanceChoice } from "./store"
import type { Purchase } from "./types"

export interface MoneyReply {
  text: string
  route: string
  choices?: FinanceChoice[]
  purchaseId?: string
  /** True when something was stored. */
  wrote?: boolean
}

export interface MoneyOpts {
  /** The BIMBY's own chat: every line is answered. */
  own?: boolean
  /** May a model be asked. */
  llm?: boolean
  /** The model to ask. Omitted finds the chat crew's main model; null means none. */
  call?: ModelCall | null
  /** BIM chat: the line sits right under this BIMBY's question. Omitted (its own chat) means yes. */
  answering?: boolean
  /** OCR for receipt pictures. Omitted uses the app's local Tesseract. */
  ocr?: (dataUrls: string[]) => Promise<string[]>
}

type Pending = { kind: "why"; purchaseId: string; at: number } | { kind: "perk"; perkId: string; at: number }
let pending: Pending | null = null
const PENDING_TTL_MS = 15 * 60 * 1000

/** The question this BIMBY is waiting on, if any. */
export function openMoneyQuestion(): Pending | null {
  return pending
}

export function resetFinanceRunForTests(): void {
  pending = null
}

const route = (what: string, by = "code") => `MONEY · ${what} · ${by}`

// ---------------------------------------------------------------- the model, for sentences only

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms)
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)))
  })
}

async function modelFor(opts: MoneyOpts): Promise<ModelCall | null> {
  if (opts.call !== undefined) return opts.call
  if (!opts.llm) return null
  try {
    const [{ chatCrew }, { ollamaCall }] = await Promise.all([import("@/lib/bim-flow/chat-models"), import("@/lib/bim-flow/ollama")])
    const crew = await chatCrew()
    return crew ? ollamaCall(crew.main) : null
  } catch {
    return null
  }
}

const SYSTEM =
  "You are the Financial BIMBY, a small helper inside the person's own notes app. You talk with them about their spending. " +
  "Use only the facts given; never invent an amount, a purchase or a rule. Do not lecture and do not moralise. " +
  "Reply in one to three short plain sentences. When they regret or enjoyed a purchase, acknowledge it in a few words and say one concrete thing " +
  "that would help next time, drawn from their own earlier verdicts when there are any; or ask one short question that would make the lesson clearer."

async function say(user: string, opts: MoneyOpts): Promise<string | null> {
  const call = await modelFor(opts)
  if (!call) return null
  try {
    const out = (await withTimeout(
      call({ system: SYSTEM, user, schema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] }, maxTokens: 180, temperature: 0.4 }),
      60_000,
    )) as { reply?: unknown }
    const reply = typeof out?.reply === "string" ? out.reply.trim() : ""
    return reply || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- one line

const YES = /^(?:yes|yep|yeah|yup|i\s+did|did|used(?:\s+it|\s+that)?|i\s+used\s+(?:it|that))\b/i
const NO = /^(?:no|nope|nah|not\s+yet|still\s+have\s+it|didn'?t|i\s+didn'?t|forgot)\b/i
const UNDO = /^(?:undo(?:\s+(?:that|it))?|scrap\s+that|never\s?mind|take\s+that\s+back|delete\s+that)[.!]*$/i

const shopIn = (text: string, purchases: readonly Purchase[]) => {
  const lower = text.toLowerCase()
  return [...new Set(purchases.map((p) => p.merchant).filter((m): m is string => !!m))].find((m) => lower.includes(m.toLowerCase()))
}

/** One typed line. Null (never in `own`) when the line is not about money. */
export async function tryMoney(raw: string, now: Date, opts: MoneyOpts = {}): Promise<MoneyReply | null> {
  const text = raw.trim()
  if (!text) return null
  const open = pending && opts.answering !== false && now.getTime() - pending.at <= PENDING_TTL_MS ? pending : null
  pending = null

  // "Did you use it?"
  if (open?.kind === "perk") {
    if (YES.test(text)) {
      const perk = markPerkUsed(open.perkId, now)
      return { text: perk ? `Marked used: ${perkLabel(perk)}. I will stop bringing it up.` : "Marked used.", route: route("perk used"), wrote: true }
    }
    if (NO.test(text)) return { text: "Still yours. I will keep bringing it up.", route: route("perk kept") }
  }

  if (opts.own && UNDO.test(text)) return { text: undoLastMoney(now) ?? "There is nothing recent of mine to undo.", route: route("undo") }

  const read = readMoney(text, now, readContext())
  if (read) {
    const done = applyMoney(read, now)
    if (done.askPerkId) pending = { kind: "perk", perkId: done.askPerkId, at: now.getTime() }
    return { text: done.text, route: route(read.kind), wrote: done.wrote, ...(done.choices ? { choices: done.choices } : {}), ...(done.purchaseId ? { purchaseId: done.purchaseId } : {}) }
  }

  const ask = readAsk(text, now)
  if (ask) return { text: answerAsk(ask, ledgerNow()), route: route(`ask ${ask.kind}`) }

  const purchases = useFinanceBimby.getState().purchases
  const felt = readReflection(text)
  if (felt) {
    const hit = findPurchase(purchases, text, now, { allowNewest: !!opts.own || MONEY_WORD.test(text) })
    if (hit) {
      // A bare "i regret the instacart order" names the purchase and gives no reason: keep the verdict, ask for the reason.
      const said = moneyTokens(text).filter((t) => !hit.purchase.tokens.includes(t) && !/^(regret|satisf|happy|glad|worth|love|mixed|feel|wast|wish|shouldnt|need|didnt)/.test(t))
      const bare = said.length < 2
      const kept = setVerdict(hit.purchase.id, felt.kind, bare ? undefined : felt.words, now)!
      const ledger = ledgerNow()
      const lines = [`Noted on ${purchaseLabel(kept)}: ${felt.kind}.${hit.clear ? "" : " (The newest one that fits; say the date if you meant another.)"}`]
      const history = verdictLines(relatedPurchases(ledger.purchases.filter((p) => p.id !== kept.id), kept.tokens, kept.merchant), kept.merchant ? `Other ${kept.merchant} buys` : "Other buys like it")
      if (history.length) lines.push("", ...history)
      if (bare) {
        pending = { kind: "why", purchaseId: kept.id, at: now.getTime() }
        lines.push("", felt.kind === "satisfied" ? "What made it worth it? I will keep your words with it." : "What about it? (What you would skip, or what tipped you into buying.) I will keep your words with it.")
        return { text: lines.join("\n"), route: route("verdict"), purchaseId: kept.id, wrote: true }
      }
      const model = await say(`${factSheet(ledger, now, kept)}\n\nThe person just said: “${felt.words}”`, opts)
      if (model) lines.push("", model)
      else lines.push("", `I will bring this up next time you log or weigh a buy${kept.merchant ? ` at ${kept.merchant}` : " like it"}.`)
      return { text: lines.join("\n"), route: route("verdict", model ? "model" : "code"), purchaseId: kept.id, wrote: true }
    }
    if (opts.own) return { text: purchases.length ? "Which purchase do you mean? Name the shop or the thing." : "I do not have a purchase to pin that on yet. Tell me what you bought first (“spent 90 on the amex at instacart”).", route: route("verdict?") }
  }

  // The answer to "What about it?": the person's reason, kept word for word.
  if (open?.kind === "why" && !/\?\s*$/.test(text) && !UNDO.test(text)) {
    const p = purchases.find((x) => x.id === open.purchaseId)
    if (p?.verdict) {
      const kept = setVerdict(p.id, p.verdict.kind, text, now)!
      const model = await say(`${factSheet(ledgerNow(), now, kept)}\n\nAsked what about it, the person said: “${text}”`, opts)
      return { text: [`Kept with ${purchaseLabel(kept)}: “${text}”`, model ?? `I will bring this up next time you log or weigh a buy${kept.merchant ? ` at ${kept.merchant}` : " like it"}.`].join("\n\n"), route: route("verdict why", model ? "model" : "code"), purchaseId: kept.id, wrote: true }
    }
  }

  const intent = readIntent(text)
  if (intent) {
    const ledger = ledgerNow()
    const merchant = shopIn(intent.topic, ledger.purchases) ?? shopIn(intent.topic, ledger.perks.map((p) => ({ merchant: p.merchant }) as Purchase))
    const facts = adviceFor({ tokens: intent.tokens, merchant, cents: intent.cents }, ledger, now)
    if (facts.length) return { text: [`Before you buy${intent.topic ? ` (${intent.topic})` : ""}:`, ...facts].join("\n"), route: route("advise") }
    if (!opts.own) return null
  }

  if (!opts.own) return null
  const model = await say(`${factSheet(ledgerNow(), now)}\n\nThe person says: “${text}”`, opts)
  if (model) return { text: model, route: route("talk", "model") }
  return {
    text: "I did not read money in that. I take lines like “spent 90 on the amex getting hairdye on instacart”, “foxtide owes me 600 for the cd designs”, “foxtide paid me”, “i regret the instacart order”, “who owes me?”, “how much did i spend this week?”. Type /info for the rest.",
    route: route("unread"),
  }
}

// ---------------------------------------------------------------- receipts

const RECEIPT_WORD = /\b(?:rec(?:ei|ie)pts?|proof\s+of\s+purchase|order\s+confirmation|invoice)\b/i
/** A receipt with no words is taken as the last purchase's when that was told this recently. */
const FRESH_MS = 15 * 60 * 1000

async function ocrOf(photos: IncomingAttachment[], opts: MoneyOpts): Promise<string> {
  const urls = photos.map((p) => p.dataUrl).filter((u) => u.startsWith("data:"))
  if (!urls.length) return ""
  try {
    const ocr = opts.ocr ?? (async (list: string[]) => (await import("@/lib/ingest/ocr")).ocrImages(list, "receipt"))
    return (await withTimeout(ocr(urls), 90_000)).filter(Boolean).join("\n")
  } catch {
    return ""
  }
}

/**
 * A photo, with or without a caption. In BIM chat it is taken when the caption is a spend, or says receipt
 * and points at a purchase, or there is no caption and a purchase was told in the last quarter hour.
 * A plain "receipt" with none of those stays the grocery receipt it always was (`apply-receipt.ts`).
 */
export async function tryMoneyPhoto(raw: string, photos: IncomingAttachment[], now: Date, opts: MoneyOpts = {}): Promise<MoneyReply | null> {
  const pics = photos.filter((p) => p.kind === "photo" && p.dataUrl)
  if (!pics.length) return null
  const caption = raw.trim()
  const purchases = useFinanceBimby.getState().purchases
  const read = caption ? readMoney(caption, now, readContext()) : null
  const newest = [...purchases].sort((a, b) => b.at.localeCompare(a.at))[0]
  const fresh = newest && now.getTime() - new Date(newest.at).getTime() <= FRESH_MS ? newest : null
  const named = caption ? findPurchase(purchases, caption, now) : null
  const saysReceipt = RECEIPT_WORD.test(caption)
  const take = !!opts.own || read?.kind === "spend" || (saysReceipt && (!!named || !!fresh || /\b(?:attach|purchase|order|financ|money|budget|spen[dt]|bought)\b/i.test(caption))) || (!caption && !!fresh)
  if (!take) return null

  const uris: string[] = []
  for (const p of pics) uris.push(await putImageDataUrl(p.dataUrl, p.name || "receipt"))
  const n = uris.length === 1 ? "Receipt" : `${uris.length} receipts`

  if (read?.kind === "spend") {
    const text = await ocrOf(pics, opts)
    const done = applyMoney(read, now, { receipts: uris, ...(text ? { receiptText: text } : {}) })
    if (done.askPerkId) pending = { kind: "perk", perkId: done.askPerkId, at: now.getTime() }
    return { text: done.text, route: route("spend + receipt"), wrote: done.wrote, ...(done.choices ? { choices: done.choices } : {}), ...(done.purchaseId ? { purchaseId: done.purchaseId } : {}) }
  }

  const text = await ocrOf(pics, opts)
  const seen = readReceipt(text, readContext().merchants)
  // By name in the caption, else the one just told, else the one the receipt's own total and shop point at.
  const byReceipt = seen.totalCents
    ? purchases.filter((p) => p.cents === seen.totalCents && now.getTime() - new Date(p.at).getTime() <= 7 * 86_400_000).sort((a, b) => b.at.localeCompare(a.at))[0]
    : undefined
  const target = named?.purchase ?? fresh ?? byReceipt
  if (target) {
    attachReceipts(target.id, uris, text)
    const differs = seen.totalCents && seen.totalCents !== target.cents ? ` The receipt reads ${money(seen.totalCents)}; you told me ${money(target.cents)}. The amount can be changed in the money book.` : ""
    return { text: `${n} attached to ${purchaseLabel(target)}.${differs}`, route: route("receipt"), purchaseId: target.id, wrote: true }
  }
  if (seen.totalCents) {
    const done = applyMoney({ kind: "spend", cents: seen.totalCents, what: seen.merchant ? `${seen.merchant} order` : "Receipt", ...(seen.merchant ? { merchant: seen.merchant } : {}), date: formatLocalDateKey(now) }, now, { receipts: uris, receiptText: text })
    if (done.askPerkId) pending = { kind: "perk", perkId: done.askPerkId, at: now.getTime() }
    return { text: `Read from the receipt. ${done.text}\nSay what it was for, or “undo that” if I read it wrong.`, route: route("receipt read"), wrote: done.wrote, ...(done.choices ? { choices: done.choices } : {}), ...(done.purchaseId ? { purchaseId: done.purchaseId } : {}) }
  }
  holdReceipts(uris, now, text)
  return { text: `${n} kept. I could not read a total on it. Tell me what it was in the next 15 minutes (“spent 90 on the amex at instacart”) and I will attach it.`, route: route("receipt held"), wrote: true }
}

// ---------------------------------------------------------------- its own chat

bindFinanceTalk(async (text, photos, now) => {
  if (!photos.length && isInfoRequest(text)) return { text: infoText(financeBimbyBlueprint(), { href: FINANCE_BIMBY_HREF }) }
  const reply = photos.length ? await tryMoneyPhoto(text, photos, now, { own: true, llm: true }) : await tryMoney(text, now, { own: true, llm: true })
  return reply ?? { text: "I could not read that picture." }
})
