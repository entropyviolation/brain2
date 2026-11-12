/**
 * lib/finance-bimby/read.ts — One sentence into a money reading (pure, no model)
 *
 * "Spent 90$ on the amex getting hairdye and other stuff on instacart" → a spend of $90, paid with Amex, at
 * Instacart, for hairdye and other stuff. "foxtide owes me 600$ for the cd designs" → a debt owed to you.
 * "got 15$ off restaurant food on instacart" → a perk. Also: how a purchase sat afterwards (`readReflection`),
 * a question about money (`readAsk`), and a purchase being considered (`readIntent`).
 *
 * The rule for taking a line in BIM chat is strictness: a money verb and an amount, or one of the fixed
 * shapes. "spent 3 hours on foxtide" and "got 2 things done" are not money. Nothing here writes.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import type { BuyIntent, MoneyAsk, MoneyRead, Reflection } from "./types"

// ---------------------------------------------------------------- words

const STOP = new Set(
  (
    "a an the and or of to for in on at by with from is are was were be been do does did will would can could should i im me my it its " +
    "this that these those some any other stuff things thing just really very so too also got get getting buy buying bought order ordered " +
    "ordering spent spend paid pay purchase purchased about them they he she we you your not no yes"
  ).split(" "),
)

/** "ordering" → "order", "groceries" → "grocery", "dyes" → "dye". Light on purpose: both sides of a match pass through it. */
export function stem(word: string): string {
  let w = word.toLowerCase()
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`
  if (w.length > 5 && w.endsWith("ing")) {
    w = w.slice(0, -3)
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2] && !/[sl]/.test(w[w.length - 1]!)) w = w.slice(0, -1)
    return w
  }
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
  return w
}

/** Content words, stemmed, in order, without repeats. */
export function moneyTokens(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.toLowerCase().replace(/['’]s\b/g, "").replace(/['’]/g, "").split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue
    const w = stem(raw)
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,.;:!–—-]+$/g, "").trim()
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
/** A name as a person would write it: "foxtide" → "Foxtide", "uber eats" → "Uber Eats". Already-capitalised words are kept. */
export function properName(s: string): string {
  return tidy(s).replace(/\S+/g, (w) => (/[A-Z]/.test(w) ? w : cap(w)))
}

// ---------------------------------------------------------------- amounts

const NUMBER = "\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?"
/** "$90", "90$", "90 dollars", "90 bucks", "$1.2k". */
const MARKED = new RegExp(`\\$\\s?(${NUMBER})(k\\b)?|(${NUMBER})(k)?\\s?(?:\\$|(?:dollars?|bucks?|usd)\\b)`, "i")
/** A number alone, only where a money verb already stands. Not a duration, a clock, a percent or a count. */
const BARE = new RegExp(
  `(?<![\\w.:/])(${NUMBER})(k\\b)?(?![\\d:/%])(?!\\s*(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|days?|weeks?|months?|years?|am|pm|x|times?|miles?|mi|km|lbs?|kg|reps?|sets?|pages?|people|things?|items?|oz|mg|g|percent|st|nd|rd|th)\\b)`,
  "i",
)

export interface Amount {
  cents: number
  index: number
  length: number
}

function centsOf(num: string, k: string | undefined): number | null {
  const n = Number(num.replace(/,/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  const cents = Math.round(n * (k ? 1000 : 1) * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

/** The first amount in the text. `bare` also accepts a number with no currency mark. */
export function findAmount(text: string, opts: { bare?: boolean } = {}): Amount | null {
  const m = MARKED.exec(text)
  if (m) {
    const cents = centsOf(m[1] ?? m[3]!, m[2] ?? m[4])
    if (cents) return { cents, index: m.index, length: m[0].length }
  }
  if (!opts.bare) return null
  const b = BARE.exec(text)
  if (!b) return null
  const cents = centsOf(b[1]!, b[2])
  return cents ? { cents, index: b.index, length: b[0].length } : null
}

const cut = (text: string, a: Amount) => tidy(`${text.slice(0, a.index)} ${text.slice(a.index + a.length)}`)

export function money(cents: number): string {
  const dollars = Math.floor(cents / 100)
  const frac = cents % 100
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return frac ? `$${grouped}.${String(frac).padStart(2, "0")}` : `$${grouped}`
}

// ---------------------------------------------------------------- how it was paid, and where

const ACCOUNTS: [RegExp, string, "cash" | "bank" | "card"][] = [
  [/\b(?:amex|american express)\b/i, "Amex", "card"],
  [/\bvisa\b/i, "Visa", "card"],
  [/\bmaster\s?card\b/i, "Mastercard", "card"],
  [/\bdiscover(?:\s+card)?\b/i, "Discover", "card"],
  [/\bapple\s+card\b/i, "Apple Card", "card"],
  [/\bapple\s+pay\b/i, "Apple Pay", "card"],
  [/\bcapital\s+one\b/i, "Capital One", "card"],
  [/\bchase\b/i, "Chase", "card"],
  [/\bdebit(?:\s+card)?\b/i, "Debit", "card"],
  [/\bcredit(?:\s+card)?\b/i, "Credit", "card"],
  [/\bcash\s?app\b/i, "Cash App", "bank"],
  [/\bvenmo\b/i, "Venmo", "bank"],
  [/\bpaypal\b/i, "PayPal", "bank"],
  [/\bzelle\b/i, "Zelle", "bank"],
  [/\bchecking\b/i, "Checking", "bank"],
  [/\bsavings\b/i, "Savings", "bank"],
  [/\bcash\b/i, "Cash", "cash"],
]

/** Shops a bare "on X" is read as, when nothing else says X is a place. A purchase made anywhere else teaches the name. */
export const KNOWN_MERCHANTS = [
  "instacart", "amazon", "doordash", "uber eats", "ubereats", "grubhub", "postmates", "target", "walmart", "costco", "etsy", "ebay",
  "depop", "sephora", "ulta", "shein", "temu", "uber", "lyft", "netflix", "spotify", "steam", "whole foods", "trader joes", "cvs",
  "walgreens", "sally beauty", "sallys", "ikea", "best buy", "starbucks", "tiktok shop", "poshmark", "vinted",
]

function pullAccount(text: string, known: string[]): { account?: string; kind?: "cash" | "bank" | "card"; rest: string } {
  const lead = "(?:\\b(?:on|with|using|via|from|in|by|through)\\s+)?(?:\\b(?:the|my)\\s+)?"
  for (const name of known) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const m = new RegExp(`${lead}\\b${safe}\\b(?:\\s+card)?`, "i").exec(text)
    if (m) return { account: name, rest: tidy(text.replace(m[0], " ")) }
  }
  for (const [re, name, kind] of ACCOUNTS) {
    const m = new RegExp(`${lead}${re.source}(?:\\s+card)?`, "i").exec(text)
    if (m) return { account: name, kind, rest: tidy(text.replace(m[0], " ")) }
  }
  return { rest: text }
}

function pullDate(text: string, now: Date): { date: string; rest: string } {
  const m = /\b(yesterday|last night|today|tonight|this morning|earlier)\b/i.exec(text)
  if (!m) return { date: formatLocalDateKey(now), rest: text }
  const d = new Date(now)
  if (/yesterday|last night/i.test(m[1]!)) d.setDate(d.getDate() - 1)
  return { date: formatLocalDateKey(d), rest: tidy(text.replace(m[0], " ")) }
}

/** The shop at the end of the words: "… at Target", "… from Etsy", and "… on instacart" when Instacart is a known shop or something else is already the thing bought. */
function pullMerchant(text: string, merchants: string[]): { merchant?: string; rest: string } {
  const at = /\b(?:at|from|through|thru|via)\s+(?:the\s+)?([a-z0-9][\w'’&.\- ]{1,40})$/i.exec(text)
  if (at && !/\b(?:for|on)\b/i.test(at[1]!)) return { merchant: properName(at[1]!), rest: tidy(text.slice(0, at.index)) }
  const on = /\bon\s+(?:the\s+)?([a-z0-9][\w'’&.\- ]{1,40})$/i.exec(text)
  if (on) {
    const name = on[1]!.toLowerCase().trim()
    const before = tidy(text.slice(0, on.index))
    const known = merchants.some((m) => m.toLowerCase() === name) || KNOWN_MERCHANTS.includes(name)
    if (known) return { merchant: properName(on[1]!), rest: before }
  }
  return { rest: text }
}

const WHAT_LEAD = /^(?:(?:getting|buying|to\s+get|to\s+buy|for|on|and\s+got|got)\s+)+/i

export interface ReadContext {
  /** Account names the money book already has. */
  accounts?: string[]
  /** Shops from earlier purchases. */
  merchants?: string[]
}

function spendFrom(rest: string, cents: number, now: Date, ctx: ReadContext): MoneyRead {
  const dated = pullDate(rest, now)
  const paid = pullAccount(dated.rest, ctx.accounts ?? [])
  const shop = pullMerchant(paid.rest, ctx.merchants ?? [])
  const what = tidy(shop.rest.replace(WHAT_LEAD, "").replace(/^(?:a|an|the|some)\s+/i, ""))
  return {
    kind: "spend",
    cents,
    what: what || (shop.merchant ? `${shop.merchant} order` : "Spent"),
    ...(shop.merchant ? { merchant: shop.merchant } : {}),
    ...(paid.account ? { account: paid.account } : {}),
    ...(paid.kind ? { accountKind: paid.kind } : {}),
    date: dated.date,
  }
}

// ---------------------------------------------------------------- the reading

const SPEND_VERB = /^(?:i\s+)?(?:just\s+|also\s+)?(spent|paid|dropped|blew|bought|ordered|purchased|got)\b\s*/i
const EARN_VERB = /^(?:i\s+)?(?:just\s+)?(?:got\s+paid|was\s+paid|made|earned|received)\b\s*/i

/** A money statement, or null when the line is not one. */
export function readMoney(raw: string, now: Date, ctx: ReadContext = {}): MoneyRead | null {
  const text = tidy(raw)
  if (!text || text.length > 280 || /\n/.test(raw.trim()) || /\?\s*$/.test(text)) return null

  // A discount: "got 15$ off restaurant food on instacart", "20% off at Sephora".
  const off = new RegExp(`^(?:i\\s+)?(?:(?:just\\s+)?(?:got|have|earned|won|there(?:'|’)?s|theres)\\s+)?(?:an?\\s+)?(?:(${NUMBER})\\s?%|(\\$\\s?(?:${NUMBER})|(?:${NUMBER})\\s?\\$|(?:${NUMBER})\\s?(?:dollars?|bucks?)))\\s+off\\b\\s*(.*)$`, "i").exec(text)
  if (off) {
    const amount = off[2] ? findAmount(off[2]) : null
    const shop = pullMerchant(tidy(off[3] ?? "").replace(/^(?:of|on|for)\s+(?=\S+\s)/i, ""), [...(ctx.merchants ?? []), ...KNOWN_MERCHANTS])
    const lone = !shop.merchant ? /^(?:on|at|from)\s+(.+)$/i.exec(tidy(off[3] ?? "")) : null
    const merchant = shop.merchant ?? (lone ? properName(lone[1]!) : undefined)
    const what = tidy((lone ? "" : shop.rest).replace(/^(?:of|on|for)\s+/i, ""))
    return {
      kind: "perk",
      text,
      ...(amount ? { cents: amount.cents } : {}),
      ...(off[1] ? { percent: Number(off[1]) } : {}),
      ...(what ? { what } : {}),
      ...(merchant ? { merchant } : {}),
    }
  }

  // "foxtide owes me 600$ for the cd designs"
  const owed = /^(.{1,60}?)\s+(?:still\s+)?owes?\s+me\b\s*(.*)$/i.exec(text)
  if (owed) {
    const amount = findAmount(owed[2]!, { bare: true })
    if (!amount) return null
    const note = tidy(cut(owed[2]!, amount).replace(/^(?:for|from)\s+/i, ""))
    return { kind: "debt", direction: "owed", who: properName(owed[1]!), cents: amount.cents, ...(note ? { note } : {}) }
  }

  // "i owe shelby $40 for dinner", "i owe 40 to shelby"
  const owe = /^i\s+(?:still\s+)?owe\b\s*(.+)$/i.exec(text)
  if (owe) {
    const amount = findAmount(owe[1]!, { bare: true })
    if (!amount) return null
    const [whoPart, ...noteParts] = cut(owe[1]!, amount).split(/\s+for\s+/i)
    const who = tidy((whoPart ?? "").replace(/^to\s+/i, ""))
    if (!who) return null
    const note = tidy(noteParts.join(" for "))
    return { kind: "debt", direction: "owe", who: properName(who), cents: amount.cents, ...(note ? { note } : {}) }
  }

  // "foxtide paid me", "foxtide paid me back 300", "shelby venmo'd me $40"
  const paidMe = /^(.{1,60}?)\s+(?:finally\s+|just\s+)?(?:paid|venmo(?:'|’)?e?d|zelled|sent|gave)\s+me\b(?:\s+back)?\s*(.*)$/i.exec(text)
  if (paidMe && !/^i$/i.test(paidMe[1]!.trim())) {
    const amount = findAmount(paidMe[2]!, { bare: true })
    return { kind: "settle", direction: "owed", who: properName(paidMe[1]!), ...(amount ? { cents: amount.cents } : {}), date: formatLocalDateKey(now) }
  }

  // "i paid shelby back", "i paid back shelby 40"
  const paidBack = /^i\s+(?:finally\s+|just\s+)?(?:paid|venmo(?:'|’)?e?d|zelled)\s+(?:back\s+(.+)|(.+?)\s+back\b\s*(.*))$/i.exec(text)
  if (paidBack) {
    const tail = paidBack[1] ?? `${paidBack[2]} ${paidBack[3] ?? ""}`
    const amount = findAmount(tail, { bare: true })
    const who = tidy(amount ? cut(tail, amount) : tail)
    if (!who) return null
    return { kind: "settle", direction: "owe", who: properName(who), ...(amount ? { cents: amount.cents } : {}), date: formatLocalDateKey(now) }
  }

  // "got paid 200 from foxtide for the poster"
  const earn = EARN_VERB.exec(text)
  if (earn) {
    const rest = text.slice(earn[0].length)
    const amount = findAmount(rest, { bare: /paid/i.test(earn[0]) })
    if (!amount) return null
    const dated = pullDate(cut(rest, amount), now)
    const from = /\bfrom\s+(.+?)(?=\s+for\s+|$)/i.exec(dated.rest)
    const what = tidy(tidy(dated.rest.replace(from?.[0] ?? "", " ")).replace(/^(?:for|on|doing)\s+/i, ""))
    return { kind: "earning", cents: amount.cents, what: what || "Earned", ...(from ? { from: properName(from[1]!) } : {}), date: dated.date }
  }

  // "Spent 90$ on the amex getting hairdye and other stuff on instacart", "bought hairdye for $20 at Sally's"
  const verb = SPEND_VERB.exec(text)
  if (verb) {
    const word = verb[1]!.toLowerCase()
    const rest = text.slice(verb[0].length)
    // "spent" and "paid" are money verbs on their own; "got" and "ordered" need a marked amount.
    const amount = findAmount(rest, { bare: word === "spent" || word === "paid" || word === "dropped" || word === "blew" })
    if (!amount) return null
    if (word === "got" && /^paid\b/i.test(rest)) return null
    const around = `${rest.slice(0, amount.index)} ${rest.slice(amount.index + amount.length)}`.replace(/\s+for\s+(?=\s|$)/i, " ")
    return spendFrom(tidy(around.replace(/\bfor\s*$/i, "")), amount.cents, now, ctx)
  }

  // "the hairdye cost me $20"
  const cost = /^(.{2,80}?)\s+(?:cost|costs|was|came\s+to|ran)\s+(?:me\s+)?(.+)$/i.exec(text)
  if (cost && /\bcost|came\s+to|ran\b/i.test(text)) {
    const amount = findAmount(cost[2]!)
    if (amount) return spendFrom(tidy(`${cost[1]!.replace(/^(?:the|my|that)\s+/i, "")} ${cut(cost[2]!, amount)}`), amount.cents, now, ctx)
  }
  return null
}

// ---------------------------------------------------------------- how a purchase sat

const NO_REGRET = /\b(?:no\s+regrets?|don'?t\s+regret|do\s+not\s+regret|didn'?t\s+regret|zero\s+regrets?)\b/i
const MIXED = /\b(?:mixed\s+feelings|kind\s?of\s+regret|kinda\s+regret|sort\s?of\s+regret|half\s+regret|not\s+sure\s+(?:it|that|if\s+it)\s+was\s+worth)\b/i
const REGRET =
  /\b(?:regret(?:ted|ting|s)?|shouldn'?t\s+have\s+(?:bought|ordered|spent|gotten|got|paid)|waste\s+of\s+money|wasted\s+(?:my\s+)?money|wasn'?t\s+worth|not\s+worth|buyer'?s\s+remorse|wish\s+i\s+(?:hadn'?t|didn'?t)\s+(?:bought|buy|ordered?|spen[dt]|gotten|get)|didn'?t\s+need)\b/i
const SATISFIED =
  /\b(?:satisfied|happy\s+with|glad\s+i\s+(?:bought|got|ordered|spent|paid)|worth\s+it|worth\s+every|love\s+(?:the|my|it)|so\s+glad|good\s+(?:buy|purchase|call)|great\s+(?:buy|purchase))\b/i

/** A line that says how something bought sat afterwards. Which purchase it means is decided by the caller. */
export function readReflection(raw: string): Reflection | null {
  const text = tidy(raw)
  if (!text || text.length > 400) return null
  if (MIXED.test(text)) return { kind: "mixed", words: text }
  if (NO_REGRET.test(text)) return { kind: "satisfied", words: text }
  if (REGRET.test(text)) return { kind: SATISFIED.test(text) ? "mixed" : "regret", words: text }
  if (SATISFIED.test(text)) return { kind: "satisfied", words: text }
  return null
}

/** Words that say the line is about money, when it names no purchase. */
export const MONEY_WORD = /\b(?:purchase|order|buy|buying|bought|spending|spent|spend|money|paid|paying|\$\s?\d)\b/i

// ---------------------------------------------------------------- questions

const dayKey = (d: Date) => formatLocalDateKey(d)

function period(text: string, now: Date): { from: string; to: string; label: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = (n: number) => {
    const x = new Date(d)
    x.setDate(x.getDate() - n)
    return x
  }
  if (/\btoday\b/i.test(text)) return { from: dayKey(d), to: dayKey(d), label: "today" }
  if (/\byesterday\b/i.test(text)) return { from: dayKey(back(1)), to: dayKey(back(1)), label: "yesterday" }
  // Weeks start on Monday.
  const sinceMonday = (d.getDay() + 6) % 7
  if (/\blast\s+week\b/i.test(text)) return { from: dayKey(back(sinceMonday + 7)), to: dayKey(back(sinceMonday + 1)), label: "last week" }
  if (/\b(?:this\s+)?week\b/i.test(text)) return { from: dayKey(back(sinceMonday)), to: dayKey(d), label: "this week" }
  if (/\blast\s+month\b/i.test(text)) {
    const first = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    const last = new Date(d.getFullYear(), d.getMonth(), 0)
    return { from: dayKey(first), to: dayKey(last), label: "last month" }
  }
  if (/\b(?:this\s+)?year\b/i.test(text)) return { from: `${d.getFullYear()}-01-01`, to: dayKey(d), label: "this year" }
  return { from: dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: dayKey(d), label: "this month" }
}

/** A question the ledger can answer in code. */
export function readAsk(raw: string, now: Date): MoneyAsk | null {
  const text = tidy(raw)
  if (!text || text.length > 200) return null
  const does = /\bdoes\s+(.+?)\s+(?:still\s+)?owe\s+me\b/i.exec(text)
  if (does) return { kind: "owed", who: properName(does[1]!) }
  if (/\bwho(?:\s+all)?\s+(?:still\s+)?owes?\s+me\b|\bwhat\s+am\s+i\s+owed\b|\bhow\s+much\s+am\s+i\s+owed\b|\bwho\s+do\s+i\s+need\s+to\s+collect\b/i.test(text)) return { kind: "owed" }
  if (/\b(?:who|what|how\s+much)\s+do\s+i\s+(?:still\s+)?owe\b/i.test(text)) return { kind: "owe" }
  const spent = /\b(?:how\s+much|what)\s+(?:have\s+i|did\s+i|i(?:'|’)?ve|ive|i)\s+spen[dt]\b(.*)$/i.exec(text)
  if (spent) {
    const p = period(spent[1]!, now)
    const about = moneyTokens(spent[1]!.replace(/\b(?:today|yesterday|this|last|week|month|year|so\s+far|total|in\s+total|overall)\b/gi, " "))
    return { kind: "spent", ...p, about }
  }
  if (/\bwhat\s+(?:do|did|have)\s+i\s+regret(?:ted)?\b|\bmy\s+regrets\b|\bregret\s+list\b|\bpurchases?\s+i\s+regret/i.test(text)) return { kind: "regrets" }
  if (/\b(?:what|which|any|my)\s+(?:discounts?|perks?|coupons?|credits?|deals?|promos?)\b/i.test(text)) return { kind: "perks" }
  return null
}

// ---------------------------------------------------------------- a purchase being considered

const INTENT =
  /\b(?:thinking\s+(?:about|of)|should\s+i|about\s+to|want\s+to|wanna|considering|tempted\s+to|might|going\s+to|gonna|need\s+to|do\s+i\s+need\s+to|can\s+i\s+afford(?:\s+to)?)\s+(?:(?:buy|order|get|spend|purchas|splurg|pay)(?:e|ing)?)\b\s*(.*)$/i

export function readIntent(raw: string): BuyIntent | null {
  const text = tidy(raw)
  if (!text || text.length > 240) return null
  const m = INTENT.exec(text)
  if (!m) return null
  const rest = tidy(m[1]!.replace(/\?+$/, ""))
  const amount = findAmount(rest)
  const topic = tidy((amount ? cut(rest, amount) : rest).replace(/^(?:on|for|from|at|some|a|an|the|more)\s+/i, ""))
  return { topic, tokens: moneyTokens(topic), ...(amount ? { cents: amount.cents } : {}) }
}
